# Handover — Vibe Quiz

Real-time office quiz. Static site on GitHub Pages, Firebase for live rooms.
Built to replace Polly in Teams.

- **Live:** https://gregjrothwell.github.io/quiz/
- **Repo:** https://github.com/gregjrothwell/quiz (public, `master`, deploys from `gh-pages`)
- **Firebase project:** `quiz-d686e` (Firestore + Realtime Database in europe-west1 + Anonymous auth)
- **Status:** shipped, played, and security-reviewed. 103 tests, clean types and
  lint, no `any` or `@ts-ignore`. Both rulesets tightened, published and verified.
- **Next:** nothing blocking. The largest thing still open is App Check; the
  review outcome and the rest of the list are at the bottom of this file.

> ### Check the rules are published before you play
>
> Both rulesets are pasted into the console by hand, and an unpublished one has
> broken the game twice — first Firestore, then the Realtime Database, where
> every presence write was rejected and the room filled with ghosts.
>
> ```bash
> npm run check-rules
> ```
>
> Thirty seconds, cleans up after itself. Since the security review it checks
> both directions: that the app's paths still work, **and that the tightened
> rules still refuse what they are meant to refuse.** A hand-paste can fail
> permissively, and that direction is silent — everything works, and nobody
> finds out `list` is still open until somebody enumerates every room.
>
> All 13 checks pass as of the security review.

---

## Where things are

```
src/engine/     Pure TS game rules — no React, no Firebase. All the logic worth testing.
src/lib/        Firebase wiring (useRoom), pack loading, the question clock.
src/screens/    One component per phase + a design gallery (Preview).
src/questions/  Pack types and the classification rules, with tests.
src/design/     One stylesheet, design tokens at the top.
scripts/        Build-time question harvest, and the multi-client test harnesses.
```

Commands: `npm run dev` (serves at `/quiz/`, port 5273), `test`, `typecheck`, `lint`,
`build`, `deploy`, `fetch-questions [-- --resort]`, `check-rules`, `sync-harness [n]`,
`host-room`.

---

## Decisions that look odd until you know why

**Don't undo these without reading the reason.** Each one is a bug that already
happened once.

