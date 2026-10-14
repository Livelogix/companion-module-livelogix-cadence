# LiveLogix Cadence

Drive **Cadence** from a Stream Deck (or any Companion surface): timers, presets, run-of-show schedules, cue stacks, audience polls, messages, scenes and more. Live times, tally colours and show status come back into Companion as variables and button feedback.

## Setup

1. In Companion, add this connection and set:
   - **Cadence Host**: the IP address of the Mac running Cadence.
   - **Control scope**:
     - **Whole show** (default): everything in Cadence's editor, meaning every timer, message, scene, schedule, preset bank, scheduler, automation, cue stack, poll, Time Shift, ProPresenter control and cue light, plus read-only output status. Use Cadence's app port, **8730**.
     - **One Producer page**: only what's wired onto one Producer node. Use that node's port (e.g. 8741, shown in the node's editor). Handy for giving a Stream Deck just one department's controls.
   - **Port**: 8730 for Whole show, or the Producer node's port.
   - **Poll interval**: how often live time refreshes (default 250 ms).
2. The connection turns green (**OK**) once it reaches Cadence.

New elements, removals and renames in Cadence show up in Companion's dropdowns within one poll. You don't need to reconnect.

### Turning whole-show control off

In Cadence, **File ▸ Allow Whole-Show Remote Control** switches whole-show control on or off for the current show (on by default; saved with the show). While it's off, the connection shows Cadence's reason and controls nothing. Producer pages work either way.

If the connection says Cadence "doesn't offer whole-show control on this port", you're either pointed at a Producer node's port (use 8730) or running an older Cadence. Update Cadence, or set **Control scope** to **One Producer page**.

### Outputs are status only

With Whole show, each output's on/off state and what it's showing come through as variables and feedback. Companion can't switch outputs; that stays in Cadence.

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
- **Schedule — Planning Center LIVE:** Next item / Back / Take control (schedules linked to Planning Center).
- **Scheduler:** Arm / Disarm / Toggle / Fire next row.
- **Scene:** Recall; Undo last recall.
- **Message:** Hidden / Shown / Flashing / Toggle; Set text (optionally put on air).
- **Automation:** Arm / Disarm / Toggle; Set trigger time.
- **Cue Stack:** GO / Load / Remove top / Clear / Restore from Cadence Show Setup; Add a time.
- **Cue Stack — Mode:** Cue / Presets / Toggle. In **Cue** mode GO takes the top cue off the stack. In **Presets** mode the list stays: GO loads the selected cue and selects the next row.
- **Cue Stack — Select a preset:** next / previous / first / last row, or a row number (Presets mode).
- **Poll:** Open / Close / Toggle / Ready / Next / Previous / Reveal / Hide / Toggle reveal / Reset votes / Clear the poll report; Go to question #; Results on phones (never / after voting / live).
- **Poll — Open answers:** profanity filter on / off / toggle and answers per phone (0 = no limit), for the current open-answer question.
- **Poll — Simulate votes (rehearsal):** Start / Stop / Toggle; reveal, hide or toggle the simulated results; set the simulated voting state (ready / open / closed). Fake votes stream in for about 5 s, then reveal, so you can rehearse the graphics. Real votes are never touched, and phones mark the tally "simulated". If Simulate is switched off for the Producer page, Cadence refuses and the connection log says so.
- **Time Shift:** set rehearsal rate (1 = real time).
- **ProPresenter:** Start / Stop / Reset a ProPresenter timer (clock in control mode).

## Feedbacks

- **Clock colour**: paints the key the exact colour the clock shows on screen (green → amber → red), with auto black/white text.
- **Clock segment (as button text)**: shows just one part of a clock's time on the button: hours, minutes, seconds, frames, hours:minutes, minutes:seconds or AM/PM, optionally with the overtime "-" and a label in front. Put hours, minutes and seconds on three keys for big, readable digits.
- **Timer is running**, **Timer state is…** (normal / warning / danger / expired), **Timer remaining below N s**, **Timer can be undone**.
- **Cue light colour** — live tally mirror.
- **Preset is armed**.
- **Schedule behind / ahead by N s**, **On-deck cue is the running one**, **Schedule button available** (Set / Next / Prev).
- **Scheduler armed**, **Automation armed**, **Automation fires within a minute**.
- **Scene recall can be undone**, **Message on-air state**.
- **Cue Stack has cues**, **Cue Stack mode is** (Cue / Presets), **Cue Stack preset row is selected**.
- **Planning Center LIVE is** running / Cadence is in control / control can be taken.
- **Poll state** (ready / open / closed), **Poll revealed**, **Poll room live**, **Poll is simulating** (any phase / votes streaming / simulated results revealed).
- **Output is on**, **Output is showing…** (read-only status).
- **Time Shift active**, **Cadence offline**.

## Variables

- `connection_state`, `clock_status`, `page_title`, `timer_count`, `cuelight_count`, `scene_undo`, `scene_undo_remaining`
- **Per timer, 1-based:** `timer_N_name`, `_time`, `_remaining`, `_remaining_hms`, `_running`, `_mood`, `_endtime`, `_duration_hms`, `_progress`, `_ended_at`, `_rate`, `_color`, `_undo`, and **time segments** `_hh`, `_mm`, `_ss`, `_sign` ("-" in overtime)
- **Per clock (stable id):** `clock_<id>_name`, `_time`, `_label`, `_remaining`, `_mood`, `_running`, `_color`, `_hh`, `_mm`, `_ss`, `_ff` (timecode frames), `_sign`, `_ampm`
- **Schedule:** `schedule_<id>_current`, `_running_cue`, `_ondeck`, `_ondeck_time`, `_ondeck_duration`, `_next`, `_next_time`, `_position`, `_status`, `_drift`, `_drift_seconds`, `_sync`
- **Scheduler:** `scheduler_<id>_armed`, `_next_title`, `_next_trigger`, `_live_tc`
- **Automation:** `automation_<id>_armed`, `_time`, `_countdown`
- **Message:** `message_<id>_text`, `_vis` · **Scene:** `scene_<id>_ready`
- **Cue Stack (by timer id):** `cuestack_<id>_count`, `_next` (the cue GO loads), `_mode`, `_selected_position`
- **Planning Center schedules:** `schedule_<id>_pco_live`, `_pco_current`, `_pco_remaining`, `_pco_next`, `_pco_controller`
- **Poll:** `poll_<id>_question`, `_state`, `_position`, `_votes`, `_audience`, `_leader`, `_leader_percent`, `_revealed`, `_join_url`, `_simulating`, `_sim_state` (while simulating, `_votes` / `_leader` show the fake tally), `_kind` (choice / open), `_filter`, `_per_phone`
- **Time Shift:** `shift_<id>_rate` · **Cue light:** `cuelight_<id>_color`
- **Output (Whole show, read-only):** `output_<id>_name`, `_enabled`, `_kind`, `_source`, `_feeds`

Segments always match what Cadence shows on screen, because they're split from the displayed time (same rounding, same overtime sign). Timers under an hour give hours `00`; time of day gives hours as shown (`4` or `16`).

While Cadence is unreachable, live times read `--:--` (segments `--`) rather than freezing on a stale value.

## Presets

Ready-made buttons for everything on the page: per timer (Start/Pause with live time and state colours, on-screen-colour mirror, **big digits**: hours, minutes and seconds on three keys, Reset, ±1:00, Undo), per schedule (GO on-deck, Next, Prev, ahead/behind readout), per cue stack (GO with count, Cue / Presets mode, select previous / next preset), per Planning Center schedule (LIVE Next / Back / Take control), per poll (Open/Close, Reveal, Next/Prev, Simulate start/stop, simulated reveal, leader readout), messages, scenes, automations, schedulers, presets, Time Shift rates, ProPresenter controls, cue-light tallies, output status buttons (Whole show) and a status button.
