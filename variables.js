// Live monitoring: declare a variable set from the current entities, then push
// values every poll. Timers are exposed BOTH by a stable id-key (survives
// reordering) and by a 1-based index (so a fixed button layout can show
// "Timer 1" regardless of which timer that is). Every other entity is keyed by
// its sanitised id.
const { arr, clockSegments } = require('./helpers')

function sanitize(id) {
	return String(id)
		.toLowerCase()
		.replace(/[^a-z0-9_]/g, '_')
}

function fmtHMS(totalSeconds) {
	if (totalSeconds == null || !Number.isFinite(totalSeconds)) return '--:--'
	const neg = totalSeconds < 0
	let s = Math.abs(Math.round(totalSeconds))
	const h = Math.floor(s / 3600)
	s -= h * 3600
	const m = Math.floor(s / 60)
	s -= m * 60
	const pad = (n) => String(n).padStart(2, '0')
	const body = h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
	return neg ? `-${body}` : body
}

const yesNo = (b) => (b ? 'yes' : 'no')

// Signed drift for display: "+5:00" behind, "-1:30" ahead, "0:00" on time.
function fmtDrift(d) {
	if (d == null) return ''
	if (d === 0) return '0:00'
	return (d > 0 ? '+' : '-') + fmtHMS(Math.abs(d))
}

