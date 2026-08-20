# TOTAL-RECALL

> **Owner: Greg Rothwell. Last updated: 20 August 2026. Budget: 300 lines.**

The dated spine. Newest first, a few lines per entry. When one needs more room
than that it moves to `decisions/<topic>.md` and the entry here keeps a pointer —
depth goes outward, chronology stays central.

Append; do not rewrite an earlier entry to make it look as if we always knew. A
correction is a new dated note that says what changed, and the wrong claim stays
visible.

**Entries before 20 August 2026 are reconstructed** from the dates recorded in
the old 2,422-line handover, when it was split. They are a true index of what
happened and when; they are not a contemporaneous log, and anything needing the
detail should follow the pointer rather than trust the summary here.

## 2026-08-20 — The final screen makes a shareable card

Built, not deployed. A 1200×630 PNG of the round — pack, winner, podium, chair, rosettes —
handed over by clipboard, share sheet or download, whichever the browser has, all
feature-detected. Zero Firebase, no rules change. 430 tests; `drawCard` splits out at 4.48 kB
and the main chunk moved 0.66 kB.

**The chair is drawn on it, not captioned** — Greg's call, and the right one: the joke in
`Chair.tsx` is entirely in the height, so a card saying *"Alex takes the chair"* was explaining
a picture instead of drawing it. Ported with `Path2D` from the same path data the component
uses, sharing the podium's floor.

Three things the browser found that no test could: the third riser dropped its score out of
the bottom of its own box (silently — the number was legible, in mid-air); a shared chair read
*"Konstantin & Alexandra takes the chair"*, a bug that then vanished with the caption itself;
and the lazy import had to become a prefetch, because a cold `import()` outlives the
clipboard's transient activation and degrades the primary route into the fallback on the one
press that mattered.

Also: `Date.now()` cannot be called anywhere in a component under the React Compiler, which
is why the model is assembled inside the lazily-imported module rather than by `Final`.
→ [`decisions/final-card.md`](decisions/final-card.md)

## 2026-08-20 — Scoring is a rank ladder, not a speed curve

Built. 500 for correct plus 500/400/300/200/100 by the order the correct answers landed,
ties sharing a rank per `standings()`. Max per question stays 1,000, so **no rules paste**.
416 tests, types and lint clean, `#/preview` renders the ladder with no console errors.

Two things the story did not foresee, both left alone and both recorded: a mid-question join
is now sorted last rather than stripped of its bonus, which is *softer* than before; and the
podium's one-decimal elapsed chip can show two players the same time when they are 100 points
apart. **Nobody has played a round on it** — ranks need two answerers, so no solo round can
show one.

The reducer test asserting the old window-dependent scores was **inverted rather than
deleted**: it now asserts both windows pay the same, and says what it used to say.
→ [`decisions/scoring.md`](decisions/scoring.md)

## 2026-08-20 — Three directional decisions, and an ideas review

Reviewed against first principles rather than the backlog. The machinery is far ahead of the
playing: a sealed vault, App Check on three products, durable identity, 412 tests — and **21
season players with 0 recovery codes and 0 claims**. Three decisions, Greg's:

- **The quiz stays an event, not a habit.** A date-seeded async "Daily Five" was costed, would
  have needed **no rules change at all**, and was rejected on product grounds.
- **Ruleset pastes are no longer a big deal** — *"we can do them as needed"*. This relaxes an
  assumption several files design around. Order and both-direction verification still stand.
- **Rank-based scoring, to try.** The linear speed curve came from Polly and had never been
  questioned: anybody who knows the answer scores 960–990, so 1s versus 2s is 50 points.

Nothing built. → [`decisions/ideas-review.md`](decisions/ideas-review.md)

## 2026-08-20 — App Check on auth is enforcing after all, hours late

`appcheck-probe` at 12:42: `ENFORCED  Authentication · refused`. The four earlier
runs that signed in unattested across 20+ minutes were real, and those entries
stand — what was wrong was the implied timescale. Documented delay 15 minutes,
actual hours. **Not "the docs were right all along": a propagation delay the
documentation does not bound.** Debug-token scripts unaffected. `security.md` hit
its budget recording it, so authentication split to
[`decisions/app-check-auth.md`](decisions/app-check-auth.md).

## 2026-08-20 — check-rules was not leaking; the three rows were older than the fix

