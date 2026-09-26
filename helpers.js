// State helpers shared by the Companion instance (main.js) and the offline
// tests. Mixed onto the instance, so every method reads `this.state` — the
// latest /api/state snapshot from a Cadence Producer server.

const LIST_KEYS = [
	'clocks',
	'shifts',
	'cueLights',
	'presetBanks',
	'schedules',
	'schedulers',
	'scenes',
	'messages',
	'automations',
	'cueStacks',
	'polls',
]

const EMPTY_STATE = Object.freeze({ clockStatus: '', now: 0 })

function arr(v) {
	return Array.isArray(v) ? v : []
}

// Normalise a raw snapshot into the module's state shape (missing keys → empty),
// so older Cadence builds that lack a section simply expose nothing for it.
function normalizeSnapshot(snap) {
	snap = snap || {}
	const state = {
		clockStatus: snap.clockStatus || '',
		now: snap.now || Date.now() / 1000,
		pageTitle: snap.page?.title || '',
		undoScene: snap.undoScene || null,
		undoRemaining: typeof snap.undoRemaining === 'number' ? snap.undoRemaining : null,
	}
	for (const k of LIST_KEYS) state[k] = arr(snap[k])
	return state
}

// "5:00", "1:02:03", "90" → seconds (null if unparseable).
function parseDuration(input) {
	const s = String(input ?? '').trim()
	if (s === '') return null
	if (s.includes(':')) {
		const parts = s.split(':').map((p) => Number(p))
		if (parts.length > 3 || parts.some((n) => !Number.isFinite(n) || n < 0)) return null
		let secs = 0
		for (const p of parts) secs = secs * 60 + p
		return Math.round(secs)
	}
	const n = Number(s)
	return Number.isFinite(n) ? Math.round(n) : null
}