// The per-entity variable table: [prefix, stateKey, keyOf, [[suffix, name, value(x)], …]].
// Declaring and valuing from one table keeps the two in lockstep.
const ENTITY_VARS = [
	[
		'clock',
		'clocks',
		(c) => c.id,
		[
			['name', 'name', (c) => c.name || c.id],
			['time', 'display time', (c) => c.primary ?? '--:--'],
			['label', 'secondary label', (c) => c.secondary || ''],
			['remaining', 'remaining (seconds)', (c) => (c.remaining == null ? '' : Math.round(c.remaining))],
			['mood', 'state', (c) => c.mood || 'normal'],
			['running', 'running (yes/no)', (c) => yesNo(c.running)],
			['color', 'on-screen colour (hex)', (c) => c.colorHex || ''],
			// Segments of the displayed time — one per button for big, readable digits.
			['hh', 'hours segment', (c) => clockSegments(c).hh],
			['mm', 'minutes segment', (c) => clockSegments(c).mm],
			['ss', 'seconds segment', (c) => clockSegments(c).ss],
			['ff', 'frames segment (timecode)', (c) => clockSegments(c).ff],
			['sign', 'sign ("-" in overtime)', (c) => clockSegments(c).sign],
			['ampm', 'AM/PM (time of day)', (c) => clockSegments(c).ampm],
		],
	],
	[
		'shift',
		'shifts',
		(s) => s.id,
		[
			['name', 'name', (s) => s.name || s.id],
			['rate', 'rate (1 = real time)', (s) => s.rate ?? 1],
		],
	],
	[
		'cuelight',
		'cueLights',
		(c) => c.id,
		[
			['name', 'name', (c) => c.name || c.id],
			['color', 'colour (hex)', (c) => c.colorHex || ''],
		],
	],
	[
		'schedule',
		'schedules',
		(s) => s.id,
		[
			['name', 'name', (s) => s.name || s.id],
			['current', 'cue in progress (by the clock)', (s) => s.currentLabel || ''],
			['running_cue', 'running cue (last Set & Start)', (s) => s.runningLabel || ''],
			['ondeck', 'on-deck cue', (s) => s.onDeckLabel || ''],
			['ondeck_time', 'on-deck start time', (s) => s.onDeckTime || ''],
			['ondeck_duration', 'on-deck duration', (s) => s.onDeckDuration || ''],
			['next', 'cue after on-deck', (s) => s.nextLabel || ''],
			['next_time', 'next cue start time', (s) => s.nextTime || ''],
			['position', 'position ("3 / 12")', (s) => s.position || ''],
			['status', 'status line ("Ends 10:47 PM · 5:00 behind")', (s) => s.statusLine || ''],
			['drift', 'drift (+behind / -ahead, m:ss)', (s) => fmtDrift(s.driftSeconds)],
			['drift_seconds', 'drift (seconds, + = behind)', (s) => (s.driftSeconds == null ? '' : s.driftSeconds)],
			['sync', 'Google Sheet sync marker', (s) => s.syncMarker || ''],
		],
	],
	[
		'scheduler',
		'schedulers',
		(s) => s.id,
		[
			['name', 'name', (s) => s.name || s.id],
			['armed', 'armed (yes/no)', (s) => yesNo(s.armed)],
			['next_title', 'next row', (s) => s.nextTitle || ''],
			['next_trigger', 'next row trigger', (s) => s.nextTrigger || ''],
			['live_tc', 'live timecode', (s) => s.liveTC || ''],
		],
	],
	[
		'automation',
		'automations',
		(a) => a.id,
		[
			['name', 'name', (a) => a.name || a.id],
			['armed', 'armed (yes/no)', (a) => yesNo(a.armed)],
			['time', 'trigger time', (a) => a.timeLabel || ''],
			['countdown', 'seconds to fire (final minute)', (a) => (a.countdown == null ? '' : Math.ceil(a.countdown))],
		],
	],
	[
		'message',
		'messages',
		(m) => m.id,
		[
			['name', 'name', (m) => m.name || m.id],
			['text', 'text', (m) => m.text || ''],
			['vis', 'on-air state (hidden/shown/flashing)', (m) => m.vis || 'hidden'],
		],
	],
	[
		'scene',
		'scenes',
		(s) => s.id,
		[
			['name', 'name', (s) => s.name || s.id],
			['ready', 'saved and ready (yes/no)', (s) => yesNo(s.ready)],
		],
	],
	[
		'cuestack',
		'cueStacks',
		(s) => s.clock,
		[
			['name', 'name', (s) => s.name || s.clock],
			['count', 'cues queued', (s) => arr(s.cues).length],
			['next', 'top cue (next GO)', (s) => topCue(s)],
		],
	],
	[
		'poll',
		'polls',
		(p) => p.id,
		[
			['name', 'name', (p) => p.name || p.id],
			['question', 'current question', (p) => p.question || ''],
			['state', 'voting state (ready/open/closed)', (p) => p.state || ''],
			['position', 'question position ("2 / 5")', (p) => (p.count ? `${p.index} / ${p.count}` : '')],
			['votes', 'votes on this question', (p) => p.total ?? 0],
			['audience', 'phones connected', (p) => p.audience ?? 0],
			['leader', 'leading answer', (p) => leader(p)],
			['leader_percent', 'leading answer %', (p) => leaderPercent(p)],
			['revealed', 'revealed on screen (yes/no)', (p) => yesNo(p.revealed)],
			['join_url', 'voting link', (p) => p.joinURL || ''],
			// While simulating, votes/leader above are the FAKE tally.
			['simulating', 'showing simulated votes (yes/no)', (p) => yesNo(p.simulating)],
			['sim_state', 'simulation (off / ready / open / closed)', (p) => (p.simulating ? p.simState || 'on' : 'off')],
		],
	],
	[
		// Whole-show scope only — READ-ONLY status (no output control by design).
		'output',
		'outputs',
		(o) => o.id,
		[
			['name', 'name', (o) => o.name || o.id],
			['enabled', 'on (yes/no)', (o) => yesNo(o.enabled)],
			['kind', 'type (display/web/ndi/deckLink/cloud/timeMachines/vmix)', (o) => o.kind || ''],
			['source', 'what it shows (design / page / clock / schedule name)', (o) => o.sourceName || ''],
			['feeds', 'source type (design/producer/clock/schedule)', (o) => o.feeds || ''],
		],
	],
]

function topCue(stack) {
	const c = arr(stack.cues)[0]
	if (!c) return ''
	return c.label ? `${c.label} (${fmtHMS(c.seconds)})` : fmtHMS(c.seconds)
}

function leaderIndex(p) {
	const counts = arr(p.counts)
	if (!counts.length || !counts.some((n) => n > 0)) return -1
	return counts.indexOf(Math.max(...counts))
}
function leader(p) {
	const i = leaderIndex(p)
	return i < 0 ? '' : String(arr(p.options)[i] ?? '')
}
function leaderPercent(p) {
	const i = leaderIndex(p)
	return i < 0 ? '' : (arr(p.percents)[i] ?? '')
}

