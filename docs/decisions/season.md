# Squads, weeks and the season board

> **Owner: Greg Rothwell. Last updated: 20 August 2026. Budget: 250 lines.**

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
| **The season ranks on points ÷ played** | three rounds to qualify |
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

### Things that will bite

- **The season board re-sorts in the client.** `loadTable` still asks Firestore
  for the top fifty *by points*, because an average cannot be ordered
  server-side without storing it — and storing it means a new field, which means
  the console. Exact while the board is fifty rows or fewer; it is twenty-one.
  **Past fifty, the tail of the average board is wrong**, quietly.
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
- **The average board is a rearrangement, not a re-sort.** On the live rows Joe
  goes 8th → 1st, Greg 1st → 3rd, Rach 2nd → 10th, Bret 7th → 13th. The people
  who lose are the ones who have turned up most. That is the intended effect and
  the thing somebody will complain about.

### What the seal on the question text does and does not buy

`user-select: none` plus `onCopy`/`onCut`, on the prompt and the options, **only
while the question is open**. It kills select → copy → paste into a search box
or an LLM, which takes about four seconds and is the only cheat anybody in an
office would actually try mid-question.

It stops **nothing else** — view-source, DevTools, the network tab, a screenshot
through OCR, or typing the question out. Anyone willing to do those was already
willing to harvest OpenTDB, which is the real ceiling and is
[documented](vault.md#what-it-does-not-stop).

It lifts at the reveal deliberately: the answer is on screen by then, and
copying a good question to send to somebody afterwards is legitimate. The room
code, the join link, the standings and the round in review are untouched.

### `npm run host-room` was broken for weeks — fixed 20 August 2026

It imported `resolveAnswer` from `src/lib/vault`, which imported `src/firebase`,
which reads `import.meta.env` — undefined outside Vite. It died on the first
import with `Cannot read properties of undefined (reading
'VITE_FIREBASE_API_KEY')`, long before a line of its own code ran.

**The damage was not one broken command.** This file named that harness as the
way to test three separate things — a quizmaster dropping out mid-round, the
keyboard shortcuts in a live game, and the vault's own gate from the terminal —
so all three were untestable, and the file recorded them as merely *untested*,
which is a much smaller-sounding thing.

**The fix was one import.** `vault.ts` already took its `Firestore` as a
parameter; the only thing reaching for the app's singleton was a one-line
convenience wrapper, `openTheVault`, with a single call site. Deleting it and
calling `resolveAnswer(firestore(), …)` from `App.tsx` left the module pure, and
nothing else changed. The lesson is the cheap one: **a single import at the top
of a file is enough to make a module unusable outside the browser**, however
carefully the functions below it were parameterised.

**`scripts/imports.test.ts` is what stops it coming back.** It walks the import
graph of every script and fails if any of them reaches `src/firebase.ts` at any
depth. Nothing else would: `npm test` covers `src/` and the pure parts of
`scripts/`, and the harnesses themselves talk to the live project and are kept
out on purpose, so no suite ever imports them. The guard was checked in both
directions — the import was put back deliberately and the test went red on
`scripts/host-room.ts` before being restored.

**Proved by running it**, 20 August 2026: room `PY7G`, a browser joined, and the
harness ran its whole scripted sequence and exited clean — start, wait out the
gate, **`>>> ASKING the vault` to `>>> WRITING reveal` in 225 ms**, then two
advances. That reveal is the terminal vault path, which had never executed once
since the vault shipped.

Note what the harness does and does not do, since the name oversells it: it
takes **one** question through the vault and then advances twice. It is a way to
watch a browser being an ordinary player while something else runs the game, not
a way to play a whole round unattended.

### Regression pass, 20 August 2026

`typecheck`, `lint`, **356 tests**, `npm run build` all clean. No `any`, no
`@ts-ignore`. `firestore.rules`, `firestore.seed.rules`, `database.rules.json`
and `package.json` are untouched by the whole branch.

- `npm run check-rules` — **36/36**, both directions, twice.
- `npm run sync-harness 10` — ten clients, all ten joined, all ten saw the round
  start **within 63 ms**, none dropped.
- The whole `#/preview` gallery renders with no console errors and no sideways
  body scroll at 1280, 375 and 320 px.
- The bundle grew about **3 kB gzipped** (app chunk 114 → 117 kB).

One correction to this file: it says `check-rules` runs 36 checks and to count
them with `grep -c "label:"`. That grep counted the `label: string` on the type
declaration, so it was 35 before this branch and is 36 now that the weekly
bucket check exists.

---


### Teams — shipped, 15 August 2026

Greg's idea. **Not** teams playing together: teams as in groups at work —
Engineering against Marketing — so the board can be read as your league rather
than the whole office.

**It needed no console step, which was the whole point of bounding `team` in the
rules a fortnight before writing a line of it.** The season row is validated with
`keys().hasOnly([...])`, so any new field on it is refused until the rules are
re-pasted by hand, and that paste has broken this game twice. Publishing the
bound early made this a client-only change.

Set in an optional box beside the name on the landing screen, remembered per
browser exactly as the name is, and written onto the season record when a game
banks.

**Free text rather than a fixed list**, because the list would have to be
configured somewhere and every office needs a different one. The cost is
obvious — "Engineering", "engineering" and " Engineering " are three leagues on a
board that should show one — so grouping runs on `teamKey`, a trimmed lowercase
key, while each row still shows the spelling it was given. Nothing cleverer than
that: collapsing "Eng" into "Engineering" would need a dictionary, and quietly
merging two teams somebody meant to keep apart is worse than showing both.

Three decisions worth keeping:

- **The filter sits on top of the whole board rather than replacing it.** Most
  rows carry no team at all — every row written before today, and everybody who
  leaves the box blank — so a team-only view would hide most of the season, and
  the office-wide table is what the league is currently for.
- **An empty team means "keep what the record says", not "clear it".** The team
  lives on the record but is remembered per browser, so a regular who set theirs
  on a laptop and then played from a phone would otherwise wipe it by banking one
  game, and would have no idea they had. Taking a team off is a deliberate edit.
- **Filtered in the client, not in the query.** `TABLE_LIMIT` is fifty and the
  table is read on demand, so a `where` clause would make nothing faster and
  would need a composite index built by hand in the console.

`LeagueBoard` is extracted from the season screen so `#/preview` can render it on
fixtures — `Season` fetches, which is why it had never been in the gallery, and
the board is the half with layout worth checking.

---

---
