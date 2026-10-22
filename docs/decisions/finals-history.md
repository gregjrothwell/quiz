# Finals history on the seats

> **Owner: Greg Rothwell. Last updated: 22 October 2026. Budget: 250 lines.**

**Status: LIVE 21 October 2026** (#104, merge `627d5f9`, gh-pages `860e6a5`;
`check-rules` 129/129). Was: built, not merged. Greg approved the story and all
ten acceptance criteria, and the backfill (by uid). Backfill: Greg OK'd `--go`
after the deploy; 12 rows written, and a dry run then read back all 12 as kept. The old `finals-history` branch holds unrelated #100
docs and is not this work.

Each Share or Shaft finalist's record goes on their seat, e.g. *"7 finals · shared 5
· shafted 2 · got shafted 2"*. It shows while they talk, and again at the reveal
with tonight added. TV finalists meet once. This office plays most mornings, so
what somebody did yesterday is the whole conversation in the 60 seconds
([`share-or-shaft.md`](share-or-shaft.md)).

## Story

> As someone in a Share or Shaft final, or watching one, I want to see what each
> finalist has done in their earlier finals while they talk, so the room can
> argue about trust using what actually happened instead of what people remember.

## Acceptance criteria

1. **The line.** Each seat shows `N finals · shared N · shafted N · got shafted N`.
   It says `1 final` for one, `First final` for none, and appends `· no pick N`
   only when N > 0. Zeros are shown, because "never been shafted" is part of
   the argument.
2. **What counts.** *Shared* and *shafted* are the picks that counted, after the
   whistle. A pick nobody made counts as *no pick*, not as share: the payout
   treats it as share, but the room saw "No pick", and a reputation should say
   what the room saw. *Got shafted* means the opponent's counted pick was shaft,
   both-shaft included.
3. **When it shows.** On the seat from the talk through to the whistle, as the
   record coming into tonight. At the reveal, once the seats settle, it shows
   the record with tonight added, so the room sees it change. It is hidden
   during the clash and the shatter, so nothing breaks on top of it.
4. **Banked with the round.** When a finalist's device banks at `finished`,
   their season row gains the final in the same transaction as the rest of the
   round. It is idempotent on `gameId`, the same as everything else in the row.
   Non-finalists' rows are unchanged.
5. **Claims keep it.** `foldRecords` (claiming a recovery code) adds the
   tallies together, so claiming never wipes a record.
6. **Rules, both directions.** The season row accepts the four new fields,
   bounded: whole numbers ≥ 0, `finals ≤ played`, `shared + shafted ≤ finals`,
   `gotShafted ≤ finals`. Absent counts as zero, so old rows and old bundles
   still bank. `check-rules` gets **one allow case**, banking a row that carries
   the tallies. It must FAIL against today's live rules and PASS once CI has
   published the new ones. It also gets deny cases for each bound.
7. **Read cheaply.** Each device reads the two finalists' season rows once when
   the final opens. A failed read shows no line and never blocks the final,
   the same as the opening titles.
8. **History counts from 24 September** — backfill approved (below). Without
   it, everyone would start at `First final`.
9. **Gallery.** `#/preview` fixtures, appended so earlier indexes stay put:
   talk with two records (`#/preview/59`), a first final (`60`), the settled
   reveal with tonight added (`61`), and a no-pick (`62`). Desktop and 375px,
   no sideways scroll.
10. **Done.** `typecheck`, `lint`, `test`, `e2e` clean. A PR, not merged.
    Merging deploys.

## The data path

**Verified 21 Oct 2026, with Admin SDK read-only probes against live:**

- `games/` holds **19 finals** (24 Sep → 21 Oct), with 12 distinct finalists.
  There were 9 shares, 10 single shafts and no double-shafts.
- **Every finalist's uid in `games/` is their season row id.** None of the 12
  has claimed a recovery code, so `claims/{uid}` → `playerId` never comes into
  it. So a backfill matches **by uid, exactly**, not by name. Matching by name
  would have been wrong twice: one name differs only in case between the
  record and the row, and two different players share a name with separate
  rows.
- `games/` is complete for what was played. Of the 35 distinct rounds that
  season rows still list in `recent` since 24 Sep, **35** have a `games/`
  record.

**Where the tally lives: four fields on the season row** (`finals`, `shared`,
`shafted`, `gotShafted`), banked by `bankGame`. This is how honours, `form`
and `team` were added, and `PLAYER_RECORD_KEYS` is tested against the rules'
`hasOnly` list. The alternative was a separate `finals/{playerId}` document,
which leaves the hottest rule alone. Turned down: it needs a second write and
its own idempotency guard outside the bank's transaction, plus its own claim
fold. Its one advantage, not being erased by an old bundle, is better handled
by a backfill that can be run again.