const TIMER_VARS = [
	['name', 'name', (c) => c.name || c.id],
	['time', 'display time', (c) => c.primary ?? '--:--'],
	['remaining', 'remaining (seconds)', (c) => (c.remaining == null ? '' : Math.round(c.remaining))],
	['remaining_hms', 'remaining (m:ss)', (c) => fmtHMS(c.remaining)],
	['running', 'running (yes/no)', (c) => yesNo(c.running)],
	['mood', 'state (normal/warning/danger/expired)', (c) => c.mood || 'normal'],
	['endtime', 'ends-at time of day', (c) => c.endTime || ''],
	['duration_hms', 'duration (m:ss)', (c) => (c.duration == null ? '' : fmtHMS(c.duration))],
	['progress', 'progress (0–100 %)', (c) => (c.progress == null ? '' : Math.round(c.progress * 100))],
	['ended_at', 'time of day it hit zero', (c) => c.endedAt || ''],
	['rate', 'time-shift rate (1 = normal)', (c) => (c.rate == null ? 1 : c.rate)],
	['color', 'on-screen colour (hex)', (c) => c.colorHex || ''],
	['undo', 'seconds left to undo last edit', (c) => (c.undo == null ? 0 : Math.ceil(c.undo))],
	// Segments of the displayed time — hours / minutes / seconds on separate buttons.
	['hh', 'hours segment', (c) => clockSegments(c).hh],
	['mm', 'minutes segment', (c) => clockSegments(c).mm],
	['ss', 'seconds segment', (c) => clockSegments(c).ss],
	['sign', 'sign ("-" in overtime)', (c) => clockSegments(c).sign],
]

function initVariables(self) {
	const defs = [
		{ variableId: 'connection_state', name: 'Connection state (Online/Offline)' },
		{ variableId: 'clock_status', name: 'Clock sync status' },
		{ variableId: 'page_title', name: 'Producer page title' },
		{ variableId: 'timer_count', name: 'Number of timers' },
		{ variableId: 'cuelight_count', name: 'Number of cue lights' },
		{ variableId: 'scene_undo', name: 'Scene whose recall can be undone' },
		{ variableId: 'scene_undo_remaining', name: 'Seconds left to undo the scene recall' },
	]

	self.timers().forEach((_, i) => {
		const n = i + 1
		for (const [suffix, name] of TIMER_VARS) defs.push({ variableId: `timer_${n}_${suffix}`, name: `Timer ${n}: ${name}` })
	})

	for (const [prefix, key, keyOf, vars] of ENTITY_VARS) {
		for (const x of arr(self.state[key])) {
			const k = sanitize(keyOf(x))
			const who = x.name || keyOf(x)
			for (const [suffix, name] of vars) defs.push({ variableId: `${prefix}_${k}_${suffix}`, name: `${who}: ${name}` })
		}
	}

	self.setVariableDefinitions(defs)
}

function updateVariables(self) {
	const values = {
		connection_state: self.connected ? 'Online' : 'Offline',
		clock_status: self.connected ? self.state.clockStatus : 'Offline',
		page_title: self.state.pageTitle || '',
		timer_count: self.timers().length,
		cuelight_count: self.state.cueLights.length,
		scene_undo: self.state.undoScene ? self.findById('scenes', self.state.undoScene)?.name || self.state.undoScene : '',
		scene_undo_remaining: self.state.undoRemaining == null ? 0 : Math.ceil(self.state.undoRemaining),
	}

	self.timers().forEach((c, i) => {
		for (const [suffix, , value] of TIMER_VARS) values[`timer_${i + 1}_${suffix}`] = value(c)
	})

	for (const [prefix, key, keyOf, vars] of ENTITY_VARS) {
		for (const x of arr(self.state[key])) {
			const k = sanitize(keyOf(x))
			for (const [suffix, , value] of vars) values[`${prefix}_${k}_${suffix}`] = value(x)
		}
	}

	// Offline: never leave a frozen countdown on a button — blank the live times.
	if (!self.connected) {
		for (const id of Object.keys(values)) {
			if (/_(time|remaining_hms)$/.test(id)) values[id] = '--:--'
			else if (/^(timer|clock)_.*_(hh|mm|ss|ff)$/.test(id)) values[id] = '--'
			else if (/^(timer|clock)_.*_(sign|ampm)$/.test(id)) values[id] = ''
			else if (/_(remaining|countdown|progress)$/.test(id)) values[id] = ''
			else if (/_running$/.test(id)) values[id] = 'no'
		}
	}

	self.setVariableValues(values)
}

module.exports = { initVariables, updateVariables, sanitize, fmtHMS, fmtDrift }