Reported here this morning as "leaving rows on every run". **Wrong, and caught by
counting rather than arguing:** bucket at 3, three more preflight runs, still 3.
Those three predate the cleanup and no client could remove them — each run mints a
fresh anonymous uid, and a season row is deletable only by its owner, so they were
stranded the moment each script exited. Swept with `prune-rooms -- --probe-rows
--go` (new; dry-run by default, hard-coded to two literal probe ids so it can never
reach `season-2`). The five silent `.catch(() => undefined)` calls in the preflight
cleanup are why it went unnoticed; they now name what they could not remove.

## 2026-08-20 — take-stock had been under-reporting since weekly boards shipped

It held `const SEASON = 'season-2'` and counted that one bucket. A week *is* a
season id — `seasons/week-2026-W34/players` — so from the day weekly boards landed
it reported a fraction. Replaced with `listDocuments()` over `seasons/`: no id left
to go stale. Found `season-1` (4), `week-2026-W34` (4) and `rules-check` (3), none
of which had ever been counted. Carried over from the 20 August plan, where it was
dropped rather than deferred.

## 2026-08-20 — The squad dropdowns were never styled

Reported by Greg after the round. A `select` wearing `.input` is still not an
`<input>`: the reset said `input { font: inherit }` and nothing else, so the squad
lists rendered **Arial 13.3px at 46px** beside a name field in **Archivo 16px at
53px**, same row, plus a grey native chevron. Reset now covers `select` and
`textarea`; `select.input` gets `appearance: none` and an inline-SVG chevron. All
three fields 53px/Archivo 16px, checked at desktop and 375px. The open popup stays
the OS's — **macOS ignores `option` colours**.

## 2026-08-20 — The reveal was a coin flip, and the host's device always called it

Greg hosted a real office round on a 15-second window and had to press **Reveal**
every question. Not the vault's price: `useQuestionClock` claimed a local clock
"always expires a little after the gate does, never before" — true of every device
*except* the one that reveals. Latency compensation starts the quizmaster's
countdown a hop before `openedAt` is stamped, and the two writes' latency and skew
then cancel, leaving **about 7ms** decided by jitter. Measured, not reasoned
(`npm run reveal-probe`, new): 100ms early **refused**, 250ms early **refused**;
`sync-harness 10` agrees — host +6ms, the other nine +82–86ms.

