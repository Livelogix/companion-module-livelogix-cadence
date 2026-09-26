# LiveLogix Cadence

Drive **Cadence** from a Stream Deck (or any Companion surface): timers, presets, run-of-show schedules, cue stacks, audience polls, messages, scenes and more. Live times, tally colours and show status come back into Companion as variables and button feedback.

## Setup

1. On the Mac running Cadence, add a **Producer** node. Note its port — each Producer node has its own port (e.g. 8741), shown in the node's editor. The app-wide producer page is **8730**.
2. In Companion, add this connection and set:
   - **Cadence Host** — the IP address of the Mac running Cadence.
   - **Producer Port** — the port from step 1.
   - **Poll interval** — how often live time refreshes (default 250 ms).
3. The connection turns green (**OK**) once it reaches Cadence.

### What you can control

Companion sees exactly what's **wired onto the targeted Producer page** — nothing else, so a Stream Deck can't touch timers you didn't hand it.

- **App-wide page (8730)** exposes timers only.
- **A Producer node's port** exposes its timers **plus** any presets, schedules, schedulers, scenes, messages, automations, cue stacks, polls, Time Shifts, ProPresenter controls and cue lights placed on it.

Point Companion at a **Producer node's port** for anything beyond timers. A timer wired only into a *design* won't appear — wire it to the Producer node.

## Actions

**Timers**
- Start / Pause / Toggle / Reset
- Adjust ± seconds
- Set duration (`5:00`, `1:30:00` or seconds — optionally start)
- Set remaining (edit time without stopping)
- End at time of day (`2:30 PM`, `14:30`) — moves a "time till" timer's target
- Load edit-window preset slot 1–4
- Undo last edit (within 60 s)

Every timer action has an **override ID** field that accepts variables.

**Show control**
- **Preset:** load a bank preset into its wired timers — Set, Set & Start, or Arm only.
- **Schedule:** Set / Set & Start / Set, Start & advance / Add to Cue Stack / Next / Previous / Correct to sheet start or end / Refresh from Google Sheet; **Jump to cue** by sheet cue # or row.
- **Scheduler:** Arm / Disarm / Toggle / Fire next row.
- **Scene:** Recall; Undo last recall.
- **Message:** Hidden / Shown / Flashing / Toggle; Set text (optionally put on air).
- **Automation:** Arm / Disarm / Toggle; Set trigger time.
- **Cue Stack:** GO / Load / Remove top / Clear; Add a time.
- **Poll:** Open / Close / Toggle / Ready / Next / Previous / Reveal / Hide / Toggle reveal / Reset votes; Go to question #; Results on phones (never / after voting / live).
- **Poll — Simulate votes (rehearsal):** Start / Stop / Toggle; reveal, hide or toggle the simulated results; set the simulated voting state (ready / open / closed). Fake votes stream in for about 5 s, then reveal, so you can rehearse the graphics. Real votes are never touched, and phones mark the tally "simulated". If Simulate is switched off for the Producer page, Cadence refuses and the connection log says so.
- **Time Shift:** set rehearsal rate (1 = real time).
- **ProPresenter:** Start / Stop / Reset a ProPresenter timer (clock in control mode).

## Feedbacks

- **Clock colour** — paints the key the exact colour the clock shows on screen (green → amber → red), with auto black/white text.
- **Timer is running**, **Timer state is…** (normal / warning / danger / expired), **Timer remaining below N s**, **Timer can be undone**.
- **Cue light colour** — live tally mirror.
- **Preset is armed**.
- **Schedule behind / ahead by N s**, **On-deck cue is the running one**, **Schedule button available** (Set / Next / Prev).
- **Scheduler armed**, **Automation armed**, **Automation fires within a minute**.
- **Scene recall can be undone**, **Message on-air state**.
- **Cue Stack has cues**.
- **Poll state** (ready / open / closed), **Poll revealed**, **Poll room live**, **Poll is simulating** (any phase / votes streaming / simulated results revealed).
- **Time Shift active**, **Cadence offline**.

## Variables

- `connection_state`, `clock_status`, `page_title`, `timer_count`, `cuelight_count`, `scene_undo`, `scene_undo_remaining`
- **Per timer, 1-based:** `timer_N_name`, `_time`, `_remaining`, `_remaining_hms`, `_running`, `_mood`, `_endtime`, `_duration_hms`, `_progress`, `_ended_at`, `_rate`, `_color`, `_undo`
- **Per clock (stable id):** `clock_<id>_name`, `_time`, `_label`, `_remaining`, `_mood`, `_running`, `_color`
- **Schedule:** `schedule_<id>_current`, `_running_cue`, `_ondeck`, `_ondeck_time`, `_ondeck_duration`, `_next`, `_next_time`, `_position`, `_status`, `_drift`, `_drift_seconds`, `_sync`
- **Scheduler:** `scheduler_<id>_armed`, `_next_title`, `_next_trigger`, `_live_tc`
- **Automation:** `automation_<id>_armed`, `_time`, `_countdown`
- **Message:** `message_<id>_text`, `_vis` · **Scene:** `scene_<id>_ready`
- **Cue Stack (by timer id):** `cuestack_<id>_count`, `_next`
- **Poll:** `poll_<id>_question`, `_state`, `_position`, `_votes`, `_audience`, `_leader`, `_leader_percent`, `_revealed`, `_join_url`, `_simulating`, `_sim_state` (while simulating, `_votes` / `_leader` show the fake tally)
- **Time Shift:** `shift_<id>_rate` · **Cue light:** `cuelight_<id>_color`

While Cadence is unreachable, live times read `--:--` rather than freezing on a stale value.

## Presets

Ready-made buttons for everything on the page: per timer (Start/Pause with live time and state colours, on-screen-colour mirror, Reset, ±1:00, Undo), per schedule (GO on-deck, Next, Prev, ahead/behind readout), per cue stack (GO with count), per poll (Open/Close, Reveal, Next/Prev, Simulate start/stop, simulated reveal, leader readout), messages, scenes, automations, schedulers, presets, Time Shift rates, ProPresenter controls, cue-light tallies and a status button.
