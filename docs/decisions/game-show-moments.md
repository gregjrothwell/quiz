# Game-show moments

> **Owner: Greg Rothwell. Last updated: 22 October 2026. Budget: 250 lines.**

The moments a TV quiz holds and this one used to rush: the final's reveal, the
podium, the screen changing, a player's own points. Built on branch
`premium-motion`, 21 October 2026, from a design scan Greg asked for that
afternoon ("share/shaft could have a cool animation … if people share (comes
together) or shaft (shafter destroys the other person)"), then "do everything".
**Live 21 October 2026 with #100** — merge `1412867`, gh-pages `821e754`, live
bundle `index-DYv-seCH.js` byte-identical to a local build of master.

## What changed, and where

| Moment | Before | Now | Where |
|---|---|---|---|
| Share or Shaft reveal | Both labels changed colour; headline and table in the same instant | Picks turn over; then a share slides the seats into one green desk, a shaft lunges and shatters the other seat, both shafting collide, the house goes dark and third place walks into the light. Words and table after | `ShareOrShaft.tsx`, `.standoff*` |
| The pot | "Playing for 5,550" in small amber under the title | The biggest number on screen, between the seats (above them on a phone) | `.standoff__pot` |
| The two buttons | The pack picker's blue card, "Press 1" on a phone | Big, green and red, "Sealed" stamped on the one chosen, no key hint below 64rem | `.picker--standoff` |
| Locked in | A text change | A stamp, with a thud on every screen but the one that pressed | `Seat`, `.standoff__state[data-state='locked']` |
| The final's clock | A bare cyan number | `ArcTimer`, and a heartbeat over the last five seconds of the pick | `ShareOrShaft.tsx` |
| Podium | Three risers 200ms apart | Third 0.3s, second 1.5s, a 1.4s drum roll, winner ~3.7s; fanfare and confetti on the landing; heading and everything below held until then | `Final.tsx` (`RISER_AT`), `--at` |
| Between screens | A hard cut | One band of light across the stage on lobby, standings, final and results | `Stage.tsx` (`WIPED`), `.stage__wipe` |
| Standings | Rows slid; nothing said who moved | ▲/▼ places moved, after the slide; "New leader" stamped on whoever took it alone | `engine/movement.ts`, `Standings.tsx` |
| Your own reveal | "Correct · +1,000" in the desk | The points pop over your lectern; "4 in a row" stamped from three up | `PodiumTile` `pop`, `engine/streak.ts` |
| Lobby | Plates just there | Each drops in; the quizmaster's device pings per arrival | `Lobby.tsx`, `.plate` |
| Phones | — | A buzz on locking an answer, on your verdict, on locking a final pick, and at the final's impact | `lib/haptics.ts` |

New cues, all synthesised like the rest (`sound.ts`): `shatter`, `chime`,
`heartbeat`, `roll`, `join`. None louder than the loudest existing voice, and
`join` the quietest thing in the house — `sound.test.ts`.

## Second pass, 21 October 2026

Greg asked what else had come up while building; these four were fixes to the
first pass rather than new moments, and went on the same PR.

- **The heartbeat was sub-bass only** (72→48Hz sines), with a comment claiming
  it would be "felt more than heard" on laptop speakers — which carry little
  under about 100Hz, and nobody had listened. Each beat now has a muffled
  triangle above 120Hz (`sound.test.ts` holds it there), and it plays on the
  two finalists' devices only: on every screen it was a dozen heartbeats a few
  hundred milliseconds apart down one call.
- **The quizmaster's Space skipped the reveal.** One press mid-shatter took
  the whole room to the final results. Now the first press jumps this screen to
  the result (dropping the blackout and the heir), and the second moves on.
  Beats only move forward, so a pending timer cannot drag it back.
  `ShareOrShaft.reveal.test.tsx` — fails on the old screen, passes on the new.
- **The podium could not be skipped.** A tap or Space jumps to the result.
  While it builds, the invisible content underneath takes no clicks
  (`data-held`), so a tap meant to skip can never press "Another round".
- **"Turning them over…" was dead air**, up to five seconds at the tensest
  point. It now has the podium's drum roll and both seats bracing in step
  (motion-welcome only: an endless loop is what the blanket reduced-motion
  rule turns into churn). New gallery fixture: "turning them over".

**Left for Greg:** the line under the title changed from "Playing for 5,550"
to "The top two, for both their scores" in the first pass, without asking.

## The drum roll, rebuilt — 22 October 2026

Greg had heard "a single sound clipping many times per second before the
actual tone played" at the podium twice that day. In a test run: *"I think it's
what you refer to as a drum roll. It sounds like nothing of the sort - this was
what I thought was the stuck sound."* It came out of the PR first; then Greg:
*"drum roll is fine but it has to sound like a real one."*

The cause was the heartbeat's, above, again. The roll was thirty triangle hits
at 196→110Hz and no noise at all. Rendered through `sound.ts` offline (below),
16% of its energy was above 300Hz and 1% above 1kHz — a laptop played only each
hit's attack, about twenty clicks a second, ending 11 dB under the fanfare.

**Rebuilt twice the same night.** First as a snare: band-passed noise at
3.1–3.6kHz (the wires) over a short knock — 77% above 1kHz. Greg: *"drum now
sounds better but clashes with the synth. Also more of a snare than a drum."*

Then as a timpani tuned to G — sines on G3, D4, G4, B4 and a stick tick. Greg:
*"nah"*.

