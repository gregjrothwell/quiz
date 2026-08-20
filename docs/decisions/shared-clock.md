# The shared clock

> **Owner: Greg Rothwell. Last updated: 20 August 2026. Budget: 250 lines.**

**Status: built 20 August 2026, not deployed** — Greg is playing a round on the rank bonus
first. The design comes from
[`clock.md`](clock.md#what-would-actually-fix-it), where it has been written out and marked
*not started* since 17 August.

## The story

> As a player, I want my timer to show the time **the room** has left, so that the reveal
> never lands while my own face still says five seconds.

This is the 17 August report, in the player's own words:

> it was just those two moments where my timer was stuck on 0 after the question was over and
> the other being it said I had 5 seconds left but it instantly went to 0 and I couldn't answer

His snapshot of the question opening arrived about five seconds after the room's, so his
window started five seconds late, and the lecterns went dead under his hand while his timer
still showed time. **He was not slow. He was shown a clock the room was not running to.**

## Why the obvious fix is wrong, and this one is not

`useQuestionClock` counts from the moment *this device* saw the question open. Syncing to
`questionOpenedAt` instead is ruled out and stays ruled out: that field is the **writer's wall
clock**, so it would fold the quizmaster's clock offset into every player's speed score, and
office laptops disagree by more than any bonus is worth.

But `openedAt` is a **`serverTimestamp()`**, and that is the way through:

```
arrival = openedAt + skew + latency        (all on this device's clock)
```

`latency` is never negative, so across a round the **minimum** of `arrival − openedAt`
approximates `skew` alone — this device's pure clock offset from the server. Subtract it and
`openedAt + skew` is the moment the question opened *on this device's clock*, with nobody
else's clock anywhere in the arithmetic.

## Acceptance criteria

1. Every device in a room counts down the same window from the same origin, whatever its
   latency.
2. **Every failure path returns to exactly today's behaviour.** No `openedAt`, no skew
   estimate, a nonsense reading — the clock falls back to counting from local arrival. This
   is the most safety-critical code in the app and it fails silently, so the floor is "no
   worse than now".
3. **The correction can only ever take time away, never add it.** The estimate is a minimum
   over samples that are each `skew + latency`, so it is always ≥ the true skew — which means
   the corrected elapsed time is always ≤ the true elapsed time. A device can still be given
   slightly too much time; it can never be given too little.
4. **Question one is uncorrected**, and that is honest rather than a gap: one sample is
   `skew + latency₁` with nothing to compare it against, so it estimates the same origin the
   device already had. The estimate sharpens as the round goes on.
5. **Samples come only from server-confirmed snapshots.** A pending local snapshot has no
   `openedAt` at all on the device that wrote it, and taking one would measure the
   quizmaster's own latency compensation as though it were skew.
6. `elapsedMs` for scoring moves onto the corrected clock too. This is not scope creep: a
   device that receives a question late currently reports a *lower* elapsed time for the same
   real moment and is **advantaged** by its own lag. That was worth about five points under
   the old speed curve. Under rank scoring it is worth 100.

## Where the code goes

- `src/engine/roomClock.ts` — the arithmetic. Pure, tested, no React, no Firebase.
- `src/lib/useRoom.ts` — reads `openedAt` off the snapshot, keeps one sample per question.
- `src/lib/useQuestionClock.ts` — takes an origin when there is one, keeps its own when not.

`questionConfirmedAt` in `useRoom` already records the local arrival of the first
server-confirmed snapshot per question, for the reveal gate. It is one half of every sample.

## The tests, written first

Thirteen cases in `src/engine/roomClock.test.ts`, written and watched fail before
`roomClock.ts` existed:

- The minimum of several deltas is the estimate; a single delta estimates itself.
- A later, worse delta never worsens the estimate.
- No samples yields no estimate — **null, not zero**. Zero is a measurement, and treating the
  absence of one as "perfectly in step" is the confident lie this module exists to avoid.
- A corrected origin is never later than the local arrival: the safe-direction property, as a
  test rather than a comment.
- A correction larger than `MAX_CORRECTION_MS` is refused — that is a clock that jumped, not
  a network that was slow.
- A negative skew works, because a laptop can run behind the server as easily as ahead.
- `openedAt` missing, or `arrivedAt` missing, yields no origin.
- The last case replays the 17 August round: a device that saw one question five seconds late
  and the next at +85ms counts from `openedAt + 85` rather than from its own arrival — so a
  ten-second window has about five seconds left on that screen, which is what the room has,
  instead of ten that end with the lecterns going dead.

## Evidence

`typecheck`, `lint` and `build` clean. **443 tests**, up from 430. Main chunk 226.20 kB →
226.77 kB.

**`npm run sync-harness 10` confirms the premise the design rests on**, and it is the only
tool that can: host at **+8ms**, the other nine at **+64–65ms**, ten of ten joined, none
dropped. That 56ms gap is on a fast local network with every client on one machine — the best
possible case. On the office network on 17 August the same gap was five seconds for one
player. Consistent with the readings already on file (+6ms / +82–86ms, and +63ms).

**A live round with a remote host**, `npm run host-room -- 30` with a browser joined as an
ordinary player: the question opened, the clock counted down, an answer was accepted at
**7.6s** and recorded against the right option, and the reveal landed on time. No console
errors.

### The harness could not show it, and now can

**`host-room` never read the answers subcollection.** It built its `RoomState` with
`answers: {}` hard-coded, in two places, so every reveal was folded with nothing to score:
`lastDeltas` came back empty, every real player's answer read as **`lost`**, and the browser
said *"your answer didn't reach the room in time"* about an answer displayed on the same
screen at 7.6s. A false alarm shaped exactly like a bug.

**Fixed on Greg's say-so, and proved in both directions.** Before: an answer scored nothing.
After, the same action, same harness: `scored: GateTest +1000` in the terminal and `+1000` at
position 1 on the browser's standings — the two agreeing being the point. The filter was
**extracted rather than copied** — `liveAnswers` in `src/engine/answers.ts`, used by both the
app and the harness, because a second copy of the rule that decides what gets scored would not
look like a rendering bug when it drifted. Same reasoning that pulled out `roomStandings`.

That run is also the **first time the rank bonus has scored anybody in a live room**: 500 for
correct plus 500 for first, through the vault, against a remote host. It does not prove
*ranking* — that needs two answerers — but the path works end to end.

So **ranking under the corrected clock is still unproven in a live room**, and the only thing
that will prove it is two real devices.

**Also not covered:** whether the estimate is good enough on the office network. Ten clients
on one machine is the best case for latency and the worst case for measuring it.