| Decision | Why |
|---|---|
| **Quizmaster is derived, never stored** (`resolveQuizmaster` — longest-present player) | Storing it means every disconnect needs a reassignment *write*, and several clients noticing the same departure race each other. Derived, handover is instant and silent. |
| **Answers store `elapsedMs`, not a timestamp** | Each device measures its own elapsed time. Comparing one laptop's clock to another folds clock skew straight into speed scores. |
| **Answers live in a subcollection**, not on the room doc | On the room doc, every answer pushes an update to every player. As built, a game costs ~800 reads against a 50k/day free tier. |
| **Firebase is initialised lazily** (`firestore()`, `firebaseAuth()`, `realtimeDb()`) | `getDatabase()` throws synchronously without a `databaseURL`. At module scope that killed the whole import graph, so the app rendered blank *and* the screen explaining how to configure it could not load. |
| **Entrance animations are CSS, not JS** | Delayed `motion` animations don't fire under StrictMode's double mount, leaving `opacity: 0` content permanently invisible. CSS `animation-fill-mode: both` cannot fail that way. `motion` is still used for standings reordering, where it doesn't gate visibility. |
| **`dispatch` accepts an array of actions** | It closes over `room`. Two sequential calls ran the second against a stale snapshot — `start` couldn't see the questions `selectPack` had just written, so it silently no-opped and the lobby never advanced. |
| **`ukScore` reads prompt + correct answer only; `isUsOnly` reads everything** | A *British wrong answer* doesn't make a question British — that padded the UK pack with things like "Who wrote Jurassic Park?". Aggressive stripping is fine for US content; loose tagging isn't for UK. |
| **Pack categories are matched exactly, with a `mixed-bag` catch-all** | A fallback to `general-knowledge` made that pack 68% video-game questions, so picking "General Knowledge" mostly served something else. |
| **Skip is removed from the UI** | The rules can't restrict writes to the quizmaster without storing their uid, so the button was reachable from DevTools by any member. One player shouldn't be able to void a question for the room. The engine action and its tests remain for a future permission model. |
| **The harvest never filters by difficulty, and pages down through `[50, 20, 5, 1]`** | OpenTDB answers a request for more questions than it holds with `response_code: 1` and an *empty* array — it does not return the remainder. Asking per category *and* per difficulty split the pool into three times as many buckets, most under 50, so every bucket short of a full page was silently dropped and twelve categories came back completely empty. Fixing it took the pool from 2,815 to 3,996. Difficulty is read off each question instead. |
| **Each client writes its own season row** | The room's scores can't be restricted to the quizmaster (see above), but a season row can: `request.auth.uid == uid`. The cost is that someone who closes the tab before the final screen isn't recorded. |
| **`start` carries a `gameId`, and the season row stores `lastGame`** | Without it, reloading the final screen banks the same game again. The check happens inside the Firestore transaction, so it survives a reload rather than just a re-render. |
| **The ladder shows each question's level, not your score on it** | Per-question scores would mean accumulating a history no other device has, for a number the standings show two seconds later. The level is already in the room, and it makes a ramped round visibly steepen. |
| **The round title card lives on the standings screen** | Between questions there's no clock running, so a beat of theatre costs nobody answering time. Over the question it would eat the first seconds of a twenty-second window. |
| **An empty presence tree never reaps anybody** (`reapAbsent`) | Reading "nobody is present" as "everybody has left" is what turned a missing Realtime Database ruleset into an unplayable game: every presence write failed, the quizmaster's reaper deleted every player including itself, `resolveQuizmaster` then returned null, and the role flickered to whoever rejoined next while the room stopped responding to anyone. Presence only tidies away closed tabs; if it is unavailable the right answer is a ghost in the lobby, not an empty room. |
| **A phase transition never writes the `players` map** (`toUpdate`) | `dispatch` folds actions over the *writer's* snapshot, and `handleStart` awaits a pack fetch between taking that snapshot and writing it — so everyone who joined during the fetch was erased. Measured with `npm run sync-harness`: five of ten players silently deleted. Membership changes only ever go through single-field `players.{uid}` writes, so no transition needs the map. `scores` is written as field paths for the same reason. |
| **Fonts are self-hosted** (`src/design/fonts.css`) | The display faces carry the whole look; a network that blocks `fonts.googleapis.com` would drop it to Impact with no warning. Archivo is variable — Google's CSS lists it once per weight but serves the same file each time, so it's declared once instead of shipping 105 kB of duplicates. |

---

## Verified vs not

**Verified against the live Firebase:** anonymous sign-in, room creation, pack
selection, round start, question render, answer write, reveal and scoring, and
leaving a room. Engine covered by 103 tests including six full three-question
games (quizmaster disconnect, skip, reset, ties).

**Verified in the browser, on fixtures only:** every screen at 1280px and 390px,
the level picker disabling a level its pack can't fill, and no horizontal scroll
at the narrow width.

**Verified with real concurrent clients** — this was the long-standing gap:

- `npm run sync-harness [n]` brings up *n* independent anonymous clients against
  the live project and reports how fast each sees a phase change and whether
  anyone was dropped. Ten players see a round start within ~85 ms, none dropped.
  `LEGACY_WRITE=1` restores the whole-document write so the players-clobber bug
  can be watched happening rather than taken on trust.
- `npm run host-room` hosts a room from the terminal and drives a round, so the
  browser can be watched as an ordinary player while somebody else runs the game.

**Not verified — start here:**

0. **The season table against live Firestore.** `recordGame` has never run
   against a real project, and the transaction's repeat-write guard has only been
   reasoned about, not watched. This is the least-proven thing in the repo.
   `npm run check-rules` now writes and deletes a real season row under a
   throwaway season id, so the *rules* side is covered; the transaction's
   repeat-write guard still is not.

1. **Quizmaster handover with real clients.** The reaper and the join race are now
   covered by `sync-harness`, but a quizmaster actually dropping out mid-round and
   the role passing to somebody else has still only been tested in the engine.
2. **Keyboard shortcuts in a live round.** A–D/1–4 to answer, Space to reveal or
   advance. Compiles and the legend renders; keys never pressed in a real game.
