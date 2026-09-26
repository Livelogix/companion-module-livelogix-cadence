const { Regex } = require('@companion-module/base')

function GetConfigFields() {
	return [
		{
			type: 'static-text',
			id: 'info',
			width: 12,
			label: 'About',
			value:
				'Connects to a Cadence Producer server over your LAN. Point this at the Mac running Cadence and the port of the Producer node you want to drive (or the app-wide producer page, default 8730). Actions control timers, presets, schedules and more; variables and feedbacks bring live time and status back into Companion.',
		},
		{
			type: 'textinput',
			id: 'host',
			label: 'Cadence Host (IP address)',
			width: 8,
			default: '127.0.0.1',
			regex: Regex.HOSTNAME,
		},
		{
			type: 'number',
			id: 'port',
			label: 'Producer Port',
			width: 4,
			default: 8730,
			min: 1,
			max: 65535,
		},
		{
			type: 'number',
			id: 'poll',
			label: 'Poll interval (ms) — how often to refresh live time',
			width: 6,
			default: 250,
			min: 100,
			max: 10000,
		},
	]
}

module.exports = { GetConfigFields }
