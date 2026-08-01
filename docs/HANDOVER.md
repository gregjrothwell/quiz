# Handover — Vibe Quiz

Real-time office quiz. Static site on GitHub Pages, Firebase for live rooms.
Built to replace Polly in Teams.

- **Live:** https://gregjrothwell.github.io/quiz/
- **Repo:** https://github.com/gregjrothwell/quiz (public, `master`, deploys from `gh-pages`)
- **Firebase project:** `quiz-d686e` (Firestore + Realtime Database in europe-west1 + Anonymous auth)
- **Status:** shipped and played. 103 tests, clean types and lint, no `any` or `@ts-ignore`.
- **Next:** a full security review before this is played at work — brief at the
  bottom of this file.

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
> Thirty seconds, read-only against Firestore, cleans up after itself. Both
> rulesets confirmed live as of the last run.

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

- **Any room member can write scores.** Deliberate — see the quizmaster row above.
  Fine among colleagues, not fine for strangers.
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
  **`firestore.rules` has an unpublished `seasons/` block right now.**
- **`src/design/global.css` is the whole stylesheet and the class names are load-bearing.**
  `Preview` (`#/preview`) renders every screen on fixtures, so it is the fastest way
  to check a CSS change against all of them without a room.

---

## NEXT SESSION: the security review

**This is the outstanding piece of work.** The brief is to go over the app the
way a lead developer would before it gets played at work, and fix what a review
would fairly call a problem. Everything below is a head start, not a substitute
for looking properly.

### Already verified clean

- `npm audit` — 0 vulnerabilities, production and dev.
- **No `.env` file has ever been committed.** Only `.env.example` appears in the
  history; `.env.local` is gitignored.
- No `dangerouslySetInnerHTML`, no `innerHTML`, no `eval` anywhere in `src/`.
  Every player-supplied string goes through React's escaping.
- No `any`, no `@ts-ignore`, no `@ts-expect-error`.
- The only secret-shaped value in the bundle is the Firebase Web API key, which
  is public by design. GitHub's secret scanner flags it; it is a false positive.
  Referrer restrictions are being applied in the Google Cloud console.

### Findings to deal with, worst first

1. **`allow get, list: if signedIn()` on `/rooms/{code}` lets anyone read every
   room.** The site is public and anonymous sign-in is open, so this is
   effectively world-readable: room contents, player names, scores, the
   questions, and `correctIndex` for every one of them. `list` is the sharp
   part — the app only ever calls `getDoc` on a code somebody read out, and
   never queries the collection, so **dropping `list` costs nothing and stops
   bulk enumeration.** Do this one first; it is a one-word change.
2. **Correct answers are in the room document.** Any member can read
   `questions[].correctIndex` before the reveal. Genuinely hard to fix without
   server-side logic, and worth stating as accepted rather than pretending
   otherwise — but it should be a deliberate note, not a surprise.
3. **Any member can rewrite anything on the room.** Phase, scores, questions,
   and the removal of other players are all reachable from the console by anyone
   in the room. Already documented under Known limits, and it follows from the
   derived-quizmaster decision; expect a reviewer to raise it, and have the
   reasoning ready.
4. **The room document does not validate `players` at all.** The update rule
   checks membership but nothing about shape or size, so a member can write an
   arbitrarily large or malformed `players` map. The season rules show the
   pattern to copy — they validate types, ranges and key sets properly.
5. **Answers are readable before the reveal.** `/rooms/{code}/answers` allows
   read to any signed-in user, so you can see what everybody picked while the
   question is still open.
6. **Season rows are self-reported.** The rules stop you writing someone else's
   row but not inflating your own. Fine among colleagues; say so out loud.
7. **No App Check and no rate limiting.** Anonymous accounts can be created at
   will against the project. App Check is the real answer if this ever matters.

Room codes are 4 characters from a 29-character alphabet — 707,281 combinations.
That is a reasonable guess-space, and completely irrelevant while `list` is
allowed, which is why finding 1 comes first.

### Suggested order

Findings 1 and 4 are small rule changes with real value. 2, 3, 5 and 6 are
mostly about deciding and documenting the trust model rather than changing code —
the app is played among colleagues, and the honest answer may be "accepted". 7 is
a bigger piece and probably out of scope.

`npm run check-rules` should still pass after any rules change. It only covers
the paths the app needs, so extend it if the rules gain new ones.

---

## If you're picking this up cold

Fastest way to be useful: `npm run check-rules`, then `npm run sync-harness 10`.
Between them they confirm the rules are published and that ten clients stay in
sync — the two things that have actually broken in play.

The remaining untested path is a **quizmaster dropping out mid-round** and the
role passing to somebody else. It is covered in the engine but has never been
watched happen with real clients. `npm run host-room` plus a browser is the way
to try it.