3. **A ramped round in play.** `selectQuestions` is unit-tested, but nobody has
   watched a fifteen-question ladder actually climb in a live room.
4. **Reachability from the work network.** `github.io` is confirmed fine.
   `firestore.googleapis.com` and `*.firebasedatabase.app` are the same stack
   `rgblife/estimation-room` uses successfully there, but that's inference, not a test.

---

## Known limits

- **Any room member can write scores, and anyone holding the code can become a
  member.** Deliberate — see the quizmaster row above. Fine among colleagues, not
  fine for strangers. The room code is the only thing standing between a room and
  the internet, which is why `list` is no longer granted.
- **The game is trivially cheatable by anyone who opens DevTools.** Correct
  answers ship in the room document and `elapsedMs` is self-reported, so a
  perfect 1,000 on every question is about ten lines in the console. Unfixable
  without server-side logic; see the security review below.
- **~242 kB gzipped**, nearly all Firebase, plus 67 kB of fonts. Code-splitting is
  the fix if it matters.
- **Season standings follow the browser, not the person.** Anonymous auth gives a
  durable uid with no sign-up, which is the whole appeal and the whole limitation.
  The sharp edge is **iOS Safari, which evicts site storage after about a week
  without a visit** — a weekly quiz survives, a fortnight off doesn't. A short
  transfer code would let one identity move to a second device; that's the obvious
  next step and it's small now the collection exists.
- **Season numbers are self-reported.** The rules stop you writing someone else's
  row but not your own. Same trust model as the rest of the game.
- **`uk-leaning` is 201 questions.** The open datasets run ~4:1 US-marked to
  UK-marked; a keyword filter can only surface what's there.
  [OpenTriviaQA](https://github.com/uberspot/OpenTriviaQA) (~45k, same CC BY-SA
  licence) is the obvious next source — it needs cp1252 transcoding, which is the
  only reason it isn't in already.
- **Three OpenTDB categories are genuinely empty**: Musicals & Theatres,
  Celebrities and Gadgets have no *verified* questions, only pending ones. Note
  that `api_count.php` counts pending questions too, so its totals overstate what
  the API will actually serve — don't size a harvest from them.

---

## Question pipeline

