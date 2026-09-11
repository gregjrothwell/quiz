# Why a reveal stalls, and what is kept about it

> **Owner: Greg Rothwell. Last updated: 11 September 2026. Budget: 250 lines.**

[`vault.md`](vault.md) is about *whether* and *when* the gate opens, and it was
at 248 of its 250 lines when this happened. This file is the third question:
what happens when the asking itself does not come back. Read that one first —
the anchor argument in it is what makes the gate correct at all.

## 11 September 2026 — the round that sat on "Revealing…"

> "There was a couple of very large delays on revealing the answer. There was
> quite a high number of players but should have been manageable." — Greg

**The player count was not it, and the numbers say so plainly.**

| | `CUC4`, 11 Sep | `CX5E`, 10 Sep |
|---|---|---|
| Seats | **9** | **11** |
| Questions | 15 of 15 | 10 of 10 |
| Hit rate | **80%** | 65% |
| Median answer | **3.1s** | 4.1s |
| Reveals completed | 15 of 15 | 10 of 10 |
| Delays reported | two | none |

Load went *down*. The round was also the best the game has recorded on every
other measure, and all fifteen reveals eventually landed — so these were stalls,
not failures.

The bundle was identical. Nothing touching the game loop shipped between the two
rounds; see the correction at the foot of this file about what *did*.

### Firestore does not reject a write that cannot be sent

It queues it locally and leaves the promise **pending** until the server
acknowledges. For a player's answer that is exactly right — it lands when the
line comes back and nobody notices. For the reveal it is the wrong shape,
because the quizmaster's device is the only one that can open the vault and
nothing else in the round moves until it has.

A pending promise is invisible to a `catch`, and **the entire recovery
apparatus was behind one**:

- the backoff ladder (`revealBackoffMs`, 300/600/1200/1500) never started,
  because nothing threw;
- the retry counter never incremented, for the same reason;
- and `revealingRef` — which stops the expiry effect and the button firing the
  same reveal twice — is cleared **only on failure**, so the quizmaster's own
  Reveal button returned immediately and did nothing.

That last one is the sharp edge. [`vault.md`](vault.md) and the comment in
`App.tsx` both say the manual button is the rescue after the retry cap. In this
failure it was not: it was held shut by the same ref, showing "Revealing…" and
no-opping on every press.

**The ladder only ever covered a refusal.** A refusal is a rejected promise and
always was. A stalled connection had nothing at all.

### The deadline, and why retrying after one is safe

`REVEAL_TIMEOUT_MS` is 4000ms, in `src/engine/revealGate.ts` so it sits with the
rest of the reveal's timing argument. `withTimeout` in `src/lib/withTimeout.ts`
races it.

Set against what a healthy reveal costs: measured 20 August 2026, the reveal
landed at **+478ms and +561ms** with the answer on screen at +1.2s, and the
longest deliberate hold in the round is the replay shape at 1820ms. So four
seconds is about seven times a good reveal and twice the slowest thing that is
supposed to happen — long enough never to fire on a merely slow line, short
enough that a lost reveal is a pause rather than a stall.

**The work is not cancelled, because a Firestore write cannot be.** The queued
writes still flush when the line returns. That is safe here rather than merely
tolerable, and the reason is already in `resolveAnswer`: a reveal document is
immutable once created, so a late flush is refused exactly like a wrong guess,
and the function already falls through to reading the answer back. The path that
handles "this question was revealed by a reloaded tab" handles this too.

## Instrumenting it, and why not OpenTelemetry

> "A developer suggested I look into OpenTelemetry." — Greg, 11 September 2026

**The instinct is right and the instrument is wrong.** Nothing kept could say
which of the fifteen reveals was slow, or which part of one — that is a real gap
and it is why this section exists at all.

Against it, for this app specifically:

- **It needs a collector endpoint.** A static site on GitHub Pages with Firebase
  underneath has no backend to send to, so adopting it means standing up or
  paying for infrastructure this project deliberately does not have.
