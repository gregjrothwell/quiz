# Security round — September 2026

> **Owner: Greg Rothwell. Last updated: 21 September 2026. Budget: 250 lines.**

Written 21 September 2026 for a fresh session. Findings were gathered against
the live project the same day; this file is the record. Depth for the vault,
the answer window and presence stays in those files; this one is *what was
found, what Greg decided, and what to paste*.

Repo at the time: `live-after-54`, clean. Live `index-BHcNzJzP`.

## Why this exists

Greg asked for a security and cleanup round, and specifically whether
**Alistair** — a colleague who plays — is exploiting any loopholes.

Two answers.

**The hull is leaking in one place nobody had written down.** Any signed-in
player can extract the entire answer vault from the browser console on the
live site. That defeats the sealed-pack premise.

**Alistair is not provably cheating, and today's record cannot settle it.** He
is fastest in 11 of 12 kept rounds, and his median barely moves between
questions he gets right and questions he gets wrong — 203 ms, where every
other regular is 900–4,400 ms. That is equally consistent with snap-tapping
(already accepted, [`answer-spam.md`](answer-spam.md)) and with a floored
`elapsedMs`. Nothing server-stamped sits next to the self-reported time.
**Storing one is the deliverable that settles it. Do not accuse; instrument.**

## Live evidence — 21 September 2026, Admin SDK, 13 kept rounds

Do not re-query to re-derive this table.

| | Alistair | everyone else |
|---|---|---|
| Rounds / answers | 9 / 170 | — |
| Hit rate | 72% | 38–80% |
| Median elapsed | **2,012 ms** | 2,924–7,542 ms |
| Median when **right** | 2,012 ms | 2,440–6,716 ms |
| Median when **wrong** | **2,215 ms** | 4,429–9,027 ms |
| **right→wrong gap** | **203 ms** | **903–6,972 ms** |
| Season points | 399,645 (1st) | Greg 387,157, Not Bret 213,736 |

Fastest in 11 of 12, including packs he does not know: **Video Games, 20%
correct, 817 ms median, still fastest.** Perfect on all four media packs.

Three clean results:

1. **No score was ever written directly.** Stored `scores` equals the sum of
   awarded `deltas` for every player across all 13 rounds — so the biggest
   known rules hole (any member can write any score) has **not** been used.
2. **One uid, one identity.** No multi-accounting. `Rach` and `Joe` have two
   uids each; that is a device change, not Alistair.
3. He was never the quizmaster (`writtenBy`) in any kept round.

The innocent reading — he taps on instinct inside two seconds whether he
knows it or not — fits the data completely.

## Findings

### S1 — The reveal gate is an unlimited vault oracle · CRITICAL

`isTheQuestionInPlay()` asks the room which question is in play.
`wellFormed()` bounds `questions.size()` and nothing inside it. And
`opensAQuestion()` is **false** when `phase` stays `'question'` and `index`
does not move, so `timingOk()` then only requires `openedAt` and
`durationSecs` unchanged.

From the console on the live site (App Check is not a defence: the page
hands you a valid token):

1. Create a room. Write `phase:'question'`, wait out one gate. **This is the
   only wait, ever.**
2. For each target id — every id is in `public/packs/*.json` — rewrite
   `questions[0].id`, fire four reveal writes, delete, repeat.

≈5 writes and ~200 ms per question. The live room's ids are on its document
from pack selection, `allow get: if signedIn()`.

**The existing `check-rules` case passed for the wrong reason.** It asked
about `'some-other-question'` *without first making it the question in play*.
The comment at `firestore.rules` claiming the clause "stops a member holding
question one open and quietly asking about the other fourteen" was the one
thing it did not do.

**Not Alistair.** A vault dump would show 100% on every pack. His text rounds
are 20–67%.

**Fix:** `questionsPinned()` — `questions` may change only while the room is
in, or moving to, the lobby. That is what the client already does
(`selectPack` refuses outside the lobby; `reset` clears `questions` on the
way back). The accepted decoy — one gate per question, minimum 5 seconds,
because reaching `phase:'question'` restamps `openedAt` — remains; see
[`vault.md`](vault.md).

**Correction, 22 September 2026 — the fix above broke the game.** The claim
that "that is what the client already does" was wrong, and it is the sentence
to read twice. There is a **third** writer of `questions`: `reveal`
(`src/engine/reducer.ts` line 339) stamps the vault's answer into
`questions[index].correctIndex`, so the other clients learn it from the room
update they already listen to rather than each paying for a vault round trip.
Pinned byte for byte, that write is refused — so **every round, on every pack,
stopped dead on its first question.** Greg hit it on a picture round; it was
never picture-specific.

*Why nothing caught it.* Every S1 deny case passed the afternoon the pin went
live, because a rule that refuses everything refuses those too. No case asked
whether an ordinary reveal still got through. That is precisely what
`EVIDENCE.md` says to do — "read the *allow* direction to know a change
landed" — written up from this project, and skipped here. The offline suite
cannot see it either: 1,021 tests pass, because rules only run live.

