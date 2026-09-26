// A stand-in Cadence Producer server for offline tests: serves a fixture
// snapshot at GET /api/state and records every POST /api/command body.
const http = require('node:http')

function startMockCadence(snapshot) {
	const commands = []
	let current = snapshot
	const server = http.createServer((req, res) => {
		const send = (status, obj) => {
			res.writeHead(status, { 'Content-Type': 'application/json', Connection: 'close' })
			res.end(JSON.stringify(obj))
		}
		if (req.method === 'GET' && req.url.startsWith('/api/state')) return send(200, current)
		if (req.method === 'POST' && req.url === '/api/command') {
			let body = ''
			req.on('data', (c) => (body += c))
			req.on('end', () => {
				try {
					const cmd = JSON.parse(body)
					commands.push(cmd)
					send(200, { ok: true })
				} catch (e) {
					send(200, { ok: false, error: 'bad json' })
				}
			})
			return
		}
		send(404, { ok: false })
	})
	return new Promise((resolve) => {
		server.listen(0, '127.0.0.1', () => {
			resolve({
				port: server.address().port,
				commands,
				setSnapshot(s) {
					current = s
				},
				close: () => new Promise((r) => server.close(r)),
			})
		})
	})
}

module.exports = { startMockCadence }
