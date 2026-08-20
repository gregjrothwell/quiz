# What it costs

> **Owner: Greg Rothwell. Last updated: 20 August 2026. Budget: 250 lines.**

Moved verbatim out of `docs/HANDOVER.md` on 20 August 2026, when that file reached
2,422 lines. The text is unchanged; only where it lives is.

## What it all costs, and how much room is left

**Counted 15 August 2026, and it is now one command:**

```bash
npm run take-stock
```

Aggregate counts, so the whole thing costs single-digit reads. **This is the
script to reach for instead of `seed-vault`**, which reads every answer to work
out what is new and has taken the game down for a day. It needs the service
account, because `list` is denied to clients on `/rooms` and `/recovery` and a
count is a query.

| | |
|---|---|
| rooms | 79 — of which **1 carries `expiresAt`** |
| vault answers | 13,593 |
| `season-2` players | 20 |
| recovery codes | 0 |
| identity claims | 0 |

The last two are zero because they shipped that morning.

`take-stock` now also counts how many rooms carry `expiresAt`, which is the
number that says how much of the backlog a TTL policy can actually reach — and
the check that the field is still being written at all. The 78 without it
predate the change and will sit there until somebody removes them from the
console.

### Reads, for a six-player night

| | |
|---|---|
| The round itself | ~1,500 |
| The opening titles | ~12 — six for the digest, six for the fan-out |
| Everyone opening the season board | ~300 — 50 rows each |
| **A full night** | **~1,812** |

**About 27 full nights a day against a 50,000-read free tier, for a weekly
quiz.** Writes are nowhere near the limit: a game is well under 200 against
20,000 a day.

### The number that matters is not 1,812, it is the shape

**That figure is for six players, and the cost is quadratic in room size.**
Every client holds an unfiltered `onSnapshot` on the answers subcollection, so
each answer written is one changed document delivered to all *N* listeners:

```
reads ≈ Q·N²  (answers)  +  ~3·Q·N  (room-document transitions)
```

| Players | Reads, 15 questions | Games/day on the free tier |
|---|---|---|
| 6 | ~810 | ~61 |
| 12 | ~2,700 | ~18 |
| 25 | ~10,500 | ~4.7 |
| 50 | ~39,750 | ~1.25 |
| 100 | ~154,500 | **one game cannot finish** |

Doubling the room roughly quadruples the bill. Nothing about an office quiz gets
near this — but it is the reason "how many nights a day" is a misleading way to
hold the budget, and the first thing to re-derive if the rooms ever get bigger.

**The wall that arrives first is not Firestore, though.** The Realtime Database
on the Spark plan caps at **100 simultaneous connections, project-wide**, and
every player holds one for presence. That is around sixteen concurrent
six-player rooms across the whole project, and connections are refused rather
than degraded. Blaze raises it to 200,000.

If the reads ever genuinely bind, the fix is not a rewrite: **move the answers
fan-out to the Realtime Database**, which is already wired up, already carries
presence, and is billed on bytes rather than per document. A 50-player game is
~7.5 MB against a 10 GB/month allowance — roughly 35× the headroom, on the same
free tier. It is contained to `useRoom.ts`, because `submitAnswer` and
`room.answers` are the only surface anything else sees.

### What the season work actually added

Almost nothing per game, which was the point of every design decision that
looked fussy at the time:

- **The opening titles cost twelve reads, not three hundred.** `loadForm` runs
  once, on the quizmaster's device, and everybody else learns the result from a
  room update they were already receiving. `loadSeason` would have been fifty
  rows per person.
- **`ownsPlayer` costs nothing for an unclaimed player.** Rules short-circuit and
  the uid branch is first, so only somebody who has claimed an identity pays a
  read — one, once per game, when their row is banked.
- **Honours, the merge and the review are free.** Honours ride inside the
  transaction that already reads the row; the merge is two reads on a claim,
  which happens once ever; the review reads a log that is already in memory.

