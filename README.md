# companion-module-livelogix-cadence

A [Bitfocus Companion](https://bitfocus.io/companion) module for **LiveLogix Cadence**: timers, presets, schedules, cue stacks, polls, messages, scenes, automations and cue lights, with live time, status and tally feedback.

It talks to a Cadence **Producer server** over the LAN: `GET /api/state` for a live snapshot (polled) and `POST /api/command` to drive it. That's the same HTTP surface Cadence's own Producer web page uses (`AppModel.producerHandleCommand` in the Cadence app is the wire reference).

See [companion/HELP.md](companion/HELP.md) for actions, feedbacks, variables and setup.

## Developing / loading into Companion

Companion loads external modules from a developer folder:

1. Companion → **Settings → Developer modules path** → point it at a folder that **contains** this module directory (on Jason's Mac, `~/Documents/companion-dev-modules/livelogix-cadence` is a symlink to it).
2. Add a connection and search for **Cadence**.

```sh
npm install           # @companion-module/base
npm test              # offline suite — real action code against a mock Cadence
npm run smoke -- 8741 # read-only smoke test against a RUNNING Cadence producer port
node test/serve-mock.js 18730   # standalone mock Cadence for pointing a real Companion at
```

## Layout

| File | Role |
| --- | --- |
| `main.js` | Companion lifecycle + polling (thin) |
| `helpers.js` | state normalisation, parsers, connection-status transitions, `sendCommand`, choice/find helpers — mixed onto the instance |
| `definitions.js` | rebuild definitions / push values — mixed onto the instance |
| `config.js` | connection settings (host / port / poll interval) |
| `actions.js` | control commands |
| `feedbacks.js` | button styling from live state |
| `variables.js` | live readouts (table-driven per entity) |
| `presets.js` | ready-made buttons |
| `test/` | mock Cadence, fake instance, fixture snapshot, node:test suites |
| `companion/manifest.json` | Companion module manifest |
| `companion/HELP.md` | in-app help |

The tests run the module's real `helpers`/`definitions` mixins on a fake instance, so what's tested is what Companion runs.
