# The round, kept — `games/{gameId}`

> **Owner: Greg Rothwell. Last updated: 8 September 2026. Budget: 250 lines.**

Built 8 September 2026 on branch `keep-the-round`, from the research in
[`what-to-build-next.md`](what-to-build-next.md) (PR #31, merged into this branch
so the two spine entries could sit together). **Live since 19:48 the same day,
bundle `index-BDZpMBAG`**, rules pasted first — the order at the end was
followed. Nothing kept yet: that needs a round to reach `finished`.

## The finding it answers

`rooms/{code}/answers/{uid}` is one document per player, **overwritten every
question**. At the whistle the room holds the questions (`rooms/{code}.questions`),
the right answers (`rooms/{code}/reveal/{questionId}`) and the final scores — and
not one response. `3QDV` finished fifteen questions and held eight answer
documents, all on question fifteen. Rooms then expire.

That is why the melody round, the wager, the steal and `firstMs` all ended on
"hard to say": the numbers were never kept. Nothing here is a feature anybody
sees. It is one write at the end of a game so the next question about a round
can be answered from what people did rather than from what they remember.

## The document

`games/{gameId}`, one per finished round, keyed on the `gameId` the room mints
when a round starts — so "Another round" in the same room cannot overwrite the
last, and a reload on the final screen cannot file it twice.

| Field | What |
|---|---|
| `roomCode`, `packId`, `packTitle`, `durationSecs` | The round as the lobby set it |
| `wagerEnabled`, `stealEnabled`, `jigsawEnabled` | The flags it was played under |
| `players` | `{ uid: { name, squad? } }` — the frozen table at the whistle |
| `scores` | `{ uid: number }`, the same frozen table |
| `questions[]` | Per question: `id`, `index`, `category`, `difficulty`, `kind`, `correctIndex`, `skipped`, `answers`, `deltas` |
| `questions[].answers` | `{ uid: { optionIndex, elapsedMs, firstMs?, wager? } }` — rebuilt field by field, as `liveAnswers` does |
| `writtenBy` | The uid whose device wrote it; the only uid the rules let delete it |
| `finishedAt` | `serverTimestamp()`, pinned by the rules to `request.time` |

`kind` is `text`, `melody` or `picture`, derived from `voices`/`image` on the
question, so a pack needs nothing new written into it. A fifteen-question round
of eight with every answer changed and staked is about 10 kB against the 1 MiB
ceiling; the test asserts under 64 kB.

**Not in it**: `joinedAt` and `playerId` (the room's business and the season's,
respectively), and nothing derived — awards, ranks, form — because every one of
those is a pure function of what is kept and belongs in the reader.

### A skipped question is kept, and marked

The fold in [`src/engine/gameRecord.ts`](../../src/engine/gameRecord.ts) refuses
a log with a hole in it — a question this device neither saw revealed nor saw
skipped — and **accepts a round with a skipped question**, which is weaker than
`sawWholeGame` and deliberately so. Honours cannot be computed off a partial
log: a fastest finger over some of the questions is wrong. A *record* of a round
with a skipped question is not partial — the question was asked, nobody was
scored on it, and saying so is the truth of the round.

The alternative was rejected on one observation: the skip is the tool for a bad
question, and the question most likely to be skipped tonight is a tune nobody
recognised. Gating on `sawWholeGame` would have discarded exactly the melody
rounds this exists to explain.

Two shapes, and the reader has to know the difference. A question skipped
**before** its reveal has `skipped: true`, `correctIndex: null` and no answers.
One skipped **after** its reveal keeps its answers and the deltas the reveal
awarded — those happened — but the reducer took the points back, so `skipped`
is the flag that says "leave these deltas out of any sum". `read-games` does.

## Who writes it, and when

**The quizmaster's device, when the room reaches `finished`.** The effect sits
in `App.tsx` beside the season bank, not in `useRoom` as the research said — the
log (`useGameLog`) and the frozen table (`useFinalSnapshot`) both live there,
and the write needs both. Ref-guarded per `gameId` like `bankedRef`, and it
folds against the frozen `players` and `scores` for the reason the season write
does: a winner who presses Leave before this lands would otherwise vanish from
the record of a round they played.

**One writer, not every device.** The season row is banked per client because
each row belongs to its owner and the rules can enforce that. This document
belongs to the round, so one writer is enough — and the rules allow `create` and
refuse `update`, so every extra device would be a refused write per game for
nothing.

**Nobody is told when it fails.** A record for later must not put an error over
everybody's standings on the final screen, which is where a missing paste would
otherwise announce itself. `keepGameRecord` in
[`src/lib/gameRecords.ts`](../../src/lib/gameRecords.ts) never rejects; it
returns what happened:

- `refused` — the rules said no. Either the block is not published or the record
  already exists. Neither changes on a retry, so the ref stays set and nothing
  retries. Without this a missing paste would be one refused write per room
  update, forever.
- `failed` — offline, a timeout. The ref clears and the next room update tries
  again, exactly as the season write does. No timer, so it cannot spin.

That silence is the one real cost. **`npm run check-rules` is the only thing that
knows whether rounds are being kept**, and its allow case is the only case that
proves it — the six deny cases pass vacuously while the block does not exist.

## Where it lives, and why not in the room

A global collection, for the three reasons `questionVotes` is:

