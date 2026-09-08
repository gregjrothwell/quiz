# Squads, weeks and the season board

> **Owner: Greg Rothwell. Last updated: 8 September 2026. Budget: 250 lines.**

Moved verbatim out of `docs/HANDOVER.md` on 20 August 2026, when that file reached
2,422 lines. The text is unchanged; only where it lives is.

## Squads, weeks and the average board

**[PR #2](https://github.com/gregjrothwell/quiz/pull/2), merged and deployed 20
August 2026.** Six changes, and **not one of them needed a rules republish** —
which was the design constraint, because a hand-pasted ruleset has broken this
game twice.

**It shipped without a console step**, which is the opposite of the vault and of
durable identity, and is the whole point of the three facts below. `check-rules`
was still run before deploying, because the branch *depends* on the published
ruleset having the `{season}` wildcard and the 40-character `team` bound even
though it changes neither.

> ### The deploy, and the check that is worth repeating
>
> `npm run deploy` published `index-BN2cLnbF.js`, and the CDN served the **old**
> bundle for about twenty seconds afterwards — long enough to look like a failed
> deploy if you only check for a 200.
>
> Tell the two apart the way this file has always said: compare the asset hash
> in the served HTML against the local build, and if they differ, check whether
> the publish itself landed before blaming the cache. `git show
> origin/gh-pages:index.html` and `gh api repos/.../pages/builds/latest` answer
> that in two commands — on 20 August both said the new bundle was already
> there, which turned "did it deploy?" into "wait twenty seconds".

| | |
|---|---|
| **The podium freezes** | at the whistle, so somebody pressing Leave no longer rearranges it on every other device |
| **A weekly board** | `seasons/week-2026-W34/players/{id}` — a week *is* a season id |
| **The season ranks on form** | best four of the last six; three rounds to qualify |
| **Teams became Squads** | Hermes, Bundae, Lurkers, from a dropdown |
| **The week board after the quiz** | filtered to the squad you played for |
| **The question text is sealed** | while the clock runs, and only while it runs |

### Why none of it needed the console

Three facts, each worth keeping:

- **`match /seasons/{season}/players/{playerId}` takes an unconstrained
  wildcard.** So a week bucket is the same document under a different name,
  validated by the same published rule. `check-rules` has always written under a
  throwaway `rules-check` season, which is the proof it was safe.
- **`played` has been stored since the first board.** Ranking on the average
  needed no new field.
- **`team` is bounded as a string ≤ 40 chars.** `Hermes`, `Bundae` and `Lurkers`
  all fit.

> **The stored field is still `team`.** Everything on screen and almost
> everything in the code says *squad*; the Firestore field does not, because it
> is bounded by name in `firestore.rules` and the row is validated with
> `hasOnly`. Renaming it would cost a hand-paste **and** orphan every value
> already written. The two names meet in exactly one place — the mapping in
> `src/lib/season.ts` — and `src/engine/squad.ts` says so at the top.

`check-rules` gained a permanent check that a week-shaped season id still
writes. The rules did not change, but the app now *depends* on that wildcard: if
a future ruleset ever constrains the season segment, every game would bank its
season half and silently lose its week half. That check is what would name it.

### The Lurker split, which is the only clever part

Some regulars belong to neither side and sit with either on the night. Lurkers
is a squad in its own right, and a Lurker is asked who they are playing with —
**the one thing the two tables are ever told differently**: the week's row is
filed under whoever they sat with, and their season record still says Lurkers.
Kept in *session* storage, because sitting with Bundae this week is not a
standing arrangement.

**Proved end to end against live Firebase, 19 August 2026** — a full
ten-question round played as a Lurker with Hermes:

| | |
|---|---|
| Final screen | **"Hermes this week"** under the podium |
| `seasons/season-2/players/{id}` | `team: "Lurkers"` |
| `seasons/week-2026-W34/players/{id}` | `team: "Hermes"` |
| Reload the final screen | still `played: 1` in both |

**That last row closes what this file called the least-proven thing in the
repo.** `recordGame` had never run against a real project and its repeat-write
guard had only been reasoned about. It holds, per bucket, watched. Test rows and
the test room were deleted afterwards.

### The board during the round

Squads now show a running aggregate under the standings while the round is being
played, rather than only on the board afterwards. It shares this file's Lurker
rule — `sideFor` is one function, used by both — and has its own file, because
the live display and the season record are different subsystems that meet at that
one rule: [`live-squads.md`](live-squads.md).

### Things that will bite

- **The season board used to re-sort in the client.** That was the average
  board: `loadTable` asked for the top fifty by points, so past fifty the tail
  was silently wrong. Form is stored and the query is `orderBy('form')` — see
  below. Until people bank against the pasted ruleset that query is empty,
  because Firestore omits documents that lack the field.
- **`setSquad` writes the season row only.** A squad picked in error leaves that
  week's row wrong. Changing it fixes every week after; the wrong one stays
  wrong. Rewriting a banked week means editing a result after the fact, which
  was judged a bigger decision than the fix deserved.
- **The empty week board reads as broken unless it says something.** Clicking
  *This week* on a Monday rendered nothing at all — correct on the final screen,
  where absence under a podium reads as "not yet", and broken-looking as a whole
  screen. `whenEmpty` picks which. Found by trying it, not by reasoning.
- **`rememberedSquad` narrows to the list; `cleanSquad` does not.** A `<select>`
  handed a value matching none of its options renders as though nothing were
  chosen, so a stored legacy name would make the picker silently disagree with
  the record. `cleanSquad` stays tolerant because it also runs on the way *out*
  of Firestore, where narrowing would erase legacy rows from the board.
- **The average board was a rearrangement, not a re-sort.** On the live rows Joe
  went 8th → 1st, Greg 1st → 3rd, Rach 2nd → 10th, Bret 7th → 13th. The people
  who lost were the ones who had turned up most. That was the intended effect
  of ranking on points ÷ played, and the complaint form exists to answer.

The August ship (seal, `host-room`, teams as free text) moved to
[`season-shipped.md`](season-shipped.md) on 8 September 2026, whole, when this
file needed the room.

## Rank on form, not on average — 8 September 2026

**Not** the opening titles. Those are [`form-and-awards.md`](form-and-awards.md).
This is the season table: best four of the last six, golf's dropped scores,
from [ideas-review §9](ideas-review.md).

### The arithmetic

`recent` is an array of `{ gameId, score, at }`, last six, oldest first.
`form` is the sum of the best four of those scores. Fewer than four rounds
sums them all — three good nights are three good nights. Qualifier is still
**three games played**, same floor as the average board: form is computed
with one or two nights, but it does not take a position until there are
three to judge.

`gameId` is what keeps `lastGame` honest: a repeat write, and a claim that
would otherwise push the same night twice, no-ops on the window. `at` is
what lets `foldRecords` merge two devices into one chronological last-six
rather than taking only the newer side (which would wipe a phone's form the
moment a laptop claimed it after one night) or concatenating them (which
would overflow the bound or invent an order).

Pure, beside `bankGame` in `src/engine/records.ts`. The transaction in
`src/lib/season.ts` still does nothing but decide which documents it applies
to.

### Paste, then check-rules, then deploy

`recent` and `form` go on the season document's `hasOnly` list. They are
**optional in the rules** so a row written before them, and a client one
deploy behind, still bank. They are **always written by this client**, so
the *published* ruleset refuses every bank until the list is pasted.

Same trap as live squads and `firstMs`. **This cannot go live before the
paste.** There is no write-without-the-field-then-backfill path: both writers
use `set`, and a field the client does not name is erased by the next game.

Order:

1. Paste `firestore.rules` (`match /seasons/{season}/players/{playerId}` only).
2. `npm run check-rules` — watch **write a season row carrying form** flip
   from FAIL to PASS. The two new deny cases (oversized `recent`, non-int
   `form`) pass against the old ruleset for the wrong reason (`hasOnly`
   refuses the unknown keys) and for the right one after the paste.
3. Then deploy.

A deploy first refuses every `recordGame` write. The week bucket uses the
same rule, so both halves of the night fail together.

### The query

Season `loadTable` is `orderBy('form', 'desc')`, limit fifty. Single-field:
Firestore indexes it automatically, **no composite index, no console step
for the index**. The console step is the paste.

Documents without `form` are omitted. After the paste, the twenty-one live
rows vanish from the season board until each player banks once. That is the
cost of not backfilling. The empty copy reads "Nothing on the board yet",
which is the same sentence as a genuinely empty season.

The week board still `orderBy('points')`. A week is one round, or two at
most, and form over that is the score.

### Not covered

- No backfill of `recent` from `games/`. The first kept rounds landed on
  8 September; folding them into form is a later job, and it would need the
  admin SDK.
- A claim that merges two seats from the *same* room keeps one `gameId` in
  the window and still sums `played` — pre-existing, rare.
- Opening-titles "form" is unchanged. Different word.