// "14:30", "2:30 PM", "2:30:15pm", "9am" → seconds since midnight (null if bad).
function parseTimeOfDay(input) {
	const m = /^\s*(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*([ap])?\.?\s*m?\.?\s*$/i.exec(String(input ?? ''))
	if (!m) return null
	let h = Number(m[1])
	const min = Number(m[2] || 0)
	const sec = Number(m[3] || 0)
	if (min > 59 || sec > 59) return null
	if (m[4]) {
		if (h < 1 || h > 12) return null
		const pm = m[4].toLowerCase() === 'p'
		if (h === 12) h = pm ? 12 : 0
		else if (pm) h += 12
	} else if (h > 23) return null
	return h * 3600 + min * 60 + sec
}

const choice = (list, label) => list.map((x) => ({ id: x.id, label: label ? label(x) : x.name || x.id }))

// Companion connection status values (mirrors @companion-module/base's
// InstanceStatus, kept local so the offline tests don't need the IPC runtime).
const Status = { Ok: 'ok', Connecting: 'connecting', ConnectionFailure: 'connection_failure' }

const methods = {
	// Forget the previous target entirely — call whenever host/port change, so the
	// next successful poll reports OK again (and definitions rebuild for the new
	// producer page's entities).
	resetConnection() {
		this.connected = false
		this.lastShapeSig = ''
		this.updateStatus(Status.Connecting)
	},

	// A poll succeeded: take the snapshot and (re)report OK if we weren't already.
	pollSucceeded(snap) {
		// Mark connected BEFORE applying, so the values pushed now are live ones
		// (updateVariables blanks times while disconnected).
		const wasConnected = this.connected
		this.connected = true
		this.applySnapshot(snap)
		if (!wasConnected) this.updateStatus(Status.Ok)
	},

	// A poll failed: report once per outage, and blank live values so buttons
	// don't show a frozen countdown.
	pollFailed(message) {
		if (this.connected || this.lastShapeSig !== 'DOWN') {
			this.connected = false
			this.lastShapeSig = 'DOWN'
			this.updateStatus(Status.ConnectionFailure, message || 'no response')
			this.refreshValues()
		}
	},

	applySnapshot(snap) {
		this.state = normalizeSnapshot(snap)
		// Rebuild dropdowns/variable definitions only when the set of entities
		// changes — values change every tick, the option lists rarely do.
		const sig = this.shapeSignature()
		if (sig !== this.lastShapeSig) {
			this.lastShapeSig = sig
			this.rebuildDefinitions()
		}
		this.refreshValues()
	},

	baseURL() {
		const host = String(this.config?.host || '127.0.0.1').trim()
		const port = this.config?.port || 8730
		return `http://${host}:${port}`
	},

	// POST a command to the Cadence producer server. `body` is the wire object.
	// Resolves to the ack ({ok, error}); never throws.
	async sendCommand(body) {
		try {
			const res = await fetch(`${this.baseURL()}/api/command`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			})
			if (!res.ok) throw new Error(`HTTP ${res.status}`)
			const ack = await res.json().catch(() => ({}))
			if (ack && ack.ok === false) {
				this.log('warn', `Cadence rejected command: ${ack.error || 'unknown'} (${JSON.stringify(body)})`)
			}
			// Pull fresh state immediately so buttons reflect the change without
			// waiting for the next poll tick.
			this.poll()
			return ack
		} catch (e) {
			this.log('error', `Command failed: ${e.message}`)
			return { ok: false, error: e.message }
		}
	},

	// A signature of the entity *shape* (which timers/cue lights/etc. exist) so
	// dropdowns and variable definitions are rebuilt only when the set changes,
	// not on every poll (values change constantly; the option lists rarely do).
	shapeSignature() {
		const s = this.state
		const ids = (list, extra) => arr(list).map((x) => (extra ? extra(x) : x.id)).join(',')
		return [
			ids(s.clocks, (c) => `${c.id}:${c.kind}:${c.ppControl ? 'pp' : ''}`),
			ids(s.shifts),
			ids(s.cueLights),
			ids(s.presetBanks, (b) => `${b.id}:${arr(b.presets).map((p) => p.id).join('|')}`),
			ids(s.schedules),
			ids(s.schedulers),
			ids(s.scenes),
			ids(s.messages),
			ids(s.automations),
			ids(s.cueStacks, (c) => c.clock),
			ids(s.polls),
		].join(';;')
	},

	timers() {
		return this.state.clocks.filter((c) => c.kind === 'countdown')
	},

	timerChoices() {
		return choice(this.timers())
	},
	clockChoices() {
		return choice(this.state.clocks, (c) => `${c.name || c.id} (${c.kind})`)
	},
	proPresenterChoices() {
		return choice(this.state.clocks.filter((c) => c.ppControl))
	},
	shiftChoices() {
		return choice(this.state.shifts)
	},
	cueLightChoices() {
		return choice(this.state.cueLights)
	},
	presetBankChoices() {
		return choice(this.state.presetBanks)
	},
	presetChoices(bankId) {
		const bank = this.state.presetBanks.find((b) => b.id === bankId) || this.state.presetBanks[0]
		return arr(bank?.presets).map((p) => ({ id: p.id, label: `${p.label} (${p.time})` }))
	},
	// Every preset across every bank, labelled with its bank — one flat dropdown,
	// so a button can't end up pointing at a preset from the wrong bank.
	allPresetChoices() {
		const out = []
		for (const b of this.state.presetBanks)
			for (const p of arr(b.presets)) out.push({ id: `${b.id}::${p.id}`, label: `${b.name || b.id} › ${p.label} (${p.time})` })
		return out
	},
	scheduleChoices() {
		return choice(this.state.schedules)
	},
	schedulerChoices() {
		return choice(this.state.schedulers)
	},
	sceneChoices() {
		return choice(this.state.scenes)
	},
	messageChoices() {
		return choice(this.state.messages)
	},
	automationChoices() {
		return choice(this.state.automations)
	},
	// Cue stacks are addressed by the timer they drive.
	cueStackChoices() {
		return this.state.cueStacks.map((s) => ({ id: s.clock, label: s.name || s.clock }))
	},
	pollChoices() {
		return choice(this.state.polls)
	},

	findClock(id) {
		return this.state.clocks.find((c) => c.id === id)
	},
	findCueLight(id) {
		return this.state.cueLights.find((c) => c.id === id)
	},
	findById(key, id) {
		return arr(this.state[key]).find((x) => x.id === id)
	},
	findCueStack(clockId) {
		return this.state.cueStacks.find((s) => s.clock === clockId)
	},
}

module.exports = { Status, EMPTY_STATE, LIST_KEYS, normalizeSnapshot, parseDuration, parseTimeOfDay, methods, arr }