1. **Cost.** Every client holds an unfiltered listener on the room's
   subcollections, so `rooms/{code}/games` would be re-read by every device — a
   second `Q·N²` term in [`cost.md`](cost.md) for data nobody in the room needs.
2. **It has to outlive the room.** `prune-rooms` deletes rooms and their
   subcollections. A record banked inside one would be swept by the tool whose
   job is sweeping rooms.
3. **The id is the deduplication.** `gameId` is fresh per round; a room code is
   reused all night.

## The rules

`match /games/{gameId}` in `firestore.rules`, after the votes block. `read: if
false`; `create` when signed in and `gameOk()`; `update: if false`; `delete` by
`writtenBy` only.

`gameOk()` bounds the **top level only**: `hasOnly` and `hasAll` of exactly the
twelve keys, string lengths, `is bool`/`is int`/`is map`/`is list`, `players`
and `scores` at most 60, `questions` at most 50, `writtenBy == request.auth.uid`,
the writer in `players`, and `finishedAt == request.time`. Rules cannot walk a
list, so what is inside `questions` is trusted — the same trust as the room's
own `questions` array, and capped by the same document limit. The 60 and 50
mirror `maxPlayers()` and `maxQuestions()`, which are scoped to `/rooms` and
cannot be called from here; a test reads both literals and fails if they part.

**`delete` is not `if false`**, for the reason recorded on the votes block:
`check-rules` creates one of these on every run, and a row no client can remove
is permanent litter. A writer deleting a record they wrote costs nothing worth
protecting — the record is self-reported, as a season row is. The `rewrite a
kept round` check deletes its probe in a `finally`, because every run signs in
as a fresh uid and a document a crashed run leaves behind is one only the
service account can reach.

**The drift test.** `gameRecord.test.ts` reads `firestore.rules`, extracts the
block, and asserts the `hasOnly` and `hasAll` lists are exactly
`GAME_DOCUMENT_KEYS` — forced red on 8 September by taking `'writtenBy'` out of
the list (1 failed, 22 passed) and green again on restoring it. It also pins
`read: if false`, `update: if false`, and the two ceilings.

## Reading it back

`npm run read-games` — Admin SDK, `GOOGLE_APPLICATION_CREDENTIALS` under
`.secrets/`. `--last n` (default ten), `--game <id>` for every question of one
round, `--pack <id>` filtered in memory so no composite index is needed. The
arithmetic is [`scripts/game-report.ts`](../../scripts/game-report.ts), pure and
under `npm test`; documents are parsed field by field on the way out and a
malformed one is reported and skipped rather than trusted.

Two denominators, and the melody round is why both are shown. **Hit rate is
correct over seats**, so a player who never answered counts as a miss — on
`DTK8` two of eight scored nothing, and a rate over answers alone would have
hidden them. **Answered over seats** sits beside it, so a question nobody
attempted reads as that rather than as everybody getting it wrong. Medians are
over every answer given, right or wrong; snaps are first touches under
`TOO_FAST_TO_READ_MS`. With more than one round shown, a by-kind table follows:
text, melody and picture side by side.

## Evidence, 8 September 2026

- Tests: 23 for the fold and the drift, 5 for the write's outcomes (Firestore
  mocked, the only mock in the suite), 21 for the report. Typecheck and lint
  clean. `imports.test.ts` walks the new script's graph and passes.
- `check-rules` against the live project, before any paste: **64/65**. The one
  FAIL is `keep a finished round` — *expected to be allowed, was denied* — with
  the hint naming the missing block. Every pre-existing case still passes.
- `npm run read-games` against the live project: signs in on the service
  account, queries `games` ordered by `finishedAt`, prints *Nothing kept yet*.
  The populated path — the per-question table and the by-kind tally — has run
  only against fixtures in the test suite, not against a live document.
- **After the paste, same evening: `check-rules` 65/65**, `keep a finished round`
  PASS and the six deny cases now proving something. Merged (#32), deployed as
  `index-BDZpMBAG`; the CDN lied for fifty seconds. `sync-harness 10`: 10/10,
  0 dropped, all ten inside 71ms.

## The order of operations, and it is not optional

Steps 1–3 done on 8 September 2026, in this order. Step 4 is the office's.

1. **Paste `firestore.rules`** into the console.
2. `npm run check-rules` — **65/65**, the allow case flipped. Deny cases prove
   nothing before this step and everything after it.
3. Merge and deploy. Watch the CDN; it has lied three times now.
4. Play a round. `npm run read-games` afterwards is the first real evidence.

Deploying before the paste loses nothing and shows nothing: every write is
refused silently, and only step 2 would say so.

## What it does not cover

- **A quizmaster with a short log writes nothing.** The role is derived, so if
  the host leaves and a later joiner inherits it, that device may have missed
  early reveals; the fold returns null and the round is lost, silently. A
  reload does not do this — the log is in session storage.
- **Self-reported, like everything else.** A crafted client can file any record
  it likes under its own uid. Nothing scores from this collection, so it buys a
  liar nothing.
- **The variant question is open.** An A/B arm derived from
  `hash(gameId, question.id)` can be recomputed offline from what is kept, so
  the schema needs no variant field — but nothing here builds one.
- **The Ladder and `stats/{questionId}` are a fold away, not built.** Every
  number the counters would have banked is in `questions[].answers`.
