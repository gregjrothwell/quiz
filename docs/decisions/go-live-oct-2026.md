# Go-live — the 5 October work

> **Owner: Greg Rothwell. Last updated: 5 October 2026. Budget: 250 lines.**

Everything built on 5 October, on one local branch, and the steps to put it live. **Prepared,
not started:** nothing here has been pushed, seeded or deployed. Greg checks it in a fresh
session first.

## What is on the branch

`catchphrase-bonus`, **27 commits ahead of `origin/master` and none behind** (fetched 5 October).
It sits on `live-after-65`, which is on GitHub but unmerged and docs-only, so those commits come
along in the same PR. It touches 35 files.

| Change | Decision doc | Player-visible |
|---|---|---|
| Bonus Catchphrase: every 5th question under nine squares, worth double | [`catchphrase-difficulty.md`](catchphrase-difficulty.md#built--5-october-2026) | yes |
| Catchphrase harder batch: 30 → 60, Mr Fries in 21 | [`catchphrase-harder.md`](catchphrase-harder.md) | yes, new pictures |
| Mr Fries, the house character (the hook; his pictures arrive with the batch) | [`mr-fries.md`](mr-fries.md) | via the batch |
| Sleeves 104 → 168 | [`sleeves-growth.md`](sleeves-growth.md#built--5-october-2026-9095987-local) | yes |
| `npm run freshness` and the weekday scheduled task | [`pack-freshness.md`](pack-freshness.md) | no |
| Two parked round ideas | [`parked-ideas.md`](parked-ideas.md) | no |

**No rule, vault-shape or App Check change.** `check-rules` is not required by this release,
but it costs nothing to run (91/91 on 27 September).

## When

**Not Friday 9 October**: that is the 30-player round, and the handover says to run nothing
against live that day. **Claude's suggestion: after Friday.** A deploy on the 7th or 8th means
Friday plays on new scoring code (Bonus Catchphrase), though only a Catchphrase round reaches it.
Greg's call.

## The steps, in order

Each step names who does it. *Claude* means any session, on Greg's word.

1. **Greg reviews.** `git log --oneline origin/master..catchphrase-bonus`, then the decision
   docs above. Catchphrase is played blind: **do not open `hand-catchphrase-data.ts`,
   `.cache/catchphrase/`, or the new `catchphrase.json`.**
2. **Claude: verify.** `npm run typecheck && npm run lint && npm test`, which must be clean.
   `npm run check-bundle`.
3. **Claude: seed the vault** (a live write, adds only):
   `npm run seed-vault -- --pack sleeves,catchphrase`.
   Expect **64 Sleeves and 30 Catchphrase added, nothing changed**. Then run it again: everything
   should read back as already correct. New ids that are not seeded **stall at the reveal**
   (Outstanding 10).
4. **Claude: prove a reveal on a new id.** `npm run host-room -- 10 --pack catchphrase` plays
   the *first two* puzzles, which are old ones. Proving a new Catchphrase id needs the host-room
   pack list to take a slug. That is not built; the vault read-back in step 3 is the proof
   instead. Say so in the PR.
5. **Greg: "push".** Claude pushes `catchphrase-bonus` and opens the PR with the body below.
6. **CI:** the secret check and Playwright against the emulators. Merge (Greg).
7. **Check the deploy:** gh-pages **and** `pages/builds` say `built`, and the live
   `index-*.js` matches a local build of the merge.
8. **Claude: after the deploy.** `npm run freshness` should show Catchphrase at about 2.3
   fresh rounds and Sleeves at about 5. The scheduled task reports the next weekday at
   08:12.
9. **The first office Catchphrase round is the live check** for both Catchphrase changes.
   Read it with `read-games`:
   - Bonus Catchphrase: hit rate on questions 5, 10 and 15 against the rest;
   - the harder batch: hit rate and time from options to answer on new puzzles against
     93% and 1.7 s. Ids tell old from new; `kind` in the data file gives the hit rate by
     kind.

## The PR body (draft)

> **Catchphrase gets harder, Sleeves gets fresh.**
>
> - **Bonus Catchphrase.** Every 5th Catchphrase question starts under a 3×3 of squares
>   that lift one every tenth of the shared clock, in a seeded order. It scores double: base
>   and rank, not the stake or the steal. Chosen by position, so no field, rule or paste;
>   `maxBest()` (200k) bounds the worst case of about 120k.
> - **30 harder Catchphrase puzzles** (rebus, lettered, sound-alike; at most a third literal),
>   with **Mr Fries**, the house character, in 21. The first 30 prompts are pinned by hash.
> - **Sleeves 104 → 168.** Two candidate batches, 46 refused by eye, songs checked on a 20 s
>   window.
> - **`npm run freshness`**: which packs the office is running out of, read from the live site.
>
> Seeded before merge (`seed-vault -- --pack sleeves,catchphrase`, read back clean). Not
> covered: no new Catchphrase id has been through a live reveal (host-room plays the first
> two); the first office round is the live check for Bonus Catchphrase.
>
> 🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Open for Greg, none blocking

- **Strange Days** (live now): a wrong answer is the album *The Doors* under a cover that
  says THE DOORS. Swap it?
- **`tune-audit` default window for Sleeves is still 10 s**, stale since 30 September. Change
  it to 20?
- **Reasonable Doubt / Future Nostalgia** still show a single's artwork (Outstanding 15).
  *Humanz* had the same fault and was pinned to the album; the same fix would work for both.
- **Bonus Catchphrase × the wager:** every round length ends on a bonus, so with the wager
  on, the last question is both. Tested: the right answer wins 2,000 plus the stake.
