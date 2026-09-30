// Run the mock Cadence standalone (fixture snapshot, logs every command) — for
// pointing a real Companion at it without touching a live show.
//   node test/serve-mock.js [port]
const http = require('node:http')
const FIXTURE = require('./fixture-snapshot.json')

const port = Number(process.argv[2] || 18730)
http
	.createServer((req, res) => {
		const send = (obj) => {
			res.writeHead(200, { 'Content-Type': 'application/json', Connection: 'close' })
			res.end(JSON.stringify(obj))
		}
		if (req.method === 'GET' && (req.url.startsWith('/api/state') || req.url.startsWith('/api/show/state')))
			return send(FIXTURE)
		let body = ''
		req.on('data', (c) => (body += c))
		req.on('end', () => {
			console.log(`COMMAND ${body}`)
			send({ ok: true })
		})
	})
	.listen(port, '127.0.0.1', () => console.log(`mock Cadence on :${port}`))
