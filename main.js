const { InstanceBase, runEntrypoint } = require('@companion-module/base')
const { UpgradeScripts } = require('./upgrades')
const { GetConfigFields } = require('./config')
const { EMPTY_STATE, normalizeSnapshot, methods } = require('./helpers')
const { definitionMethods } = require('./definitions')

class CadenceInstance extends InstanceBase {
	constructor(internal) {
		super(internal)
		// Latest snapshot from the Cadence producer server; actions, feedbacks and
		// variables all read this one shared source (see helpers.js).
		this.state = normalizeSnapshot(EMPTY_STATE)
		this.connected = false
		this.lastShapeSig = ''
	}

	async init(config) {
		this.config = config
		this.resetConnection()
		this.rebuildDefinitions()
		this.startPolling()
	}

	async destroy() {
		this.stopPolling()
	}

	async configUpdated(config) {
		this.config = config
		this.stopPolling()
		// New host/port = a different producer page: forget the old connection so
		// the first good poll reports OK again.
		this.resetConnection()
		this.startPolling()
	}

	getConfigFields() {
		return GetConfigFields()
	}

	startPolling() {
		this.stopPolling()
		const interval = Math.max(100, Number(this.config.poll) || 250)
		this.poll() // immediate first pull
		this.pollTimer = setInterval(() => this.poll(), interval)
	}

	stopPolling() {
		if (this.pollTimer) {
			clearInterval(this.pollTimer)
			this.pollTimer = undefined
		}
	}

	async poll() {
		// Don't stack requests if Cadence is slow to answer — but remember that a
		// fresh pull was wanted (e.g. right after a command) and run it next.
		if (this.polling) {
			this.repoll = true
			return
		}
		this.polling = true
		this.repoll = false
		const target = this.baseURL()
		try {
			const ctrl = new AbortController()
			const to = setTimeout(() => ctrl.abort(), 4000)
			const res = await fetch(`${target}/api/state`, { signal: ctrl.signal })
			clearTimeout(to)
			if (!res.ok) throw new Error(`HTTP ${res.status}`)
			const snap = await res.json()
			// Ignore a reply from a target the config has since moved away from.
			if (target === this.baseURL()) this.pollSucceeded(snap)
		} catch (e) {
			if (target === this.baseURL()) this.pollFailed(e.name === 'AbortError' ? 'timeout' : e.message)
		} finally {
			this.polling = false
			if (this.repoll) this.poll()
		}
	}
}

Object.assign(CadenceInstance.prototype, methods, definitionMethods)

runEntrypoint(CadenceInstance, UpgradeScripts)
