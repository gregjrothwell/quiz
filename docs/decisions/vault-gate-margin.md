# The vault gate's margin

> **Owner: Greg Rothwell. Last updated: 22 October 2026. Budget: 250 lines.**

Moved verbatim out of [`vault.md`](vault.md) on 22 October 2026, when a correction took that file past its 250-line budget. The text is unchanged.

## The gate had no margin, and the host was the one who paid

**20 August 2026.** Everything above is about *whether* the gate opens. This is
about *when* a client may ask, which turned out to be a separate question with a
much worse answer.

The rule is `request.time > openedAt + durationSecs * 1000` — strict, on the
server's clock. A client cannot read that clock, so it has to pick a local moment
it can prove is later. `useQuestionClock` was assumed to be one, and said so:

> *"measured from when this device saw the question open, which is necessarily
> after the server stamped it — so a local clock always expires a little after the
> gate does, never before."*

**True of every device except the one that reveals.** The quizmaster *wrote* the
question open, and latency compensation delivers that write back as a local
snapshot before the server has seen it — so their countdown starts at roughly the
click while `openedAt` is stamped a hop later. Worse: both writes cross the same
network and are judged by the same clock, so latency and skew **cancel**, leaving
only the milliseconds between the countdown expiring and the write going out.

### What the measurement said

`npm run reveal-probe [secs] [offsetMs]` writes a single candidate — the answer
the vault already holds for the harness question — so the only clause that can
refuse it is `windowClosed()`. A refusal is the gate and nothing else.

| | |
|---|---|
| pending local snapshot | +6 to +12ms after the open write was issued |
| server-confirmed snapshot | +55 to +96ms |
| margin at the local anchor | **about 7ms** |
| asking 100ms early | **REFUSED** |
| asking 250ms early | **REFUSED** |

`npm run sync-harness 10` says it from the other side without being asked to: the
host saw the question at **+6ms** and the other nine at **+82–86ms**.

So the reveal was a coin flip on jitter, and the app paid a flat 1500ms
`REVEAL_RETRY_MS` every time it lost one — most of them, on a network jitterier
than a home connection. **The scripts hid it:** `host-room` added 1000ms of slack
and `check-rules` 1500ms, both explaining that the browser got the same margin for
free. It never did, and the harness passed by compensating for the bug.

### The fix, and why it needs no tuning

Anchor on the first **server-confirmed** snapshot instead
(`src/engine/revealGate.ts`, `questionConfirmedAt` in `useRoom`). It cannot reach
the device before the server stamped `openedAt`, because the stamping happens
first and the snapshot travels afterwards:

    confirmedAt (local, real time)  >  openedAt (server, real time)

so a reveal issued at `confirmedAt + durationMs` reaches the server strictly after
`openedAt + durationMs` — **whatever the latency and whatever the skew. Neither
appears in the arithmetic.** The 100ms of slack guards `Date.now()` going backwards
under an NTP correction and nothing else; a test pins that it is still correct at
zero, so nobody fixes a refusal by growing it. It costs about 80ms — the round trip
the old anchor was stealing.

### Measured after

Two questions in a live browser round, 15-second window, nothing pressed:

| | |
|---|---|
| clock hits zero | button reads **Revealing…** |
| reveal lands | **+478ms**, **+561ms** |
| answer on screen | **+1.2s** |
| error notices raised | none |

`npm run check-rules` still refuses a reveal inside the window, and still allows
one after it — 36 of 36, both directions.

### What is still in the gap, and is not a bug

`resolveAnswer` fires four candidates and three are refused every time by design:
236–289ms against 34–48ms for one clean write, because each denial disrupts the
write stream — and it costs the room update after it about double. The replay hold
is up to **1820ms** (`REPLAY_SHAPE`), 700ms when nobody answered. That is the
largest single component of the gap, and it is deliberate showmanship rather than
latency. **Asked and decided, 20 August 2026: it stays.** Not an optimisation
target — if it is ever revisited, `spreadMs` is the number and it needs Greg.

---