- **Firestore talks WebChannel**, not plain `fetch`/XHR. The web SDK's
  auto-instrumentation would produce spans for long-poll connections, which are
  not the unit anybody wants to read. The reveal spans would be hand-written
  regardless.
- **Bundle cost**, on a bundle [`HANDOVER.md`](../HANDOVER.md) already calls
  heavy, for a page whose reads and writes are budgeted in [`cost.md`](cost.md).

Once the spans are hand-written the payload is **four integers on one device**,
and that device already writes a document at the whistle. So the numbers go in
it. OpenTelemetry earns its keep across multiple services, or as RUM over every
player's browser; here one device reveals and one device files the record, and
they are the same device.

### What is kept

`RevealTiming` in `src/engine/gameRecord.ts`, per question:

| field | what it catches |
|---|---|
| `gateMs` | local clock expiring → the gate provably open. Slow means the server's acknowledgement was late. |
| `resolveMs` | the vault round trip — four candidates, three refused. Healthy is under 300ms. |
| `dispatchMs` | the room update that puts the answer on everybody else's screen. |
| `attempts` | 1, unless the vault refused or the connection stalled. |

`npm run read-games` prints the total with the breakdown behind it, and `x2` or
higher where it had to ask again. **The column hides itself** when no question
carries one, which is every round so far.

### It rides inside `questions`, and that is the whole design

The ruleset bounds the game document **at the top level only** — `hasOnly` and
`hasAll` list top-level keys, and the rules cannot walk a list, which
`firestore.rules` says in as many words. So a field inside a question needs **no
rules change**, and therefore no deploy ordering to get right.

A new top-level key would have needed both: the console widened first, then the
client. Get that backwards and every game record is refused — **silently**,
because `keepGameRecord` swallows a refusal on purpose so an offline moment
cannot put an error over the top of the standings. The failure mode is "rounds
quietly stop being kept", which is the one thing this feature exists to prevent.

### Back-compat is the half that mattered

Three rounds are already in Firestore and all three predate the field. A reader
that refused them would be a worse bug than the delay it was added to measure —
the same shape as the link validator that condemned 34 good links. So a missing timing
parses as `null` rather than as a failure, while a *half-written* one is dropped
rather than printed as if it had been measured.

Checked against the live project rather than asserted: `read-games --last 3`
prints all three rounds byte-identically to before the change.

**Two things the work caught on the way.** The dash cell was one character wider
than the numbers — precisely what a column exists to prevent, and invisible to
anyone reading the code. And the formatter's first test imported `read-games`,
which calls `main()` at import, so `npm test` was quietly talking to Firestore;
it passed only because `.env.local` exists on this laptop. The formatter lives in
`scripts/game-report.ts` instead, which is pure and stays offline.

## Still open

1. **No round has yet been played with any of this live.** The fix and the
   measurement both ship unproven against a real stall, which is the nature of
   an intermittent fault — the next slow reveal is the test.
2. **The four-second window is a guess bounded by measurement, not a measured
   value.** Nobody has observed how long a real stall lasts, because nothing was
   recording. `attempts` is the field that will say.
3. **A stall shorter than four seconds still shows as a pause** and always did.
   That is the reveal waiting for a write, and it is honest.

## A correction to `HANDOVER.md`, 11 September 2026

The state box said live was `index-qJCbuGrA`, gh-pages `d412adc`. It was not:
remote gh-pages HEAD is **`8c0a107`, deployed 10 September at 18:05**, bundle
`index-Du6MwR-e.js`, from `2125a79` — PR #51, the Playwright emulator prereqs.
A deploy landed the evening before the slow round and the handover did not know.

**It is not the cause.** That change gates on `__QUIZ_EMULATORS__ === true`,
boolean only, with a hardcoded host it refuses to read off the page, so in
production `emulatorsWanted()` is false and every path behaves exactly as before.
Recorded because the handover being wrong about what is live is worth more than
the change itself — it is the fact that sent this investigation looking for a
regression that was not there.