*The pin now.* `onlyTheQuestionInPlayMoved()` — the question at `index` may
change, while its `id`, `index` itself, and every other entry may not
(`removeAll` on both sides, which refuses rather than allows when a write
makes some other entry a duplicate). The oracle stays closed: a substitution
into another slot is refused outright, so the two-write version — plant an id
in slot 1, then move `index` onto it — dies on the first write; and a
substitution into this slot cannot change the id, which is the only thing
`isTheQuestionInPlay()` reads. Options may move and buy nothing, because the
reveal document still has to carry the vault's own answer string.

*Proof, both directions.* Two new `check-rules` cases: **allow** "reveal,
stamping the answer into the question in play", which FAILed against the
published ruleset before the paste and is the one that means anything; and
**deny** "add a question to the list while one is open", which only starts
meaning something once the allow case passes beside it.

### S2 — `elapsedMs` is unconstrained for the first 8 s · HIGH

`arrivalOk()` is a **lower bound only**. On the default 10-second window the
floor is ≤ 0 for 80% of it, so `elapsedMs: 0` is accepted. Rank is
`elapsedMs` ascending. The client's guard is bypassed by writing Firestore
directly. The grace is well argued in [`answer-window.md`](answer-window.md);
what was nowhere on record is that it leaves the default window unguarded.

**Fix:** do not cut grace. Stamp `at: serverTimestamp()` beside the claimed
time, optional so old clients still score. `(at − openedAt) − elapsedMs` is
then the implied network delay. One round of that is the number that
replaces 8000, not a second anecdote.

### S3 — `joinedAt` is unbounded, so quizmaster is one write away · HIGH

`playerOk()` checks `joinedAt is number` and nothing else.
`resolveQuizmaster` returns the lowest `joinedAt`. So
`players.<myuid>.joinedAt: 0` seizes the role: every phase transition,
every reveal, every `scores.*` write, the `games/` record.

**Fix:** a new own-entry is within ±300,000 ms of `request.time`; an
existing own-entry is **unchanged**. Also closes the accidental stale
timestamp (`state.ts` / room `6JA5`).

**Known casualty, named:** a player reaped in a long lobby is written back
as a *new* entry with their old `joinedAt`. If that is more than five
minutes ago the restore is refused. Reap is lobby-only; a round itself is
usually inside the window. Recorded rather than widened — widening reopens
the steal.

### S4 — RTDB presence makes room codes harvestable · MEDIUM

`presence/$code` is readable by any signed-in client with `$code`
unconstrained. Sweeping the 707,281-code space returns the **names** of
everyone in each live room. Dropping `list` on `/rooms` was supposed to keep
a four-character code "a reasonable secret while it cannot be harvested in
one query". This is a harvest in one loop.

The name is written and never read. The reaper takes `Object.keys` only.

**Fix:** stop writing `name`. Two RTDB publishes, in this order, or presence
stops working and the room fills with ghosts:

1. Relax `.validate` to `hasChildren(['at'])`, **keep** the `name` child
   validator. Old and new clients both pass. Pasted 21 September.
2. Deploy the client without `name`. Live `index-OfECpKrx`, 21 September 16:51.
3. Remove the `name` child rule so `$other` refuses it. Pasted 21 September
   16:56; `{ name, at }` denied.

### S5 — Docs that were wrong · LOW

- `wager.md` / `scoring.md` still said the `elapsedMs` bound was unbuilt. It
  shipped 8 September, merged the 10th. `ideas-review.md` §5 was still
  backlog.
- `security.md` claimed season rules enforce `best <= points`. Removed
  4 September; the rules comment records it.
- No decision doc stated that an answer landing after the buzzer but before
  the reveal fold still scores. `useRoom.ts` notes it only in a comment.

## Decisions Greg has already made

Do not re-open these.

| Question | Decision |
|---|---|
| Server stamp on answers? | **Yes, detect only.** `elapsedMs` stays the rank key. |
| Cut `elapsedGraceMs` now? | **No. Leave at 8000 and measure first.** |
| Room-code harvest? | **Drop `name` from presence.** Not lengthening the code. |
| Cleanup scope? | **Dead code + the `shuffle` merge only.** Separate branch. |

## Deploy order

A client ahead of the console has every answer refused **in silence**.

1. Paste `firestore.rules`. Done 21 September, 80/80.
2. Publish relaxed `database.rules.json`. Done 21 September.
3. `npm run check-rules` — allow FAIL → PASS is the paste proof. Done.
4. Deploy the client via CI from `master`. Done: `index-OfECpKrx`,
   gh-pages `f78379e`, Pages `built` 16:51:33.
5. Publish RTDB step 3 (refuse `name`). Done 21 September, 16:56; `{ name, at }`
   denied, `{ at }` allowed, 80/80.
6. Play one round. `npm run audit-players`. The implied-delay column is the
   Alistair answer. **This is the remaining step.**

Steps 1, 2, 4, 5 and 6 are Greg's. A branch ends at *ready for review*.

## Out of scope — decided, not forgotten

Ranking on the server stamp; cutting grace; lengthening the room code;
bounding `scores` values (rules cannot iterate a map; the audit detector
currently reads clean); folding `sleep` / `runningDirect`; the unbounded
client-chosen paths under `games/`, `recovery/`, `questionVotes/`
([`audit-backlog.md`](audit-backlog.md) §2); the steal-reads-unfiltered-scores
bug (§1, HIGH, still open).