**What reaches the bank.** The finalist's device already holds `room.standoff`
at `finished` (it is cleared only by `reset`). A pure `finalFor(standoff, uid)`
returns `{ pick, opponent }` or nothing, and that is added to `GameOutcome`.

**Cost.** Each device reads 2 rows per final, so a 10-person room reads 20.
A six-player night is ~1,812 reads ([`cost.md`](cost.md)), plus 12 for this.
The alternative, where the quizmaster reads both rows and writes them into the
room, would change the room rules to save about 18 reads.

## Where it lives

`src/engine/finals.ts` is the line, `finalFor`, and the bounds. `bankGame`
carries the four fields on every write and adds one only for a finalist;
`foldRecords` sums them. `loadFinalistRecords` is the two-row read, called
once from `useFinalistRecords`. The seat is `ShareOrShaft`. `finalsOk()` in
`firestore.rules` is the bound; the allow case in `scripts/check-rules.ts`
fails until CI publishes it.

## Deploy order and the traps

- **Rules before client:** CI publishes the rules before the site, in one run
  ([`rules-from-ci.md`](rules-from-ci.md)). The new fields are optional, so the
  live client is unaffected until the site lands.
- **Old bundles erase the fields.** `bankGame` is a whole-document `set`, so a
  phone still on yesterday's bundle wipes its own tallies the next time it
  banks. It only affects that player's own row and only during the deploy
  window. The backfill is built to be re-run and repairs it.
- **Release bundling:** anything else going live the same day ships with it
  through one `release-<date>` branch (AGENTS.md, 12 Oct rule). An urgent fix
  still ships alone.

## Greg's call, 21 October 2026: backfill, by uid

| | Backfill (chosen) | Start counting now |
|---|---|---|
| Day one | Each finalist's real record since 24 Sep (most finals by one player: 8) | Everyone shows `First final` |
| Work | One `backfill-finals` script, shaped like `backfill-form` | None |
| Risk | A live write to ≤ 12 season rows. Dry run first, `--go` needs your OK | None |

`npm run backfill-finals` reads every final in `games/`, maps each by uid, and
would write the four fields on `season-2` rows only. It is run **after** the
deploy, so old bundles cannot erase it straight away, and re-run a few days
later to repair anything an old bundle did erase. It **never lowers** a count
already on the row, and it **refuses to write a row the rules would refuse**,
because a malformed row would get that player's next bank refused. That is the
postmortem's failure mode, and it would land on one person. Dry run by default;
`-- --go` writes. It was not run from this build — no credentials, and a dry
run is still a live read.

## 22 October 2026: nobody's round banked

**What happened.** The office played two rounds in B498 (08:52Z, 08:58Z), the
first since #104 went live. No device banked either one: `season-2` and
`week-2026-W43` have no row written since the backfill at 19:43Z on the 21st
(read with the Admin SDK, 22 Oct). Every device showed "Missing or insufficient
permissions" over the podium, and the podium juddered.

**Why.** Firestore allows 1,000 expressions per request (documented limit,
checked 22 Oct). `finalsOk()` called `get(field, 0)` fourteen times. On a
regular's row — six `recent` entries, all checked slot by slot — that took the
rule over the limit, and an over-limit rule is a refusal. Proved in the
emulator against the published rule: `recent` of 1–5 passed, 6 was refused,
with or without the finals fields. Removing `finalsOk()` let 6 through.

**Why every check passed.** `check-rules` and the e2e write light rows. The 21
Oct allow case wrote finals onto a row with no `recent`. Nothing wrote a row as
heavy as a regular's.

**The judder.** `recordGame` failing calls `report`, which puts a `.notice`
above the stage — in flow, so the podium was shoved down mid-build. The failed
bank clears `bankedRef`, so it retried on room updates.

**The fix.** Same checks, cheaper: the row goes in once as `d`, each optional
field is read once into a `let`, and the six `recent` slots take the list and
bound as arguments. Headroom on the heaviest row, measured by padding the rule
with `d.played >= 0` conditions: before, it was over; a minimal `let`-only
`finalsOk` passed with 5–9 spare; this version passes with 20–29 spare.
**That is not much.** The next field added to this row must be paid for, and
`e2e/season-bank.spec.ts` plus `check-rules`' full-row case are there to say so.

**Not done:** today's two rounds are not on the table. Whether to bank them from
`games/` is Greg's call.

## Open

| Decision | Owner |
|---|---|
| The wording of the line, if the room finds it too long at phone width | Greg, after one final |
