// Every action posts one (or a short sequence of) wire command(s) to the Cadence
// producer server. Entity pickers are dropdowns populated from live state; the
// timer actions also take an "override ID (supports variables)" field so power
// users can target a timer computed from another variable.
//
// Wire reference: AppModel.producerHandleCommand (Cadence) — each command is only
// accepted for entities wired onto the targeted Producer page.
const { parseDuration, parseTimeOfDay } = require('./helpers')

function picker(id, label, choices) {
	return { type: 'dropdown', id, label, default: choices[0]?.id ?? '', choices, allowCustom: true }
}

function idField(label) {
	return {
		type: 'textinput',
		id: 'overrideId',
		label: `${label} — override ID (optional, supports variables)`,
		default: '',
		useVariables: true,
	}
}

async function resolveOverride(self, options) {
	const raw = String(options.overrideId || '').trim()
	if (!raw) return options.pick
	return (await self.parseVariablesInString(raw)).trim()
}

function select(id, label, def, pairs) {
	return { type: 'dropdown', id, label, default: def, choices: pairs.map(([cid, l]) => ({ id: cid, label: l })) }
}

function setActions(self) {
	const actions = {}
	const timerPick = () => [picker('pick', 'Timer', self.timerChoices()), idField('Timer')]

	// ---- Timers --------------------------------------------------------------
	actions.timer_transport = {
		name: 'Timer: Start / Pause / Toggle / Reset',
		options: [
			...timerPick(),
			select('action', 'Action', 'toggle', [
				['start', 'Start'],
				['pause', 'Pause'],
				['toggle', 'Toggle (start/pause)'],
				['reset', 'Reset'],
			]),
		],
		callback: async (event) => {
			const clock = await resolveOverride(self, event.options)
			if (!clock) return
			await self.sendCommand({ action: event.options.action, clock })
		},
	}

	actions.timer_adjust = {
		name: 'Timer: Adjust time (± seconds)',
		options: [
			...timerPick(),
			{
				type: 'textinput',
				id: 'seconds',
				label: 'Seconds (negative subtracts, e.g. -30)',
				default: '60',
				useVariables: true,
			},
		],
		callback: async (event) => {
			const clock = await resolveOverride(self, event.options)
			if (!clock) return
			const raw = String(await self.parseVariablesInString(String(event.options.seconds))).trim()
			if (raw === '') return
			const seconds = Number(raw)
			if (!Number.isFinite(seconds)) return
			await self.sendCommand({ action: 'adjust', clock, seconds })
		},
	}

	actions.timer_set_duration = {
		name: 'Timer: Set duration (resets to it)',
		options: [
			...timerPick(),
			{
				type: 'textinput',
				id: 'value',
				label: 'Duration — "5:00", "1:30:00", "90" (seconds), or a variable',
				default: '5:00',
				useVariables: true,
			},
			{ type: 'checkbox', id: 'thenStart', label: 'Start immediately after setting', default: false },
		],
		callback: async (event) => {
			const clock = await resolveOverride(self, event.options)
			if (!clock) return
			const seconds = parseDuration(await self.parseVariablesInString(String(event.options.value)))
			if (seconds == null) return
			await self.sendCommand({ action: 'setDuration', clock, seconds })
			if (event.options.thenStart) await self.sendCommand({ action: 'start', clock })
		},
	}

	actions.timer_set_remaining = {
		name: 'Timer: Set remaining (keeps running)',
		description: 'Change the time left without stopping the timer — the producer page’s Edit time.',
		options: [
			...timerPick(),
			{
				type: 'textinput',
				id: 'value',
				label: 'Remaining — "4:30", "90", or a variable',
				default: '5:00',
				useVariables: true,
			},
		],
		callback: async (event) => {
			const clock = await resolveOverride(self, event.options)
			if (!clock) return
			const seconds = parseDuration(await self.parseVariablesInString(String(event.options.value)))
			if (seconds == null) return
			await self.sendCommand({ action: 'setTime', clock, seconds })
		},
	}

	actions.timer_end_at = {
		name: 'Timer: End at time of day',
		description:
			'Re-seat the timer so it hits zero at a wall-clock time. For a "time till" timer this moves its target time.',
		options: [
			...timerPick(),
			{
				type: 'textinput',
				id: 'time',
				label: 'Time of day — "14:30", "2:30 PM", "2:30:15pm", or a variable',
				default: '2:30 PM',
				useVariables: true,
			},
		],
		callback: async (event) => {
			const clock = await resolveOverride(self, event.options)
			if (!clock) return
			const seconds = parseTimeOfDay(await self.parseVariablesInString(String(event.options.time)))
			if (seconds == null) {
				self.log('warn', `Not a time of day: "${event.options.time}"`)
				return
			}
			// Anchored "time till" timers have no runtime to re-seat — move the target.
			const anchored = !!self.findClock(clock)?.anchored
			await self.sendCommand({ action: anchored ? 'setTill' : 'setEndTime', clock, seconds })
		},
	}

	actions.timer_edit_slot = {
		name: 'Timer: Load edit-window preset slot',
		description: 'Load one of the timer’s four saved Edit-window presets (set on the producer page).',
		options: [
			...timerPick(),
			select('slot', 'Slot', '0', [
				['0', 'Slot 1'],
				['1', 'Slot 2'],
				['2', 'Slot 3'],
				['3', 'Slot 4'],
			]),
			{ type: 'checkbox', id: 'thenStart', label: 'Start immediately after loading', default: false },
		],
		callback: async (event) => {
			const clock = await resolveOverride(self, event.options)
			if (!clock) return
			const seconds = self.findClock(clock)?.presets?.[Number(event.options.slot)]
			if (seconds == null) {
				self.log('warn', `Timer ${clock} has nothing saved in slot ${Number(event.options.slot) + 1}`)
				return
			}
			await self.sendCommand({ action: 'setDuration', clock, seconds })
			if (event.options.thenStart) await self.sendCommand({ action: 'start', clock })
		},
	}

	actions.timer_undo = {
		name: 'Timer: Undo last edit',
		description: 'Take back the last Set / adjust / reset on this timer (within 60 s of the edit).',
		options: [...timerPick()],
		callback: async (event) => {
			const clock = await resolveOverride(self, event.options)
			if (!clock) return
			await self.sendCommand({ action: 'undo', clock })
		},
	}

	// ---- Time Shift (rehearsal speed) -----------------------------------------
	actions.shift_rate = {
		name: 'Time Shift: Set rate',
		description: 'Run the shifted timers faster or slower (1 = real time).',
		options: [
			picker('shift', 'Time Shift', self.shiftChoices()),
			{
				type: 'textinput',
				id: 'value',
				label: 'Rate (e.g. 1, 0.95, 1.1) — supports variables',
				default: '1',
				useVariables: true,
			},
		],
		callback: async (event) => {
			if (!event.options.shift) return
			const value = Number(await self.parseVariablesInString(String(event.options.value)))
			if (!Number.isFinite(value) || value <= 0) return
			await self.sendCommand({ action: 'shiftRate', id: event.options.shift, value })
		},
	}

	// ---- ProPresenter timer control -------------------------------------------
	actions.propresenter_timer = {
		name: 'ProPresenter: Start / Stop / Reset timer',
		description: 'Drive a ProPresenter timer through a Cadence ProPresenter clock in control mode.',
		options: [
			picker('clock', 'ProPresenter clock', self.proPresenterChoices()),
			select('action', 'Action', 'ppStart', [
				['ppStart', 'Start'],
				['ppStop', 'Stop'],
				['ppReset', 'Reset'],
			]),
		],
		callback: async (event) => {
			if (!event.options.clock) return
			await self.sendCommand({ action: event.options.action, clock: event.options.clock })
		},
	}

	// ---- Presets ----------------------------------------------------------------
	actions.preset_apply = {
		name: 'Preset: Load into wired timers',
		options: [
			picker('preset', 'Preset', self.allPresetChoices()),
			select('mode', 'Mode', 'set', [
				['set', 'Set (load duration)'],
				['setStart', 'Set & Start'],
				['select', 'Arm only (highlight, no load)'],
			]),
		],
		callback: async (event) => {
			// "bank::preset" from the flat dropdown; older configs stored them apart.
			let bank = event.options.bank
			let preset = event.options.preset
			if (String(preset).includes('::')) [bank, preset] = String(preset).split('::')
			if (!bank || !preset) return
			// Select arms the preset on the bank; then Set (or Set & Start) applies it.
			await self.sendCommand({ action: 'presetSelect', bank, preset })
			if (event.options.mode === 'select') return
			await self.sendCommand({ action: event.options.mode === 'setStart' ? 'presetSetStart' : 'presetSet', bank })
		},
	}

	// ---- Schedule (run of show) -------------------------------------------------
	actions.schedule_control = {
		name: 'Schedule: Set / Start / Next / Prev / Correct',
		options: [
			picker('schedule', 'Schedule', self.scheduleChoices()),
			select('action', 'Action', 'schedSet', [
				['schedSet', 'Set on-deck cue into timers'],
				['schedSetStart', 'Set on-deck & Start'],
				['schedSetStartNext', 'Set on-deck, Start & advance'],
				['schedSetQueue', 'Add on-deck to Cue Stack'],
				['schedNext', 'Next cue'],
				['schedPrev', 'Previous cue'],
				['schedCorrectStart', 'Correct running timer to sheet START time'],
				['schedCorrectEnd', 'Correct running timer to sheet END time'],
				['schedRefresh', 'Refresh from Google Sheet now'],
			]),
		],
		callback: async (event) => {
			if (!event.options.schedule) return
			await self.sendCommand({ action: event.options.action, schedule: event.options.schedule })
		},
	}

	actions.schedule_jump = {
		name: 'Schedule: Jump to cue',
		options: [
			picker('schedule', 'Schedule', self.scheduleChoices()),
			select('by', 'Jump by', 'cue', [
				['cue', 'Cue number from the sheet (e.g. 12)'],
				['row', 'Row position (1 = first row)'],
			]),
			{ type: 'textinput', id: 'target', label: 'Cue # / row — supports variables', default: '1', useVariables: true },
		],
		callback: async (event) => {
			if (!event.options.schedule) return
			const target = String(await self.parseVariablesInString(String(event.options.target))).trim()
			if (!target) return
			if (event.options.by === 'row') {
				const n = Number(target)
				if (!Number.isInteger(n) || n < 1) return
				await self.sendCommand({ action: 'schedJump', schedule: event.options.schedule, index: n - 1 })
			} else {
				await self.sendCommand({ action: 'schedJumpCue', schedule: event.options.schedule, cue: target })
			}
		},
	}

	// ---- Scheduler (timecode / time-of-day trigger table) ----------------------
	actions.scheduler_control = {
		name: 'Scheduler: Arm / Disarm / Toggle / Fire next',
		options: [
			picker('scheduler', 'Scheduler', self.schedulerChoices()),
			select('action', 'Action', 'schArm', [
				['schArm', 'Arm'],
				['schDisarm', 'Disarm'],
				['toggle', 'Toggle armed'],
				['schFireNext', 'Fire next row now'],
			]),
		],
		callback: async (event) => {
			const scheduler = event.options.scheduler
			if (!scheduler) return
			let action = event.options.action
			if (action === 'toggle') action = self.findById('schedulers', scheduler)?.armed ? 'schDisarm' : 'schArm'
			await self.sendCommand({ action, scheduler })
		},
	}

	// ---- Scene --------------------------------------------------------------------
	actions.scene_recall = {
		name: 'Scene: Recall',
		options: [picker('scene', 'Scene', self.sceneChoices())],
		callback: async (event) => {
			if (!event.options.scene) return
			await self.sendCommand({ action: 'recallScene', scene: event.options.scene })
		},
	}

	actions.scene_undo = {
		name: 'Scene: Undo last recall',
		description: 'Undo the most recent scene recall while its undo window is still open.',
		options: [],
		callback: async () => {
			const scene = self.state.undoScene
			if (!scene) return
			await self.sendCommand({ action: 'undoRecall', scene })
		},
	}

	// ---- Message --------------------------------------------------------------------
	actions.message_visibility = {
		name: 'Message: Set on-air state',
		options: [
			picker('message', 'Message', self.messageChoices()),
			select('vis', 'State', 'shown', [
				['hidden', 'Hidden'],
				['shown', 'Shown'],
				['flashing', 'Flashing'],
				['toggle', 'Toggle shown / hidden'],
			]),
		],
		callback: async (event) => {
			const message = event.options.message
			if (!message) return
			let vis = event.options.vis
			if (vis === 'toggle')
				vis = (self.findById('messages', message)?.vis || 'hidden') === 'hidden' ? 'shown' : 'hidden'
			await self.sendCommand({ action: 'msgVis', message, vis })
		},
	}

	actions.message_text = {
		name: 'Message: Set text',
		options: [
			picker('message', 'Message', self.messageChoices()),
			{ type: 'textinput', id: 'text', label: 'Text (supports variables)', default: '', useVariables: true },
			{ type: 'checkbox', id: 'show', label: 'Also put it on air (Shown)', default: false },
		],
		callback: async (event) => {
			const message = event.options.message
			if (!message) return
			const text = await self.parseVariablesInString(String(event.options.text || ''))
			await self.sendCommand({ action: 'msgText', message, text })
			if (event.options.show) await self.sendCommand({ action: 'msgVis', message, vis: 'shown' })
		},
	}

	// ---- Automation -------------------------------------------------------------------
	actions.automation_arm = {
		name: 'Automation: Arm / Disarm / Toggle',
		options: [
			picker('automation', 'Automation', self.automationChoices()),
			select('armed', 'State', 'true', [
				['true', 'Armed'],
				['false', 'Disarmed'],
				['toggle', 'Toggle'],
			]),
		],
		callback: async (event) => {
			const automation = event.options.automation
			if (!automation) return
			const armed =
				event.options.armed === 'toggle'
					? !self.findById('automations', automation)?.armed
					: event.options.armed === 'true'
			await self.sendCommand({ action: 'autoArm', automation, armed })
		},
	}

	actions.automation_time = {
		name: 'Automation: Set trigger time',
		options: [
			picker('automation', 'Automation', self.automationChoices()),
			{
				type: 'textinput',
				id: 'time',
				label: 'Time of day — "14:30", "2:30 PM", or a variable',
				default: '2:30 PM',
				useVariables: true,
			},
		],
		callback: async (event) => {
			const automation = event.options.automation
			if (!automation) return
			const t = parseTimeOfDay(await self.parseVariablesInString(String(event.options.time)))
			if (t == null) return
			await self.sendCommand({
				action: 'autoTime',
				automation,
				hour: Math.floor(t / 3600),
				minute: Math.floor((t % 3600) / 60),
				second: t % 60,
			})
		},
	}

	// ---- Cue Stack (queued times per timer, top first) -------------------------
	actions.cuestack_control = {
		name: 'Cue Stack: GO / Load / Remove top / Clear',
		options: [
			picker('clock', 'Cue Stack (timer)', self.cueStackChoices()),
			select('action', 'Action', 'stackGo', [
				['stackGo', 'GO — load top cue and start'],
				['stackLoad', 'Load top cue (don’t start)'],
				['stackRemove', 'Remove top cue'],
				['stackClear', 'Clear the stack'],
			]),
		],
		callback: async (event) => {
			if (!event.options.clock) return
			await self.sendCommand({ action: event.options.action, clock: event.options.clock })
		},
	}

	actions.cuestack_add = {
		name: 'Cue Stack: Add a time',
		options: [
			picker('clock', 'Cue Stack (timer)', self.cueStackChoices()),
			{
				type: 'textinput',
				id: 'value',
				label: 'Time — "5:00", "90", or a variable',
				default: '5:00',
				useVariables: true,
			},
			{ type: 'textinput', id: 'label', label: 'Label (optional)', default: '', useVariables: true },
		],
		callback: async (event) => {
			if (!event.options.clock) return
			const seconds = parseDuration(await self.parseVariablesInString(String(event.options.value)))
			if (seconds == null) return
			const label = String(await self.parseVariablesInString(String(event.options.label || ''))).trim()
			const body = { action: 'stackAdd', clock: event.options.clock, seconds }
			if (label) body.label = label
			await self.sendCommand(body)
		},
	}

	// ---- Audience polls --------------------------------------------------------------
	actions.poll_control = {
		name: 'Poll: Open / Close / Next / Reveal …',
		options: [
			picker('poll', 'Poll', self.pollChoices()),
			select('action', 'Action', 'pollOpen', [
				['pollOpen', 'Open voting'],
				['pollClose', 'Close voting'],
				['toggleOpen', 'Toggle open / closed'],
				['pollReady', 'Back to ready (not yet open)'],
				['pollNext', 'Next question'],
				['pollPrev', 'Previous question'],
				['reveal', 'Reveal results on screen'],
				['hide', 'Hide results on screen'],
				['toggleReveal', 'Toggle on-screen reveal'],
				['pollReset', 'Reset votes (this question)'],
			]),
		],
		callback: async (event) => {
			const poll = event.options.poll
			if (!poll) return
			const p = self.findById('polls', poll)
			switch (event.options.action) {
				case 'toggleOpen':
					return self.sendCommand({ action: p?.state === 'open' ? 'pollClose' : 'pollOpen', poll })
				case 'reveal':
					return self.sendCommand({ action: 'pollReveal', poll, on: true })
				case 'hide':
					return self.sendCommand({ action: 'pollReveal', poll, on: false })
				case 'toggleReveal':
					return self.sendCommand({ action: 'pollReveal', poll, on: !p?.revealed })
				default:
					return self.sendCommand({ action: event.options.action, poll })
			}
		},
	}

	actions.poll_go = {
		name: 'Poll: Go to question',
		options: [
			picker('poll', 'Poll', self.pollChoices()),
			{ type: 'textinput', id: 'number', label: 'Question number (1 = first)', default: '1', useVariables: true },
		],
		callback: async (event) => {
			if (!event.options.poll) return
			const n = Number(await self.parseVariablesInString(String(event.options.number)))
			if (!Number.isInteger(n) || n < 1) return
			await self.sendCommand({ action: 'pollGo', poll: event.options.poll, index: n - 1 })
		},
	}

	actions.poll_results_mode = {
		name: 'Poll: Results on phones',
		options: [
			picker('poll', 'Poll', self.pollChoices()),
			select('mode', 'Phones see results', 'afterVote', [
				['hidden', 'Never'],
				['afterVote', 'After they vote'],
				['live', 'Live, always'],
			]),
		],
		callback: async (event) => {
			if (!event.options.poll) return
			await self.sendCommand({ action: 'pollResults', poll: event.options.poll, mode: event.options.mode })
		},
	}

	// Simulate votes: a local rehearsal — ~5 s of weighted fake votes stream into
	// the current question, then reveal. Real votes are untouched; phones show the
	// fake tally marked "simulated". Cadence refuses it on pages with Simulate off.
	actions.poll_simulate = {
		name: 'Poll: Simulate votes (rehearsal)',
		description: 'Stream fake votes into the current question to rehearse the graphics. Real votes are never touched.',
		options: [
			picker('poll', 'Poll', self.pollChoices()),
			select('action', 'Action', 'toggle', [
				['start', 'Start simulating (fake votes stream, then reveal)'],
				['stop', 'Stop — back to the real results'],
				['toggle', 'Toggle start / stop'],
				['reveal', 'Reveal simulated results'],
				['hide', 'Hide simulated results'],
				['toggleReveal', 'Toggle simulated reveal'],
				['open', 'Simulated voting: open'],
				['close', 'Simulated voting: closed (stops the stream)'],
				['ready', 'Simulated voting: ready'],
			]),
		],
		callback: async (event) => {
			const poll = event.options.poll
			if (!poll) return
			const p = self.findById('polls', poll)
			switch (event.options.action) {
				case 'start':
					return self.sendCommand({ action: 'pollSimulate', poll })
				case 'stop':
					return self.sendCommand({ action: 'pollSimStop', poll })
				case 'toggle':
					return self.sendCommand({ action: p?.simulating ? 'pollSimStop' : 'pollSimulate', poll })
				case 'reveal':
					return self.sendCommand({ action: 'pollSimReveal', poll, on: true })
				case 'hide':
					return self.sendCommand({ action: 'pollSimReveal', poll, on: false })
				case 'toggleReveal':
					return self.sendCommand({ action: 'pollSimReveal', poll, on: !p?.simRevealed })
				case 'open':
				case 'close':
				case 'ready':
					return self.sendCommand({
						action: 'pollSimState',
						poll,
						mode: event.options.action === 'close' ? 'closed' : event.options.action,
					})
			}
		},
	}

	self.setActionDefinitions(actions)
}

module.exports = { setActions }
