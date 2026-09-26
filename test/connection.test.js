// Connection-status lifecycle — regression for the v1 bug where editing the
// connection (host/port) left it stuck on "connecting" forever: configUpdated
// set Connecting but never cleared `connected`, so the next good poll never
// re-reported OK.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { makeFakeSelf } = require('./fake-self')
const FIXTURE = require('./fixture-snapshot.json')

test('first good poll reports OK once', () => {
	const self = makeFakeSelf({})
	self.connected = false
	self.resetConnection()
	self.pollSucceeded(FIXTURE)
	self.pollSucceeded(FIXTURE)
	assert.deepEqual(self.statuses, ['connecting', 'ok'])
})

test('editing the connection re-reports OK after the next good poll', () => {
	const self = makeFakeSelf({})
	self.resetConnection()
	self.pollSucceeded(FIXTURE)
	// user changes the port → configUpdated → resetConnection
	self.resetConnection()
	self.pollSucceeded(FIXTURE)
	assert.deepEqual(self.statuses, ['connecting', 'ok', 'connecting', 'ok'])
	assert.equal(self.connected, true)
})

test('outage reported once, recovery reports OK, definitions rebuilt on new target', () => {
	const self = makeFakeSelf({})
	self.resetConnection()
	self.pollSucceeded(FIXTURE)
	self.pollFailed('timeout')
	self.pollFailed('timeout')
	assert.equal(self._varValues.timer_1_time, '--:--')
	self.pollSucceeded(FIXTURE)
	assert.deepEqual(self.statuses, ['connecting', 'ok', 'connection_failure:timeout', 'ok'])
	assert.equal(self._varValues.timer_1_time, '0:12')

	// pointing at a different (empty) page rebuilds the dropdowns
	self.resetConnection()
	self.pollSucceeded({ clocks: [] })
	assert.equal(self._actions.timer_transport.options[0].choices.length, 0)
})