3,996 questions from [Open Trivia DB](https://opentdb.com) (CC BY-SA 4.0),
**committed as JSON** — no runtime API, no key in the bundle, no rate limit.

Packs: Video Games 999, Odds & Ends 640, Music 399, Science 399, TV & Film 397,
General Knowledge 345, History 340, Geography 299, Best of British 201, Sport 125.

Every pack now has a real hard bucket — before the page-size fix, Sport, TV & Film
and Odds & Ends had none at all, which is why difficulty was worth making
selectable only after that was fixed.

The harvested pool is cached at `.cache/pool.json` (gitignored). **Tuning the
classification rules costs a re-sort, not a re-fetch:**

```bash
npm run fetch-questions -- --resort
```

A full re-harvest is ~25 minutes (OpenTDB allows one request per 5s, and the
page-size ladder costs a few extra requests per category).

---

## Gotchas

- **`gh` token lacks the `workflow` scope** (`gist, read:org, repo`). Anything under
  `.github/workflows/` is rejected on push. Deploy uses the `gh-pages` branch, which
  needs no workflow file. `gh auth refresh -s workflow` if that changes.
- **Pages CDN serves a stale `index.html`** for a minute or two after `npm run deploy`.
  Verify by checking the asset hash in the served HTML, not just a 200.
- **Env values are baked in at build time.** Re-run `npm run deploy` after any
  `.env.local` change. `.env.local` is gitignored and confirmed absent from history.
- **`#/preview` renders every screen with fixed data; `#/preview/4` renders one.**
  Isolate by re-render, never by hiding siblings — a `display:none` ancestor stops
  motion animations mid-flight and looks like a rendering bug.
- **Firestore rules and RTDB rules are in the repo but published by hand** in the
  console. If room writes start failing with permission errors, check they're still
  live — an unpublished ruleset was the cause of the first "nothing happens" bug.
  Both were rewritten and republished during the security review, and
  `npm run check-rules` confirms the console matches — run it, don't assume it.
- **`src/design/global.css` is the whole stylesheet and the class names are load-bearing.**
  `Preview` (`#/preview`) renders every screen on fixtures, so it is the fastest way
  to check a CSS change against all of them without a room.

---

## The security review

Done. The brief was to go over the app the way a lead developer would before it
gets played at work, and fix what a review would fairly call a problem.

**Both rulesets are published and verified.** `npm run check-rules` reports 13 of
13, including the six denials that are new. Re-run it after any rules change —
the repo copy is still only a copy, and the console is still the source of truth.

Verified after publishing, against the live project:

- **The game still works.** `npm run sync-harness 10` — ten clients, all ten
  joined, all ten saw the round start within 63 ms, none dropped. This was the
  real risk of the change: `wellFormed` now gates every single write, so a wrong
  bound would have broken joining rather than anything security-shaped.
- **The attack is dead.** The same script that joined a stranger's room and
  blanked it in one write, given nothing but the code, now gets
  `PERMISSION_DENIED`. Reading the room is still allowed and always will be —
  joining reads the document first.

The rules were never syntax-checked locally; that needs the emulator, which needs
a Java runtime this machine does not have. The console validated them on paste
and `check-rules` confirmed the semantics, which between them cover it.

### Verified clean, independently

- `npm audit` — 0 vulnerabilities, production and dev (371 packages).
- No `.env` has ever been committed; only `.env.example` is in the history, and
  no `AIza`-shaped literal appears in any commit.
- No `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function` or
  `document.write` anywhere in `src/` or `scripts/`. Every player-supplied string
  — names, and nothing else — goes through React's escaping.
- No `any`, no `@ts-ignore`, no `@ts-expect-error`.
- The Firebase Web API key in the bundle is public by design and the scanner
  flag is a false positive. **But do not count referrer restrictions as a
  mitigation**: they apply to the Identity Toolkit endpoints, not to Firestore or
  the Realtime Database, which are governed only by the rules below. The key
  being public is fine; believing it is restricted is not.

### Fixed

| Fix | Why it mattered |
|---|---|
| **`list` dropped from `/rooms`** | Was the whole ballgame. Any anonymous visitor could pull every live room in one query — players, scores, questions, every `correctIndex` — and then write to all of them. Nothing in the app ever queries the collection, so this cost nothing. |
| **Room writes are shape-checked** (`wellFormed`) | `code` is pinned, `phase` must be one of the five real phases, `players`/`scores` cap at 60, `questions` at 50, and the writer's own player entry must be `{name, joinedAt}` with a 1–40 character name. Previously a member could write any shape at any size into a document every client re-reads on every transition. |
| **`create` requires exactly one player** | `keys().hasOnly([uid])` is satisfied by the *empty* map, so a room could be minted with no members and therefore no derivable quizmaster. |
| **Unknown phase renders an escape hatch** (`App.tsx`) | The phase match was exhaustive with no fallback, so `phase: 'anything-else'` rendered a blank stage with no way out for the whole room. Demonstrated live before the fix, against the rules as published: a fresh anonymous client, given only the code, joined and blanked the room in a single write. Now both ends are covered — the rules reject the phase, and a client that meets one anyway offers Reload and Leave. |
| **Season rows are bounded** | `wins <= played`, `best <= points`, and absolute caps. Still self-reported — the rules cannot know your real score — but one edited row can no longer put a number on the board that makes the table meaningless. |
| **Season rows are deletable by their owner** | Was `if false`. There was no way for anyone to take their own display name back off a shared board, and the name is free text on a leaderboard the whole office sees. Somebody *else's* row still needs the console; the app has no moderator, which is worth knowing before the board is projected in a meeting. |
| **Presence entries cannot carry extra children** (`$other: false`) | `.validate` required `name` and `at` but did not forbid anything else, so a presence node could hold an arbitrary payload. |
| **`check-rules` tests denials, not just permissions** | The rules are pasted by hand, and a paste can fail in two directions. The permissive direction was completely silent: the game works perfectly with `list` wide open. Thirteen checks now, each tightening above paired with one that fails loudly if the console is still serving the old ruleset. It also exercises the season write path end to end — the thing the last handover called the least-proven code in the repo. |
| **`rtdb-probe.tmp.ts` deleted** | A leftover debug script committed to the repo root of a public repo. Its negative checks are better off inside `check-rules`, which is where they now are. |

### Accepted, deliberately

- **The room code is the capability.** Anyone holding a code can read the room and
  join it. This is not fixable: joining reads the document first, so `get` cannot
  require membership. 707,281 codes is a sane guess-space now that they cannot be
  harvested in one query — that was the entire value of dropping `list`.
- **Correct answers ship in the room document**, and **`elapsedMs` is measured on
  the answering device**. Together these mean a perfect score is about ten lines
  in the console. Fixing either needs a server: correct answers withheld until
  reveal, or answers timed against server time. A Cloud Function is the answer if
  this ever leaves the office. Bounding `elapsedMs` against `questionOpenedAt` in
  the rules was considered and rejected — it costs a document read per answer and
  would silently reject honest answers from anyone on a slow connection, which is
  worse than the cheat.
- **Any member can still rewrite the phase, scores, questions and other players.**
  It follows directly from the quizmaster being derived rather than stored, and
  the reasoning for that is in the table near the top. `wellFormed` now keeps the
  worst case to mischief rather than an unplayable or expensive room.
- **Answers are readable before the reveal.** Restricting the subcollection to
  room members was considered and rejected: it costs a document read per rule
  evaluation — per snapshot on a listener, so roughly 1,500 extra reads a game —
  and buys nothing, because reaching the path needs the code and anyone with the
  code can just join. Members seeing each other's picks mid-question is inherent
  without server-side logic.
- **The season table is readable by any signed-in visitor**, which anonymous auth
  makes effectively public. It is display names and scores; a shared leaderboard
  has to be shared. Worth saying out loud because those are colleagues' names on
  a public URL.

### Not done, and what it would take

1. **No App Check, no rate limiting.** Anonymous accounts can be minted at will
   against the project. The sharp end is not privacy, it is **cost and
   availability**: the free tier is 50k reads a day and a game is ~800, so
   somebody who knows one room code can take the quiz down for the office for a
   day. **On the Spark plan there is no bill to run up and no budget to set** —
   budgets live in Cloud Billing, which a free project has no account for. The
   substitute is the console's usage alerts, enabled for both Firestore and the
   Realtime Database; Firestore is the one that matters, as the RTDB holds only
   presence. **If this project is ever moved to Blaze, set a budget that day** —
   the same exhaustion stops being an outage and starts being an invoice.
   App Check is the real fix either way.
2. **Rooms are never deleted** (`allow delete: if false`) and have no TTL, so
   every room ever created persists with its players' names in it. A scheduled
   cleanup, or a `createdAt` field plus a TTL policy, is the fix. Right now the
   only way to remove one is the console.
3. **No Content-Security-Policy.** GitHub Pages cannot set headers, but a `<meta
   http-equiv>` CSP in `index.html` would still be worth having — `default-src
   'self'` with `connect-src` for the Firebase hosts. Left alone deliberately:
   getting it wrong breaks the live app silently, and the deploy has a stale-CDN
   window that makes that painful to diagnose. Do it as its own change with a
   round of testing, not tacked onto a rules fix.
4. **Anonymous accounts accumulate forever** in Firebase Auth. There is a console
   setting to auto-purge unused anonymous accounts after 30 days; it is off.
   Turning it on would also quietly reset anybody's season row, which is the
   trade-off — see the iOS Safari note under Known limits.

`npm run check-rules` must pass after any rules change. It covers the paths the
app needs *and* the denials the review added, so extend both halves if the rules
gain new paths.

---

## If you're picking this up cold

Fastest way to be useful: `npm run check-rules`, then `npm run sync-harness 10`.
Between them they confirm the rules are published and that ten clients stay in
sync — the two things that have actually broken in play.

The remaining untested path is a **quizmaster dropping out mid-round** and the
role passing to somebody else. It is covered in the engine but has never been
watched happen with real clients. `npm run host-room` plus a browser is the way
to try it.