**The season board was the one line worth watching**, and it is the one thing
here that is user-driven rather than per-game: 50 reads every time somebody
opened it, and the final screen points them at it. At six people that was 300 a
night.

**It is now cached for a minute** (`TABLE_CACHE_MS` in `src/lib/season.ts`),
which is aimed at the pattern that actually costs — one person bouncing between
the final screen and the board and back — rather than at one person looking
once. Both writers in that file clear the cache, so your own game and your own
claim always show immediately; the window can only ever hide somebody else's
row, for less than a minute. A lower `TABLE_LIMIT` is still the next lever if it
ever matters.

### The two slow leaks

- **Rooms.** 79 after a couple of months, at roughly one per game, every one
  holding players' names, and `allow delete: if false`. **Every room created
  from 15 August 2026 carries an `expiresAt` timestamp** so a Firestore TTL
  policy has something to expire against — the client half is done, and **the
  console half is not.** Until the policy exists, nothing is being deleted.

  > ### Firestore TTL policies need billing enabled
  >
  > **Creating one on this project fails with `403: Project quiz-d686e has
  > billing disabled`.** TTL is a Blaze feature. The Firebase and Cloud TTL
  > documentation does not say so anywhere on the page — it is discovered at the
  > Create Policy button. Written down here so nobody spends another afternoon
  > looking for the setting.
  >
  > So the answer is **`npm run prune-rooms`**, not a policy. It does the same
  > job from a machine that already holds the service-account key, and it is
  > better in two ways: it deletes the `answers` and `reveal` subcollections,
  > which a TTL sweep orphans forever, and with `--legacy` it reaches the rooms
  > written before `expiresAt` existed, which a policy can never touch.
  >
  > ```bash
  > npm run prune-rooms                 # lists what it would delete, deletes nothing
  > npm run prune-rooms -- --list       # every room, its expiry, and who is in it
  > npm run prune-rooms -- --legacy     # also catches rooms with no expiresAt
  > npm run prune-rooms -- --code AB12  # one named room, whatever its expiry
  > npm run prune-rooms -- --go         # actually deletes
  > ```
  >
  > `--list` is there because `--code` needs a code and nothing else can give
  > you one: clients cannot query `/rooms` at all — `list` is denied, since the
  > code is the only thing protecting a room — and `take-stock` only counts.
  > **`--code` is also the answer to "take my name off that room"**, which
  > previously meant the console. The listing names the players in each room
  > before anything is deleted, because a four-character code says nothing about
  > whether a room matters.
  >
  > It is capped at 200 rooms a run and skips `rules-check-live`, which the
  > preflight owns and recreates. Nothing runs it automatically; at one room per
  > game that is a job for once a quarter, and `take-stock` says when it is due.

  `expiresAt` is still the right field and is still written, because it is what
  makes "past its expiry" a question the data can answer rather than a guess
  about age. The retention lives in `ROOM_RETENTION_MS` in `useRoom.ts` and is
  thirty days.

  **If this project ever moves to Blaze**, a TTL policy becomes available and is
  worth having as well — it is automatic where the script is not. Google Cloud
  console → Firestore → Databases → `(default)` → Time-to-live → Create Policy,
  collection group `rooms`, timestamp field `expiresAt`, **expiration offset 0**
  because the thirty days are already in the field. The field name is **typed
  in, not chosen from a list**: Firestore has no schema, so the form cannot
  enumerate fields, and it does not need the field to exist yet either. Even
  then, keep the script — a policy still orphans the subcollections.

  No rules change was needed for `expiresAt`, which is worth knowing before
  anybody goes looking: `wellFormed()` bounds the fields it names and does not
  `hasOnly` the document's keys, the same reason `openedAt` can be written
  without being declared.

  79 rooms currently predate `expiresAt`. `npm run prune-rooms -- --legacy`
  lists them; nothing has been deleted.

- **Recovery codes are never tidied**, though they are deletable by their owner,
  which is how a leaked one is revoked. One document per person who ever asks
  for a code, so it is far slower than rooms.

---