Fixed by anchoring on the first **server-confirmed** snapshot, so neither latency
nor skew appears in the arithmetic. Backoff 1500 flat → 300/600/1200/1500. After:
reveal at **+478ms / +561ms**, answer at 1.2s, nothing pressed; `check-rules` 36/36
both directions. **The replay hold stays** (up to 1820ms, now the largest part of
the gap) — Greg's call, 20 August: it is the showmanship. Full account:
[`decisions/vault.md`](decisions/vault.md#the-gate-had-no-margin-and-the-host-was-the-one-who-paid).

## 2026-08-20 — Anonymous account purge: reviewed, and the answer is don't

The open item said the setting was off and turning it on "would quietly reset
anybody's season row". Both halves were wrong in useful ways.

The docs say auto-clean-up requires an **Identity Platform upgrade**, and are
**silent** on whether that needs billing — the same shape as the TTL policy,
which needed billing and said so nowhere. The stated benefit is that anonymous
auth stops counting toward billing quotas, which on a Spark project running one
round a week buys nothing.

The cost is measured: **21 players, 0 recovery codes, 0 claims.** The mitigation
protects nobody, because nobody has ever used it.

And a recovery code would not fully save them anyway — reasoned from
`ownsPlayer`, not tested: a purge mints a new uid, `claims/{newUid}` does not
exist, so the season write is refused until the code is re-entered by hand, and
nothing prompts for it.
→ [`decisions/identity.md`](decisions/identity.md)

## 2026-08-20 — App Check enforced on the Realtime Database

The review had *claimed* the Realtime Database was unenforced since 16 August
without ever checking. `npm run appcheck-probe` is new and checks: it signs in
with no App Check token and reports each product. Firestore refused. **The
Realtime Database accepted both a presence write and a read.** Authentication
signed in fine.

**Enforcement was switched on the same day**, and the probe re-run: the Realtime
Database now refuses both. `check-rules` still passes 36/36 with its debug token
and `sync-harness 10` still gets ten clients into a round with none dropped, so
attested clients are unaffected. The before measurement is what makes the after
mean anything — without it, "the site still works" is all anyone could report.
Authentication remains unenforced, and is now the only gap on the list.

`check-rules` could never have answered this — it needs its debug token to do its
job, and without one it dies on the first Firestore call, long before reaching
any Realtime Database check. Hence a separate script.

Two things that cost a few minutes and are worth not rediscovering: a refused
Realtime Database call does not reliably reject — the SDK retries a dropped
connection rather than surfacing it, so an unserved request simply never settles
and the script hangs reporting nothing. Every probe is now raced against an 8s
timeout. And both clients hold Node's event loop open, so `main()` returning is
not the process exiting.

Enforcing it needs **no client code** — verified against the Firebase docs rather
than from memory: App Check covers RTDB on web, and `src/firebase.ts` already
initialises before `getDatabase`. It is one console step, and it is Greg's.
→ [`decisions/security.md`](decisions/security.md)

## 2026-08-20 — Build-time code moved out of `src/`, and two routes stopped shipping

`questions/classify.ts` and its test — 1,098 lines — were imported by exactly one
thing, `scripts/fetch-questions.ts`, and had no business in the app's source
tree. Moved to `scripts/`. `src/questions/` now holds `types.ts` and the seal
test, and nothing else.

`Preview` (the design gallery and its fixtures) and `Season` were statically
imported by `App.tsx`, so every player downloaded both to play a round that
touches neither. Now `React.lazy`. The main chunk went **240.41 kB → 224.72 kB**
(gzip 77.55 → 73.78), with `Preview`, `Season` and a shared `SquadPanel` split
out. A real cut, and a modest one: `firebase` at 488 kB dominates the download
and none of this touches it.

`standings(scores).filter((entry) => players[entry.uid])` was written out three
times — `App.tsx`, `Final`, `Standings`. Now `roomStandings` in the engine, where
it has tests.

**Found while writing those tests, and left alone deliberately:** positions are
inherited from the full score map rather than re-derived after the filter, so a
departed leader leaves the top row at position 2 and nobody at position 1. All
three copies already did this; the change only moved it. It matters because
`recordGame` banks a win on `position === 1`, so the effect is that nobody is
credited rather than the wrong person — the safer of the two. Rarely reachable:
the final screen ranks the frozen snapshot, in which the leaver is still a
member. Asserted in `scoring.test.ts` rather than corrected, because a
de-duplication is not the place to change behaviour.
→ [`decisions/season.md`](decisions/season.md)

## 2026-08-20 — The pack seal was a convention, not a test

`public/packs/*.json` ships as static files on GitHub Pages, so anything in one
is readable by anybody with the URL — the vault, the time gate and the reveal
rules all rest on those files carrying no answer. Nothing checked it. It held,
by care.

`src/questions/seal.test.ts` now checks every pack and refuses a broken one,
proved by poisoning `geography.json` and watching it fail on
`questions[0].correct`.

**Correction:** `AGENTS.md` and `types.ts` both stated the rule as "nothing
under `src/` except `types.ts` may name `correct`". That was never the invariant
and could not have been enforced — ten files under `src/` use the word, almost
all prose, and nine name `correctIndex`, which is legitimate because it is the
runtime field that exists only once the vault has resolved an answer. Both are
corrected in place.
→ [`decisions/vault.md`](decisions/vault.md)

## 2026-08-20 — The handover was split, because it cost more than the code

`docs/HANDOVER.md` had reached 2,422 lines / ~40,000 tokens, read at the start of
most sessions — more than the ~20,600-line codebase it described. Split into a
125-line way-in plus fourteen files under `decisions/`, moved verbatim. This file
is new; the project never had one, which is why the handover had been doing both
jobs. Budgets and a session-start warning now live in `~/clawd/context/`.

## 2026-08-20 — Correction: the room count, settled by measuring

The handover asserted both "leaving 3 rooms" and "79 rooms are still there". The
second was written before the prune ran and never updated. `npm run take-stock`
reports **12 rooms** today, consistent with 3 on 15 August plus rounds since. One
room predates `expiresAt` and no TTL policy can ever reach it. Both stale
readings stay visible in [`decisions/security.md`](decisions/security.md).

Also measured, and worth knowing: **0 recovery codes and 0 identity claims.** The
whole durable-identity feature has never been used by anybody.
→ [`decisions/identity.md`](decisions/identity.md)

## 2026-08-20 — `host-room` had been dead for weeks

It died on an import that reached `src/firebase.ts`, which reads
`import.meta.env` — defined by Vite and not by Node, so the script died before
its own code ran. The cost was not one broken command but three untested paths
with no other tool. `scripts/imports.test.ts` now walks the graph and fails if it
comes back. PR #4.
→ [`decisions/gotchas.md`](decisions/gotchas.md)

## 2026-08-20 — Squads, weekly boards and the average table went live

PR #2, merged and deployed: squads from a list, a weekly board, a season table
ranked on points ÷ played, a podium that stops rearranging itself, and question
text sealed for exactly as long as the clock runs. **The office has not played a
real round on any of it.**
→ [`decisions/season.md`](decisions/season.md)

## 2026-08-19 — `recordGame` proved against the live project

A solo round in the browser, including the repeat-write guard across a reload.
Until then the season write path was the least-proven code in the repo.
→ [`decisions/season.md`](decisions/season.md)

## 2026-08-17 — A `joinedAt` from one room walked into another

Room 6JA5 had a player whose `joinedAt` was the millisecond they created an
entirely different room. That reading decides the quizmaster, so a browser that
had been sitting in an earlier room could take the transport off whoever was
running this one. The remembered place is now stamped with the room it was
earned in.
→ [`decisions/joining.md`](decisions/joining.md)

## 2026-08-16 — App Check enforcing on Cloud Firestore

Proved in both directions on the day, which is the only way an enforcement
switch means anything: the live site still worked, and the same script that
passes 36/36 with its debug token was refused outright without one.

**Not** enforced on the Realtime Database, and **not** on authentication — the
negative test still signed in. Saying so is what stops the next person assuming
more was done than was.
→ [`decisions/security.md`](decisions/security.md)

## 2026-08-15 — Six wrong statements about Google's console in one afternoon

Every one was about the **platform**, not the code; every claim about this repo
in the same session was proved by running something and held up. The rule that
would have prevented all six: **never state platform behaviour from memory** —
fetch the documentation, and where it is silent, say it is silent. A correction
is not automatically right either; two of the six were corrections to earlier
errors.
→ [`decisions/gotchas.md`](decisions/gotchas.md)

## 2026-08-15 — Rooms pruned, and TTL turned out to need billing

81 rooms and 533 documents deleted, leaving 3. Season rows, the vault and the
question history untouched. The intended fix was a Firestore TTL policy;
**TTL requires billing enabled and this is a Spark project**, which is stated on
neither documentation page and is discovered at the Create Policy button.
→ [`decisions/security.md`](decisions/security.md)

## 2026-08-15 — Teams, then squads

Groups at work rather than teams playing together, so the board reads as your
league rather than the whole office. It needed no console step, which was the
whole point of bounding `team` in the rules a fortnight before writing a line of
it — the season row is validated with `keys().hasOnly([...])`, so any new field
is refused until the rules are re-pasted by hand, and that paste has broken this
game twice.
→ [`decisions/season.md`](decisions/season.md)

## 2026-08-15 — The security review

`list` dropped from `/rooms` was the whole ballgame: any anonymous visitor could
pull every live room in one query — players, scores, questions, every
`correctIndex` — and then write to all of them. Room writes are now shape-checked,
`create` requires exactly one player, and `check-rules` tests denials rather than
only permissions, because the permissive direction is completely silent.
→ [`decisions/security.md`](decisions/security.md)

## 2026-08-14 — The clock, heard rather than reasoned about

→ [`decisions/clock.md`](decisions/clock.md)

## 2026-08-13 — A refused reveal stalled the round for minutes

Question one sat on "the vault would not confirm an answer" until Reveal was
pressed by hand. The vault turns a reveal down until the server agrees the answer
window has passed, which is routine and self-correcting — but nothing retried it,
and in a room where everybody has already answered nothing is writing, so no
update ever arrived to trigger one. Now retried, capped.
→ [`decisions/vault.md`](decisions/vault.md)

## 2026-08-13 — The vault is ahead of the packs, not behind

All 14,176 pack questions across the ten packs resolve to an answer. The surplus
documents are orphans from earlier harvests: ids hash the question text, so a
revised question leaves its old answer in place, unread and harmless.
→ [`decisions/vault.md`](decisions/vault.md)

## 2026-08-03 — `season-2` started with the office

`season-1` was development and testing. Bumped rather than deleted: an empty
board either way, old rows stay recoverable, and no destructive write against
live data. A new season also starts with an empty question history.
→ [`decisions/season.md`](decisions/season.md)
