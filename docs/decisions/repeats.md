# Why the office kept seeing the same questions

> **Owner: Greg Rothwell. Last updated: 2 September 2026. Budget: 250 lines.**

Office feedback after the round of 1 September: too many repeats, and a suspicion
that the squad work broke something. The suspicion was half right, and the half
that was wrong is the more useful half.

## What the squad work actually did

Nothing to selection. `selectQuestions` is byte-identical since 1 August and the
squad commits never touched it. But `7d25cac` — *"Shut the door on the room
backlog"*, 15 August — is an ancestor of `squads-and-weekly-boards`, so it
**reached the office in the same deploy** (PR #2, 20 August). Same deploy,
different commit. That is why it felt like squads.

## The instrument came first

Three hypotheses were live and they needed different fixes, so nothing was
written until a reading separated them.

`npm run check-rules` cleared the first: **`read and write a pack's question
history` PASSes**, so the `seasons/{season}/asked/{packId}` block survived the
squad paste. Had it not, both the read and the write would have been refused and
both are swallowed — the game plays perfectly and silently loses all repeat
protection, which is the failure this project keeps almost having.

`npm run asked-probe` is new and is the instrument that settled the rest. It
prints, per pack, how many ids the season remembers and when they were last
written. **The reading that matters is a comparison, not a number**: a healthy
pack climbs by the round length every sitting.

```
  season-2    general-knowledge    400     400  2026-09-02  (0d ago)
  season-2    uk-leaning           106     106  2026-09-02  (0d ago)
  season-2    tv-and-film           40      40  2026-09-02  (0d ago)
```

General Knowledge sitting at exactly 400 — the old `ASKED_LIMIT` — is a pack that
had begun forgetting its oldest questions and serving them again. Raised to 500,
which is the most `firestore.rules` allows without a paste (it bounds the list at
600, and the headroom exists so a client one deploy ahead is not locked out).

## The defect: a failed read wiped the history

`loadAsked` returned an empty set both when a pack had never been played and when
the read failed. `handleStart` handed that same set to `recordAsked` as *what the
season already knew*, and `recordAsked` writes the document whole — so **one
transient failure replaced up to 400 remembered ids with the fifteen from that
round**, permanently. Before `7d25cac`, `recordAsked` re-read the document itself,
so a failed read cost one round's preference and nothing more.

Nothing caught it because the merge and the cap were inline in `src/lib/season.ts`,
which imports `src/firebase.ts`, which `npm test` cannot load. They are now
`src/engine/askedHistory.ts`, where `AskedHistory` carries whether the read
actually happened and `askedToWrite` returns `null` rather than guessing.

**Not writing costs one round of memory. Writing costs all of it.**

## The real cause was the pools, and it is measurable

Cross-referencing the live history against the packs, per difficulty:

| pack | easy asked/pool | hard asked/pool |
|---|---|---|
| uk-leaning | **54 / 54** | 21 / 44 |
| sport | 12 / 33 | **12 / 15** |
| general-knowledge | 105 / 159 | **48 / 59** |

Only ~4,000 of 14,176 published questions carry a real rating; the OpenTriviaQA
half is unrated and defaults to `medium`. The Ladder — the lobby default — takes
30% from each end every round, so it had been draining buckets of 15 to 59 while
`medium` sat over a thousand deep. Picking **Gentle on Best of British was a
round of pure repeats**, and no amount of history could have prevented it.

So the two thin levels are withdrawn from the picker. The `Level` type keeps them
and so does `selectQuestions`; this comes back the moment `stats/{questionId}`
gives the corpus a rating the office earned.

## The change that was measured and then *not* made

The plan said to make the Ladder fall back to a repeat within each difficulty
when that bucket ran dry. **The measurement killed it.** With hard buckets of 15
to 59 and every one of them nearly spent, a per-difficulty fallback would serve a
repeated hard question *every single round* on the default level — injecting
repeats into the exact complaint being fixed.

Today's behaviour is the no-repeat one: an exhausted bucket is substituted from
the level with the most left. Six simulated rounds against the real packs and the
real live history give **zero repeats** on all three packs tested. The Ladder is
what pays: General Knowledge loses its top rung by round five, Sport after round
one, and Best of British has no bottom rung at all.

That cost is real and is now in the handover as an open item. It is a `stats`
problem, not a selection one — which is the whole point of writing this down
rather than fixing the wrong layer.

## What did change in `buildRamp`

Fresh questions and repeats are two passes rather than one merged pool. Merged,
`bucketByDifficulty` shuffled a repeat in beside a fresh question of the same
level and could serve the repeat while the fresh one sat there — and the gate
deciding whether repeats were admitted at all was `fresh.length >= wanted` over
the **pool**, which says nothing about any one difficulty. Both are gone.

## Evidence

- `check-rules`: the `asked` block PASSes, both directions.
- `asked-probe` before and after a real round in the browser: `tv-and-film`
  **40 → 55**, appended rather than overwritten. That is the proof.
- 525 tests, types and lint clean.
- The refusing direction — a failed read writing nothing — is covered by
  `askedHistory.test.ts` and **not** proved live, because forcing it would mean
  publishing a broken ruleset. Said plainly rather than implied.