**Version 4, the one offered to ship:** the snare's realism, warmer, over a body
in the fanfare's key. Each of the thirty strokes is band-passed noise at
1.65–1.9kHz (a rattle, not a hiss; 70 ms) over triangles on G3 and G4 sagging 5%
(`ROLL_PARTIALS`). The fanfare is in C, so the roll leads into it; the last
stroke rings on toward the landing. Nothing sinks under 180Hz. Above 300Hz it
builds from −40.9 to −34.4 dB; the fanfare lands at −29.4 (the old roll ended at
−40.4). `ROLL_SECONDS` is unchanged, so the podium's timing is too. `sound.ts`
gained a `noise` voice and an `attack`. `sound.test.ts`: the swell per layer,
and "a drum, in the fanfare's key, that a laptop can play" — FAIL on the 21
October roll and on the first snare.

**How it was heard before shipping:** `play()` driven in headless Chromium with
`AudioContext` swapped for an `OfflineAudioContext`, each cue rendered alone and
mixed at the podium's offsets into WAVs for Greg's ear. Mixing in Node, not
`OfflineAudioContext.suspend()`: a fanfare scheduled from a suspend landed at
2.31 s and 2.06 s in two renders that asked for 1.9 s — the instrument lied
until each cue was rendered on its own.

## The rules it kept

These were in `global.css` before this work, and each one shaped it.

- **Transform and opacity only.** Every new animation moves one or the other.
  The shatter is ten clipped copies of the seat thrown with `translate` and
  `rotate`; the blackout and the washes are one painted layer whose opacity
  moves. Confetti is the exception, and it is a single canvas, painted for 3.6s
  and cleared.
- **`backwards`, not `both`**, wherever something later may want the property.
  `forwards` only where the end state is final and nothing will move it again:
  the seats that met, the pot that left, the shards that flew, the pop.
- **Reduced motion collapses durations, not delays.** So the JavaScript
  timelines (`beat` in `ShareOrShaft`, `staging` in `Final`) go straight to
  their end under `useReducedMotion`, and every end state carries the outcome
  without the motion: the joined desk, the cracked seat, the standing podium.
- **Nothing over the question or the reveal.** The wipe skips both: the clock is
  running on one and the other opens on a deliberately dark set.

## Decisions taken while building

**The wipe is CSS, not `startViewTransition`.** The scan suggested the View
Transitions API. A view transition takes pointer events for its length, so on
any change into a screen with buttons it would have eaten taps — and on the
question, answer time. A keyed element with `pointer-events: none` does the
same job and blocks nothing.

**The join ping is the quizmaster's only.** Everybody in a round is on a call;
ten devices pinging one arrival is ten pings down the line. The person who
wants to hear the room filling is the one about to press start.

**A new leader leads alone.** Catching the leader exactly takes nothing;
pulling clear of a tie takes it outright — which also crowns whoever pulls
clear on question one. `movement.test.ts`.

**A streak is read off this device's game log**, not stored on the room: it is
said to one player about themselves, needs no write, and survives a reload
because the log does. A thrown-out question neither breaks nor extends a run;
any other gap ends it.

**Haptics are Android only and gated on a tap.** Safari has no
`navigator.vibrate`; Chrome refuses one before the page has had a tap and logs
an error. Every buzz is a third channel for something already on screen and in
sound.

**Coming back to the podium does not stage it again.** `builtPodiums` (module
scope) remembers which games this page has built, so the season table and back
shows the result.

## Evidence, 21 October 2026

- `npm run typecheck`, `eslint src scripts`, `npm test` (1,651 tests, 110
  files) and `npm run build` clean at `ee506ac`. New tests: `takeFor`, the
  roll's swell and the cue balance, `boardMoves` (7), `streakOf` (8), the
  lobby ping (allow on a join; deny on open, leave, and a player's device), and
  which screens the wipe crosses.
- `npm run e2e` (local emulators, Java prefixed): 18 passed.
- Seen in the gallery (`#/preview`), desktop and 375px: all three reveals
  (shards in flight with the red wash; the blackout with third place lit; the
  joined desk), the sealed pick, the stamps, the podium timeline sampled from
  the DOM (third 0.3s, second 1.5s, winner ~3.7s counting as it lands, title
  and table ~4.4s), the pop and the run, the standings arrows.
- **The instrument lied first.** With the browser pane hidden the page ran as a
  background page and animations advanced only when a screenshot forced a
  frame, so early screenshots showed states seconds out of date. Readings
  taken after the pane was shown agree with the DOM.

## Not covered

- **Nothing here has been played in a live room.** The gallery has no phase,
  so the wipe was proved by `Stage.test.tsx`, not seen. The join ping was
  proved by test, not heard.
- **Reduced motion was not exercised in a browser**; the tool cannot emulate
  it. The code path is the existing hook.
- **Haptics were not felt** — no Android phone in the loop.
- **Sound balance by ear**, on laptop speakers over a call, is untested; the
  test only bounds the gains.
- **The 4s hold on the final screen** can be skipped with a tap or Space; if
  it still feels slow, `LANDED_AT` is the number.
- **`405fd9c` carries CSS that belongs to `97d9bfd`** (the standings arrows,
  the pop, the streak stamp): the whole stylesheet was staged for the wipe.
  Reverting the wipe alone means keeping those rules.
- **`27864c8` did not typecheck**; `ee506ac` fixes it. Every other commit does.
- **`0594731` (podium skip) carries the bracing CSS for `91f1711`** (the
  closed-stage pulse): a partial-staging patch failed and the next commit in
  the same command took the whole stylesheet. Revert the two together.
