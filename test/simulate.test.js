// Poll "Simulate votes" control: wire bodies (pollSimulate / pollSimStop /
// pollSimReveal / pollSimState), toggles that read the live sim state, the
// feedback phases, variables, and Cadence refusing it on a Simulate-off page.
const { test, before, after, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const { startMockCadence } = require('./mock-cadence')
const { makeFakeSelf, runAction, runFeedback } = require('./fake-self')
const FIXTURE = require('./fixture-snapshot.json')

// The fixture poll with a simulation in progress (fake votes streaming, not yet revealed).
const SIMULATING = {
	...FIXTURE,
	polls: FIXTURE.polls.map((p) => ({ ...p, simulating: true, simStreaming: true, simRevealed: false, simState: 'open' })),
}

let mock, self
before(async () => {
	mock = await startMockCadence(FIXTURE)
	self = makeFakeSelf({}, { port: mock.port })
	self.pollSucceeded(FIXTURE)
})
after(() => mock.close())
let mark = 0
beforeEach(() => (mark = mock.commands.length))
const sent = () => mock.commands.slice(mark)

test('not simulating: toggle starts, sim state reads off', async () => {
	assert.equal(self._varValues.poll_poll_1_simulating, 'no')
	assert.equal(self._varValues.poll_poll_1_sim_state, 'off')
	assert.equal(runFeedback(self, 'poll_simulating', { poll: 'poll-1', when: 'simulating' }), false)
	await runAction(self, 'poll_simulate', { poll: 'poll-1', action: 'toggle' })
	assert.deepEqual(sent(), [{ action: 'pollSimulate', poll: 'poll-1' }])
})

test('simulating: toggle stops, reveal toggles on, phases drive feedback', async () => {
	self.pollSucceeded(SIMULATING)
	assert.equal(self._varValues.poll_poll_1_simulating, 'yes')
	assert.equal(self._varValues.poll_poll_1_sim_state, 'open')
	assert.equal(runFeedback(self, 'poll_simulating', { poll: 'poll-1', when: 'simulating' }), true)
	assert.equal(runFeedback(self, 'poll_simulating', { poll: 'poll-1', when: 'streaming' }), true)
	assert.equal(runFeedback(self, 'poll_simulating', { poll: 'poll-1', when: 'revealed' }), false)

	await runAction(self, 'poll_simulate', { poll: 'poll-1', action: 'toggleReveal' })
	await runAction(self, 'poll_simulate', { poll: 'poll-1', action: 'toggle' })
	assert.deepEqual(sent(), [
		{ action: 'pollSimReveal', poll: 'poll-1', on: true },
		{ action: 'pollSimStop', poll: 'poll-1' },
	])
	self.pollSucceeded(FIXTURE)
})

test('explicit start / stop / reveal / hide / sim voting states', async () => {
	for (const action of ['start', 'stop', 'reveal', 'hide', 'open', 'close', 'ready'])
		await runAction(self, 'poll_simulate', { poll: 'poll-1', action })
	assert.deepEqual(sent(), [
		{ action: 'pollSimulate', poll: 'poll-1' },
		{ action: 'pollSimStop', poll: 'poll-1' },
		{ action: 'pollSimReveal', poll: 'poll-1', on: true },
		{ action: 'pollSimReveal', poll: 'poll-1', on: false },
		{ action: 'pollSimState', poll: 'poll-1', mode: 'open' },
		{ action: 'pollSimState', poll: 'poll-1', mode: 'closed' },
		{ action: 'pollSimState', poll: 'poll-1', mode: 'ready' },
	])
})

test('simulate never touches real voting', async () => {
	const actions = self._actions.poll_simulate.options.find((o) => o.id === 'action').choices.map((c) => c.id)
	for (const action of actions) await runAction(self, 'poll_simulate', { poll: 'poll-1', action })
	const real = sent().filter((c) => !c.action.startsWith('pollSim') && c.action !== 'pollSimulate')
	assert.deepEqual(real, [])
})

test('page with Simulate off: Cadence refuses, module logs it, nothing throws', async () => {
	const off = await startMockCadence(FIXTURE, {
		reject: (c) => (c.action.startsWith('pollSim') ? 'Simulate is off for this page.' : null),
	})
	try {
		const s = makeFakeSelf({}, { port: off.port })
		s.pollSucceeded(FIXTURE)
		await runAction(s, 'poll_simulate', { poll: 'poll-1', action: 'start' })
		assert.ok(s.logs.some((l) => l.level === 'warn' && l.msg.includes('Simulate is off for this page.')))
	} finally {
		await off.close()
	}
})

test('presets: simulate + sim-reveal buttons per poll', () => {
	assert.ok('poll_poll_1_simulate' in self._presets)
	assert.ok('poll_poll_1_sim_reveal' in self._presets)
	assert.equal(self._presets.poll_poll_1_simulate.steps[0].down[0].actionId, 'poll_simulate')
})
