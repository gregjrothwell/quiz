# The rig in your hand — the probe, then the rig

> **Owner: Greg Rothwell. Last updated: 22 October 2026. Budget: 250 lines.**

**Status: APPROVED 22 October 2026, as recommended.** Greg: *"Approve all four stories as recommended: Mr Fries on pack×difficulty rates, room wins on more than half right, 🍟 until there's art, fix HANDOVER item 8; rig probe now and rig only on a pass; Commentator without Gemini, spoken from the host only, you draft ~30 lines; Wrapped's five cards opening 5 D[ec, Christmas finale left out for now]"* (the message was cut at 300 characters; the bracket is the rest of the button he pressed). Wow item 4 of
[`direction-oct-2026.md`](direction-oct-2026.md#5-wow--all-five-accepted).
Not to be confused with [`lighting.md`](lighting.md), which is the on-screen
set ("the rig") and its two cues.

## The idea

Every phone in the room becomes a stage light. On a cue from the host — the
reveal, the final whistle, the winner — every screen washes the same colour at
the same moment, so the office itself lights up.

**Slow washes only**, never flashes: the flash rule in `lighting.md` applies,
and a fade hides small timing differences anyway.

## Why a probe comes first

Lights look together if they change within about ±50 ms of each other. Whether
phones on office Wi-Fi can do that is a measurement, not a guess:
[`known-limits.md`](known-limits.md) records that audio played "together" on
several devices phases audibly, so the network and the devices are already
known to spread.

## Part 1 — the probe

> **As Greg**, I want to know how closely the office's phones can change
> colour on one cue, **so that** the rig is built only if it will look like one
> light rather than a ripple.

- The host writes a cue to the Realtime Database: "at shared-clock time T,
  turn amber". Every device schedules it against its own estimate of the shared
  clock (`shared-clock.md` already measures each device's offset).
- Each device writes back when it actually painted (`requestAnimationFrame`
  after the change), on the shared clock.
- A results screen and `npm run read-rig` show the spread.

**Probe ACs**
- **P1.** Ten cues a run, two seconds apart, in a lobby "rig check"
  that the host starts and anybody in the room can join.
- **P2.** Each device's paint time, shared-clock corrected, is written once per
  cue to `rig/{code}/{cue}/{uid}`; the RTDB rules bound it to the writer's own
  uid and a number.
- **P3.** The report gives the spread per cue (latest − earliest) and the
  share of devices within ±50 ms of the median.
- **P4.** Proved first with eight Node clients and four browser tabs on the
  emulator, so a bad number is the network's, not the probe's.
- **P5.** **The real run needs people:** 8+ phones in the office, one Friday.
  That cannot be done from here.
- **Pass:** 90% of devices within ±50 ms on 9 of 10 cues.

## Part 2 — the rig (only if the probe passes)

> **As the room**, I want our phones to light up together at the big moments,
> **so that** the reveal feels like a studio, not a spreadsheet.

**Rig ACs (sketch, re-confirmed after the probe)**
- **R1.** Four cues only: question open (cool wash), reveal (amber), the final's
  whistle (red), the winner (gold, slow pulse). All fades ≥ 400 ms.
- **R2.** Opt-in per device ("Light up my phone"), remembered, off by default.
- **R3.** The host writes the cue; a device that misses one does nothing.
- **R4.** Screen brightness is not touched; colours stay within the existing
  palette.
- **R5.** No cue costs a Firestore read; the RTDB carries them.

## Decided — Greg, 22 October 2026, as recommended

| Decision | Recommendation |
|---|---|
| Approve the probe now and the rig only on a pass | Yes |
| The ±50 ms / 90% pass line | Yes; it comes from what fades hide |
| A Friday with 8+ phones for the real probe run | Yours to arrange; nothing ships until then |
