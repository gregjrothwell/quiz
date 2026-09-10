# Season board — shipped August 2026

> **Owner: Greg Rothwell. Last updated: 8 September 2026. Budget: 250 lines.**

Moved verbatim out of `docs/decisions/season.md` on 8 September 2026, when form
ranking needed the room. The text is unchanged; only where it lives is.

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
