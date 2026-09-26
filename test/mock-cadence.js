// A stand-in Cadence server for offline tests: serves a fixture snapshot on both
// the Producer-page route (/api/state) and the whole-show route (/api/show/state),
// and records every command body (+ which path it came in on).
const http = require('node:http')

// `reject(cmd)` may return an error string to answer {ok:false, error} the way
// Cadence refuses a command (e.g. Simulate switched off for the page).
// `noShowRoutes` mimics an older Cadence without whole-show control (404).
// `showState` overrides what /api/show/state returns (e.g. a refusal).
function startMockCadence(snapshot, { reject, noShowRoutes, showState } = {}) {
	const commands = []
	const paths = []
	let current = snapshot
	const server = http.createServer((req, res) => {
		const send = (status, obj) => {
			res.writeHead(status, { 'Content-Type': 'application/json', Connection: 'close' })
			res.end(JSON.stringify(obj))
		}
		const isShow = req.url.startsWith('/api/show/')
		if (isShow && noShowRoutes) return send(404, { ok: false })
		if (req.method === 'GET' && (req.url.startsWith('/api/state') || req.url === '/api/show/state'))
			return send(200, isShow && showState ? showState : current)
		if (req.method === 'POST' && (req.url === '/api/command' || req.url === '/api/show/command')) {
			let body = ''
			req.on('data', (c) => (body += c))
			req.on('end', () => {
				try {
					const cmd = JSON.parse(body)
					commands.push(cmd)
					paths.push(req.url)
					const error = reject?.(cmd)
					send(200, error ? { ok: false, error } : { ok: true })
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
				paths,
				setSnapshot(s) {
					current = s
				},
				close: () => new Promise((r) => server.close(r)),
			})
		})
	})
}

module.exports = { startMockCadence }
