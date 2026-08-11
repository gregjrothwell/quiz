# Handover — Vibe Quiz

Real-time office quiz. Static site on GitHub Pages, Firebase for live rooms.
Built to replace Polly in Teams.

- **Live:** https://gregjrothwell.github.io/quiz/
- **Repo:** https://github.com/gregjrothwell/quiz (public, `master`, deploys from `gh-pages`)
- **Firebase project:** `quiz-d686e` (Firestore + Realtime Database in europe-west1 + Anonymous auth)
- **Status:** shipped and played. 159 tests, clean types and lint, no `any` or
  `@ts-ignore`. The **answer vault is live**: 3,947 answers seeded, both
  rulesets published, preflight passing.
- **⚠️ The packs on disk are ahead of the vault.** A second question source has
  landed and the packs now hold 14,152 questions against 3,947 seeded answers.
  **Run `npm run seed-vault` before the next deploy** — see [the second
  source](#the-second-question-source). Deploying first means every imported
  question reaches its reveal and stops on "the vault would not confirm an
  answer".
- **Next:** nothing queued after the re-seed. [The answer window is
  selectable](#the-configurable-answer-window) — 10 / 15 / 20 seconds, chosen in
  the lobby, defaulting to 10.
- Nothing is blocking. `sync-harness 10` was re-run after the answer window
  landed: ten clients, all ten joined, all ten saw the round start within 65 ms,
  none dropped — so `durationOk` and `timingOk` gating every room write did not
  break joining, which was the real risk of that change, exactly as it was when
  the vault added `openedAtOk`.

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
> Around fifteen seconds — it waits out a real five-second vault gate, which is
> the shortest window the rules accept — and it cleans up after itself. It
> checks both directions: that the app's paths still work, **and that the
> tightened rules still refuse what they are meant to refuse.** A hand-paste can
> fail permissively, and that direction is silent: everything works, and nobody
> finds out `list` is still open until somebody enumerates every room.
>
> 24 checks — thirteen from the security review, seven for the vault, two for
> the question history, two for the answer window. The vault seven include the
> one that catches `firestore.seed.rules` being left published, which would
> leave every answer in the game overwritable by anybody.

---

## Turning the vault on

**Done on `quiz-d686e` — 3,947 answers, verified by the preflight.** Kept here
because it has to be repeated for any new project, and after any re-harvest that
changes question ids.

The packs under `public/packs/` do not contain answers. Until the vault holds
them, a round reaches its first reveal and stops with "the vault would not
confirm an answer" — so if that message ever appears, this is the page.

**With a service account — the way to do it:**

```bash
npm run seed-vault
```

That is the whole procedure. `GOOGLE_APPLICATION_CREDENTIALS` in `.env.local`
points at a key from **Project settings → Service accounts → Generate new
private key**, kept under `.secrets/` which is gitignored. The admin SDK
bypasses the rules, so nothing needs publishing, the game stays up while it
runs, and there is no window in which the vault is writable by anyone.

It can also *read* the vault — which no client can, and which is the clearest
demonstration that the admin SDK bypasses the rules rather than merely having
generous ones. So a top-up writes only what is new and says so: `412 added, 0
changed, 3947 already correct`. A **changed** count above zero is worth looking
at — ids are a hash of the question text, so it means the source revised the
answer to a question we are already asking.

> **The key is a real credential and the rules do not constrain it.** It can
> read and rewrite the vault, every room and the whole season table. Treat it
> like a password: keep it under `.secrets/`, never paste it anywhere it will be
> stored, and revoke it in **Project settings → Service accounts → Manage
> service account permissions → Keys** if it is ever exposed. Revoking is
> instant and generating a replacement takes a minute; the only thing that
> changes on this machine is the file's contents.

**Without one**, the script falls back to anonymous auth, which needs the rules
swapped around it:

1. Publish **`firestore.seed.rules`**. It allows vault writes and denies
   everything else, so nobody can play while it is live.
2. `npm run seed-vault` — rewrites every answer, since it cannot read to diff.
3. Publish **`firestore.rules`** again. The preflight check named *"write the
   vault"* is the one that fails if this step is skipped.

Kept for anyone who would rather not hold a key. It is strictly worse: downtime,
a window where the answers are writable by any anonymous visitor, and a manual
step that has to be got right twice.

If `.cache/vault.json` is missing — it is gitignored, like the pool it comes
from — regenerate both with `npm run fetch-questions -- --resort`. That reads
the cached pool and needs no network.

### Adding questions later

Ids are `sha1(prompt)`, so they are content-addressed and stable across
harvests. That makes a top-up additive rather than a rebuild:

- **`--resort` needs no re-seed at all.** Re-tuning the classification rules
  moves questions between packs; the vault is keyed by id, so nothing changes.
- **New questions need seeding**, but only the new ones — the service-account
  path works that out for itself.
- A prompt whose wording changes upstream arrives as a new id. The old entry is
  orphaned, which is harmless.

### How it works

The asymmetry the whole thing rests on: **`get()` inside a security rule is not
subject to the rules on the document it reads.** So `vault/{questionId}` can be
`allow read: if false` — invisible to every client, forever — while the rules
themselves still consult it.

That means nobody can *look up* an answer. What they can do is **assert** one:

```
create /rooms/{code}/reveal/{questionId} = { answer: "Metropolitan Line" }
```

and the rule permits the write only if that string matches the vault. Four
options, four attempts, and you have the answer — which would be a fine way to
cheat, except the same rule refuses every attempt until **both**:

- the question named in the path is the one the room is actually on, and
- the server has seen the room's answer window pass since it opened.

The first stops a member holding question one open and quietly asking about the
other fourteen. The second holds because `openedAt` can only ever be written as
`request.time` — `serverTimestamp()` and nothing else — so a question cannot be
claimed to have opened earlier than it did, in this room or in a decoy of
somebody's own. The window itself is `durationSecs` on the room, pinned while a
question is open and floored at five seconds; see [the configurable answer
window](#the-configurable-answer-window) for why both of those are load-bearing.

`src/lib/vault.ts` fires all four candidates at once, so the reveal costs one
round trip rather than four.

### What it costs

| | |
|---|---|
| **Money** | Nothing. Two rule `get()`s per reveal (both hit the same cached room read), about 40 extra reads and 60 extra writes per game, against 50k reads and 20k writes a day. |
| **The early reveal** | Gone. The quizmaster can no longer cut a question short — no device holds the answer before the clock runs out, including theirs. The button shows `Reveal in Ns` and the round auto-reveals on expiry. This is the real price, and it is most of the reason the window is now selectable: it can be *chosen* short even though it cannot be cut short. |
| **A round in progress** | Unchanged otherwise. The answer is written into the room at reveal, so the other clients learn it from the update they were already listening to rather than paying for their own read. |

### What it does *not* stop

Be precise about this, because it is easy to oversell:

- **The questions are Open Trivia DB's, and OpenTDB is public.** Anybody willing
  to spend twenty-five minutes harvesting it has a permanent offline answer key.
  Nothing in this design touches that, and nothing can, short of writing our own
  questions.
- **A pre-warmed decoy room.** The room holds every question id from the moment
  the round starts, so a script could open fifteen decoy rooms during the lobby,
  wait out one gate in parallel, and have the whole round about half a minute
  in. Its own rooms, so it can set them all to the five-second floor and be
  quicker about it. Closing this needs the future question ids withheld until
  each one opens, which costs the quizmaster role its ability to change hands
  mid-round — a worse trade than the hole. Written down rather than fixed.
- **Self-reported `elapsedMs`.** Unchanged. Someone can still claim they
  answered in three milliseconds.

What it *does* kill is the ten-second cheat: open DevTools, read `correctIndex`
off the room snapshot, or fetch `packs/music.json` and search for the prompt.
Both of those worked until now, and both were one keystroke away from anybody
curious. Now cheating takes a bespoke script and premeditation — the same bar as
harvesting OpenTDB, which was always the real ceiling.

---

## The configurable answer window

**Shipped.** The quizmaster picks 10, 15 or 20 seconds in the lobby, and it is
fixed for the round. It earns its place more than a settings toggle usually
would, because it mostly cancels the vault's real cost: a round everybody
answers in five seconds still burned twenty, and at ten that stops mattering.

**Ten is the default**, and also the shortest on offer — the picker only ever
buys a round *more* time, from a floor that is the new normal. The rules accept
anything from 5 to 120, so another option is a one-line change.

> ### `DEFAULT_DURATION_SECS` and `LEGACY_DURATION_SECS` are not the same number
>
> They were, briefly, and merging them back would be a silent breakage.
>
> - **`DEFAULT_DURATION_SECS` (10)** is what the lobby starts on. Change it
>   freely; it is a UI preference.
> - **`LEGACY_DURATION_SECS` (20)** is what a room carrying *no* `durationSecs`
>   is read as. It has to match the literal in `firestore.rules` —
>   `get('durationSecs', 20)` — exactly.
>
> If the fallback said ten while the rules said twenty, a room created before
> this shipped would count its clients down to zero, auto-reveal, and be refused
> by a vault that stayed shut for another ten seconds. The round would stop dead
> on "the vault would not confirm an answer", and only for rooms that were
> already in flight — the hardest kind of bug to reproduce afterwards.
>
> Three tests in `src/engine/state.test.ts` read `firestore.rules` and fail if
> the two files drift. They cover the fallback, the 5–120 bounds, and that every
> option the lobby offers is one the rules would accept. Unlike
> `npm run check-rules` they need no network, so drift fails in the run that
> caused it rather than at the next preflight.

The window lives on the room as `durationSecs`, and **the security rules read it
from there** — the client and the vault have to agree about when the answer is
due, so there is deliberately no second copy of the number anywhere. The old
`REVEAL_GATE_MS` in `src/lib/vault.ts` was exported and used by nothing; it is
gone rather than parameterised.

### Where it is read

| Place | What it does |
|---|---|
| `src/engine/state.ts` | `durationSecs` on `RoomState`, plus the default and the bounds |
| `src/engine/reducer.ts` | `start` fixes it; `answer` rejects past it; `reveal` scores against it |
| `src/lib/useRoom.ts` | fills the default in at the Firestore boundary, so nothing downstream sees `undefined` |
| `src/lib/useQuestionClock.ts` | counts down from it |
| `src/screens/QuestionScreen.tsx` | `ArcTimer` total |
| `src/screens/Lobby.tsx` | the picker |
| `firestore.rules` | the reveal gate, and the two rules that keep it honest |

**`reveal` passing `durationMs` to `tallyQuestion` was a real fix, not
threading.** `scoreAnswer` and `tallyQuestion` always took the parameter, but
nothing ever passed it — so speed points decayed across a hardcoded twenty
seconds. A ten-second round would have capped everyone at three-quarters of the
speed bonus however fast they answered. There is a test pinning both numbers.

### The hole this opened, and the floor that closes it

Two rules keep the window honest, and the second one is not in the original
design note.

**`timingOk()` pins it while a question is open.** If a member could lower
`durationSecs` mid-question they would open the vault early while every other
screen still showed the time it had promised — silent, which is the exact class
of cheat the vault exists to kill. So `durationSecs` and `openedAt` both move
only on the write that opens a question, which is the pattern `openedAtOk()`
already used for `openedAt` alone.

**The bounds are what stop the restart trick.** Any member can already write the
room out of `question` and back into it, which restamps `openedAt`. That was
harmless while the gate was a fixed twenty seconds, because restarting could
only ever push the vault *further away*. Reading the window from the document
turns that same move into a way to pull the gate closer — so the rules bound
`durationSecs` to **5–120 seconds** regardless of what the lobby offers. The
worst anybody can now do is a five-second question, with the whole room watching
the timer jump. Vandalism, and loud.

Both have a deny check in `npm run check-rules`.

### Three things that will bite

- **`duration.value()` takes an `int`, and this number comes from a client
  SDK.** The gate is written as plain millisecond arithmetic —
  `request.time.toMillis() > room().openedAt.toMillis() + secs * 1000` — rather
  than `duration.value(secs, 's')`, because the SDK decides for itself whether a
  whole number goes on the wire as an integer or a double, and handing a double
  to `duration.value` errors the rule and denies **every reveal in the room**.
  Same lesson as `joinedAt is number` further up the file; this one fails much
  louder.
- **Rooms that predate the field have no `durationSecs`.** Both rule reads are
  `get('durationSecs', 20)` and `toRoomState` fills in `LEGACY_DURATION_SECS`,
  which is the same twenty and deliberately *not* the lobby's default — see the
  box above.
- **Anything that resets the probe room must not set `durationSecs` on the way
  back to the lobby.** `openProbeQuestion` writes the room to `lobby` and then
  into `question`, and only the second write may carry the window — the first is
  not a write that opens a question, so `timingOk()` refuses it. This is not
  hypothetical: it is what the preflight did on the first run after the new
  ruleset went live, and it failed before a single check had run. The rule was
  right and the helper was wrong, which is the good version of that failure.
- **The preflight needs two windows, not one short one.** The obvious speedup —
  give the probe room a three-second window — breaks the *deny* checks: roughly
  a dozen network round-trips separate them from the write that opened the
  question, so the gate would have closed on its own before they ran, and a
  reveal refused for the wrong reason proves nothing. `openProbeQuestion` now
  takes a window: the deny checks get 120 seconds, and the question is re-opened
  on 5 immediately before the allow check. That is where the minute came back.

### Publish the rules first, then deploy

**This is the opposite of what the vault needed, and the opposite of what the
old version of this section said.** The vault's rules required `openedAt ==
request.time`, which the then-deployed client never wrote, so publishing first
broke every question-opening write for about an hour.

Nothing here is like that. Both new reads are defaulted, and an update carries
the existing `durationSecs` through untouched even from a client that has never
heard of it — so **the new rules are fully backwards-compatible with the old
bundle.** The reverse order is the broken one: a new client writing
`durationSecs: 10` against the old fixed gate auto-reveals at ten seconds, gets
refused for another ten, and the round stalls on "the vault would not confirm an
answer".

So: publish `firestore.rules`, run `npm run check-rules`, then `npm run deploy`.

---

## Next session — start here

Written 11 August 2026, straight after deploying the second question source and
the change-your-answer round.

1. **Check the game actually plays.** Firestore reads were exhausted on the 11th
   (see the `seed-vault` box below), so the deploy went out unplayed. First job
   is a real round on the live site — it is the one thing today's work never got
   to do end to end with the quota up.
2. **Take stock of Firestore.** A count of rooms, season rows and orphaned vault
   entries was attempted and never completed, because the read quota was already
   gone. Worth knowing: rooms are never deleted, so the collection only grows,
   and every one of them holds players' names.
3. **Fix `npm run host-room`.** Broken, and it predates all of this work:
   `src/lib/vault.ts` imports `../firebase`, which reads `import.meta.env` at
   module scope — Vite-only, so it throws under `tsx` before the script starts.
   Deferring the config read would fix it, but `firebase.ts` is load-bearing and
   its documented failure is a blank app, so give it its own change and test it
   properly. It is the harness for quizmaster handover and the live reveal.
4. **Watch the read budget.** A game is roughly 800–1,500 reads, and changing an
   answer now costs a write that fans out to every client — so a round where
   people fidget costs more than it used to. The console's usage alerts are on;
   App Check is still the real fix and still not done.
5. **Difficulty is still unsolved**, deliberately. Imported questions are all
   `medium` and the reasons are written up under [the second
   source](#the-difficulty-rating-that-is-not-there). Do not reach for another
   heuristic without measuring it against a hand-labelled set first — three have
   been tried and none beat calling everything hard.

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
`build`, `deploy`, `fetch-questions [-- --resort]`, `fetch-otqa`, `seed-vault`,
`check-rules`, `sync-harness [n]`, `host-room [-- secs]`.

`npm test` covers `src/` plus the pure parts of `scripts/` — the OpenTriviaQA
parser and its encoding fallback, which corrupt questions silently when wrong.
Anything under `scripts/` that touches the network or the live project stays out
of the suite deliberately; `npm test` must keep running offline.

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
| **The round title card lives on the standings screen** | Between questions there's no clock running, so a beat of theatre costs nobody answering time. Over the question it would eat the first seconds of the answering window, which matters more now one can be ten seconds long. |
| **Only members score at the reveal** (`reduce`'s `reveal`) | Answers arrive through a subcollection nothing checks membership on, so a client can write one for a room it is not a member of. `standings` filters on `players`, so such a score exists in the document and appears on no screen — which is what made the 6SVG bug invisible rather than obvious. `answer` in the same reducer had always refused a non-member; this is the reveal agreeing with it. Safe because a client that finds itself missing puts itself back within a second, and no reveal can happen inside the answer window — five seconds even at the floor the rules allow, and ten at the shortest the lobby offers. |
| **A new season is a bump, not a delete** (`SEASON` in `src/lib/season.ts`) | `season-1` was development; `season-2` is the office league, started 3 August 2026. Bumping empties the board just as a wipe would, keeps the old rows recoverable if a number ever needs checking, and needs no destructive write against live data. Note it also resets the question history, which lives under the season. |
| **Nobody is reaped outside the lobby** (`reapAbsent`) | Reaping exists so a closed tab stops loitering before a round starts. Mid-round it is all cost: `standings` filters on `players`, so a removed player vanishes from *every* device, and `recordGame` skips a uid that is not in `players`, so their game never reaches the season. Presence is not evidence of leaving — it runs over the Realtime Database, a different connection from the Firestore one carrying the game, so a backgrounded tab or a closed lid drops it while the round plays on perfectly. **This actually happened**: room 6SVG, a player with 4,300 points who answered the final question, invisible on every screen and with no season row. |
| **A client that finds itself missing puts itself back** (`useRoom`) | The other half of the same bug. Membership could be taken from a live client and nothing ever restored it — and the failure was near-silent, because answers are not membership-checked, so the player carried on playing and scoring while being invisible. The rejoin preserves `joinedAt`, or a reaped quizmaster would return at the back of the queue and lose the role, and it never resets a score that is already on the board. |
| **`joinedAt` is remembered from the room, not just from writing to it** | Creating a room does not go through `writeSelfIntoRoom`, so a creator had no remembered place in the queue and came back from a reap stamped with the current time. Caught by testing the fix rather than by reading it. |
| **An empty presence tree never reaps anybody** (`reapAbsent`) | Reading "nobody is present" as "everybody has left" is what turned a missing Realtime Database ruleset into an unplayable game: every presence write failed, the quizmaster's reaper deleted every player including itself, `resolveQuizmaster` then returned null, and the role flickered to whoever rejoined next while the room stopped responding to anyone. Presence only tidies away closed tabs; if it is unavailable the right answer is a ghost in the lobby, not an empty room. |
| **A phase transition never writes the `players` map** (`toUpdate`) | `dispatch` folds actions over the *writer's* snapshot, and `handleStart` awaits a pack fetch between taking that snapshot and writing it — so everyone who joined during the fetch was erased. Measured with `npm run sync-harness`: five of ten players silently deleted. Membership changes only ever go through single-field `players.{uid}` writes, so no transition needs the map. `scores` is written as field paths for the same reason. |
| **Published packs carry `options`, never `correct`** (`sealQuestion`) | The harvest-time `Question` type still has the answer; the published `SealedQuestion` does not, and nothing under `src/` outside `types.ts` may name `correct`. The options are sorted, not left in `[correct, ...incorrect]` order, or the answer would simply be index 0. Two questions with different answers produce identical orderings — there is a test. |
| **`correctIndex` is `number \| null`** | Null while a question is live, because *no device knows it* — not even the quizmaster's. The reveal fills it in from the vault and writes it into the room, which is how everyone else finds out without paying for a read. |
| **`tallyQuestion` is given the answer rather than reading it off the question** | Same reason. Scoring is the first code in the round that gets to see it. |
| **Entrance animations use `animation-fill-mode: backwards`, not `both`** | `both` keeps the final keyframe in the cascade *above* normal declarations, so `to { opacity: 1 }` silently beat every state the lecterns change into. `.tile--dim` had never dimmed anything since it was written. `backwards` still hides a tile through its stagger delay — the only reason a fill mode is needed — and then gets out of the way. Watch for this on any element that both animates in and has variant states. |
| **Sound is on by default** (`src/lib/sound.ts`) | It only ever plays after a deliberate click — creating a room, joining, answering — so it can't ambush anybody on page load, and muted-by-default means nobody discovers it exists. The toggle is top-right on every screen and the choice persists. Every cue is synthesised from oscillators: six stings as files would have been most of a bundle the handover already calls heavy, and an asset that 404s behind a proxy is a silent round with nothing on screen to explain it. |
| **A round prefers questions the season hasn't served** (`selectQuestions`, `seasons/{season}/asked/{packId}`) | Random selection with no memory repeats far sooner than pack sizes suggest: 15 drawn from Sport's 125 every week means about **two of last week's questions come round again, every week**. Over Video Games' 999 the same sum is a quarter of a question, which is why the big packs hid it. Season-scoped, not per-room — the complaint is about the sitting before, and a room lasts one sitting. |
| **Asked questions go to the back of the queue, not out of the pool** | Removing them outright would have Sport quietly serving eight-question rounds by mid-season. A thin pack still gets a full-length round, with repeats only where there was no alternative. |
| **The history is capped at 400 ids per pack** | Not "all of them". The point is that last month's questions don't come round again, not that a pack is exhausted before anything repeats — and an unbounded array on a document read at the top of every game is the shape this project keeps avoiding. 400 is roughly six months of a weekly round. |
| **A player may change their answer until the clock stops** (`answer` in `reduce`) | The rules always allowed it — `answers/{uid}` grants `create, update` with no immutability check — so the only thing stopping a second write was the client refusing to make one. `elapsedMs` is re-measured on the change, so changing your mind costs the speed bonus. Keeping the first time would let somebody lock a guess in at half a second, bank the points, and revise at leisure. |
| **`submitAnswer` checks the window, and that check is new** | The live `room.answers` is built straight from the subcollection, filtered only on question and membership — the reducer's `answer` case never runs in the browser, so its `elapsedMs` guard never ran either. Nothing enforced the window on the way in; the one-answer-only rule hid that by stopping anyone writing twice. Removing the lock exposed it, so the guard moved to where the write happens. |
| **`submitAnswer` ignores a press on the lectern already chosen** | It is not a change, and writing it again would restamp `elapsedMs` to the later moment — costing speed points for a tap that altered nothing. Easy to do by accident: a double-tap on a phone, or pressing again to confirm. It also stops a fidgety player fanning a write out to every other client for free, which matters because a change now costs a write where the old one-answer rule capped it at one per question. |
| **The lecterns disable on `clock.expired`, not on having answered** | Same gap from the UI side. Expiry used to be covered incidentally — you had either answered, which disabled them, or run out of time with the reveal close behind. Now it has to be stated. |
| **The answer window is chosen on `start` and nowhere else** | The rules only permit it to change on a write that opens a question, because a member who could lower it mid-question would open the vault early while everyone else's timer still said otherwise. Confining it to `start` in the engine means the client never even attempts a write the server would refuse. |
| **The rules bound the window to 5–120s, not to the lobby's three options** | The bound exists to stop a *restart* — writing the room out of `question` and back in restamps `openedAt`, which was harmless at a fixed twenty seconds because it could only delay the vault. What matters is the floor, not matching the picker; pinning the rules to the lobby's three values would also mean the preflight could not use a short probe window, and would need republishing every time an option changed. |
| **The reveal gate is millisecond arithmetic, not `duration.value()`** | `duration.value` takes an `int`, and `durationSecs` arrives from a client SDK that decides for itself whether a whole number is an integer or a double on the wire. A double would error the rule and deny every reveal in the room — the same trap as `joinedAt is number`, but with a far worse failure. |
| **`tallyQuestion` is given the room's window** | It always took the parameter and nothing ever passed it, so speed points decayed across a hardcoded twenty seconds. Harmless while every round *was* twenty; at the ten-second default it would cap everybody at 750 of a possible 1000 no matter how fast they were. |
| **`fullGame.test.ts` pins its window at 20 instead of taking the default** | Its games answer as late as twelve seconds in. On the ten-second default those answers stop being recorded, and the games would still pass while quietly testing a round nobody answered. |
| **Fonts are self-hosted** (`src/design/fonts.css`) | The display faces carry the whole look; a network that blocks `fonts.googleapis.com` would drop it to Impact with no warning. Archivo is variable — Google's CSS lists it once per weight but serves the same file each time, so it's declared once instead of shipping 105 kB of duplicates. |

---

## Verified vs not

**Verified against the live Firebase:** anonymous sign-in, room creation, pack
selection, round start, question render, answer write, reveal and scoring, and
leaving a room. Engine covered by 117 tests including six full three-question
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

0. **Changing an answer, against a live room.** The engine and the UI are
   covered — three reducer tests, and the preview shows the unpicked lecterns
   staying live — but a second write landing on `answers/{uid}` in Firestore has
   not been watched. The rules permit it and always did, so the risk is not
   permission but the write racing the reveal. `npm run host-room -- 20` gives a
   long enough window to answer, change, and watch which one scores.

0. **`host-room` since the vault landed.** It waits out the gate and asks the
   vault itself before revealing, and that path has still not been run.
   `sync-harness` covers joining and phase sync; this is the one that would
   catch a mistake in the terminal harness's own reveal. It now takes the window
   as an argument, so `npm run host-room -- 10` both exercises the configurable
   window and halves the wait:

   ```bash
   npm run host-room -- 10
   ```

**Verified — the vault, end to end.** The rules were written from documented
semantics and, at the time of writing, nothing had executed. It has now: seeded
against the live project and confirmed by `npm run check-rules`. Seven
of its checks pin one assumption each, so a future failure names which one
broke rather than just "the vault doesn't work":

| Check | Assumption it pins |
|---|---|
| read the vault → denied | `allow read: if false` is published |
| write the vault → denied | `firestore.seed.rules` is *not* still published |
| list the vault → denied | no `list` on the collection |
| reveal while the clock runs → denied | the gate exists |
| backdate `openedAt` → denied | `openedAt == request.time` is enforced |
| ask about another question → denied | the reveal is pinned to the question in play |
| shorten the window mid-question → denied | `timingOk()` pins `durationSecs` too |
| open a question on a one-second window → denied | the 5–120s bound is published |
| reveal after the clock → **allowed** | the gate actually opens, and the vault is seeded |

That last one is the one that ruins a quiz night rather than merely leaking
one, which is why it waits out a real gate instead of being assumed. It runs on
the five-second floor, which also makes it the check that fails if the published
rules are still using a fixed twenty.

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
- **Cheating now takes a script rather than a console.** The answers left the
  packs and the room document — see [the vault](#turning-the-vault-on) for what
  that does and does not buy. `elapsedMs` is still self-reported, so a
  fast-but-wrong answer is honest and a slow-but-claimed-instant one is not.
- **~252 kB gzipped**, nearly all Firebase, plus 67 kB of fonts. The lobby QR
  code added about 10 kB of that (`qrcode-generator`, MIT, no dependencies) —
  more than it looked like it would. Code-splitting is the fix if it matters.
- **A non-member can still write an answer document.** Nothing checks
  membership on the way in — the room code is the capability, as everywhere
  else. It no longer *scores*, and no longer inflates the answered count, but
  the write itself is still possible and the rules still permit it. What that
  costs now is a stray document, not somebody's game.
- **Season standings follow the browser, not the person.** Anonymous auth gives a
  durable uid with no sign-up, which is the whole appeal and the whole limitation.
  The sharp edge is **iOS Safari, which evicts site storage after about a week
  without a visit** — a weekly quiz survives, a fortnight off doesn't. A short
  transfer code would let one identity move to a second device; that's the obvious
  next step and it's small now the collection exists.
- **Season numbers are self-reported.** The rules stop you writing someone else's
  row but not your own. Same trust model as the rest of the game.
- **The source corpora file their own questions unreliably.** OpenTriviaQA's
  `sports` file opens with a question about Aristotle and metaphysics. The
  positive sport filter catches that particular class; nothing checks the other
  packs, so a stray is possible anywhere. This is the same failure the project
  already hit once, when a `general-knowledge` fallback made that pack 68% video
  games.
- **The Trivia API is licence-incompatible.** 14,400 questions with real
  difficulty ratings, which would solve the levelling problem — but it is CC
  BY-**NC**, and NonCommercial cannot be folded into a ShareAlike work. Ruled out
  rather than overlooked.
- **Three OpenTDB categories are genuinely empty**: Musicals & Theatres,
  Celebrities and Gadgets have no *verified* questions, only pending ones. Note
  that `api_count.php` counts pending questions too, so its totals overstate what
  the API will actually serve — don't size a harvest from them.

---

## Question pipeline

14,152 questions from two sources, both CC BY-SA 4.0 and **committed as JSON** —
no runtime API, no key in the bundle, no rate limit:

- [Open Trivia DB](https://opentdb.com) — 3,996 questions, each with a
  difficulty rating
- [OpenTriviaQA](https://github.com/uberspot/OpenTriviaQA) — ~39,000 usable
  questions, no difficulty rating, capped into the packs

Packs: General Knowledge / Geography / History / Odds & Ends / Music / Science /
TV & Film / Best of British 1,500 each, Video Games 1,396, Sport 756.

The pools are cached at `.cache/pool.json` and `.cache/opentriviaqa.json`, both
gitignored. **Tuning the classification rules costs a re-sort, not a re-fetch:**

```bash
npm run fetch-questions -- --resort
```

A full OpenTDB re-harvest is ~25 minutes (one request per 5s, and the page-size
ladder costs a few extra requests per category). The second source is a separate
command because it is twenty seconds rather than twenty-five minutes:

```bash
npm run fetch-otqa
```

`--resort` never touches the network, so it uses whatever is already cached; if
`.cache/opentriviaqa.json` is missing it says so and rebuilds from OpenTDB alone.

---

## The second question source

**Shipped.** Sport was 125 questions — a fifteen-question round is 12% of the
pack, so by the second month of a weekly quiz it is visibly repeating. Every
thin pack is now several times deeper.

| Pack | Was | Now |
|---|---|---|
| Sport | 125 | **756** |
| Best of British | 201 | 1,500 |
| Geography | 299 | 1,500 |
| History | 340 | 1,500 |
| General Knowledge | 345 | 1,500 |
| TV & Film | 397 | 1,500 |
| Music / Science | 399 | 1,500 |
| Odds & Ends | 640 | 1,500 |
| Video Games | 999 | 1,396 |

> ### `seed-vault` costs a full-vault read every time you run it
>
> The diff that makes it additive — "412 added, 0 changed, 3947 already correct"
> — is computed by reading every answer already up there. At 13,500 answers that
> is **13,500 reads a run**, against a free tier of 50,000 a day.
>
> Four runs on 11 August 2026 exhausted the day's reads and took the game down
> until the quota reset: two seeding, and two more confirming the seed had
> landed. Confirming is the expensive habit to break — the run that writes
> nothing costs exactly as much as the run that writes everything.
>
> Seed once, read the count it prints, and believe it. If something really does
> need checking, `npm run check-rules` proves the vault path for about 24
> operations rather than 13,500.

> ### Seed the vault before you deploy, not after
>
> This is the opposite order from [the answer window](#publish-the-rules-first-then-deploy),
> and getting it wrong is the failure that ruins a quiz night rather than merely
> leaking one.
>
> New packs against the old vault means every imported question reaches its
> first reveal and stops dead on "the vault would not confirm an answer" — the
> rules cannot confirm an answer they have never been told. The reverse costs
> nothing: a vault holding answers to questions no pack serves yet is inert.
>
> ```bash
> npm run seed-vault && npm run deploy
> ```
>
> The seed is additive and works out for itself what is new, so re-running it is
> free. 13,431 answers against a free tier of 20,000 writes a day — which is
> most of why the packs are capped where they are.

### Why the packs are capped at 1,500

`loadPackQuestions` downloads the **whole pack** to pick fifteen questions, so a
pack is a download at the top of every round on the quizmaster's device. The
full import would put 10,000 questions and about 2 MB into Odds & Ends alone.
The cap holds every pack near 380 kB, against the 237 kB Video Games already
shipped, and keeps the vault seedable inside one day's free-tier writes.

`capPack` keeps the **rated** questions when it trims. Only the OpenTDB half
carries a difficulty, so trimming those first would thin the only questions the
easy and hard levels can draw on, to make room for questions neither level will
ever serve. Within a source it orders by id — a hash of the prompt, so
arbitrary but stable; a selection that reshuffled on every harvest would orphan
vault entries for nothing.

### The difficulty rating that is not there

**Imported questions are all marked `medium`, and that is an admission, not a
design.** OpenTriviaQA carries no difficulty, and three ways of inferring one
were measured against a hand-labelled sample of 120 questions. None beat the
baseline of labelling everything hard:

| Approach | Agreement | Baseline |
|---|---|---|
| Surface features — prompt length, years, numeric answers | no signal (21–28% band) | 22% |
| Word-frequency obscurity of the answer | 56% | 53% |
| Correcting OpenTDB's systematic offset | 53% | 53% |

The same exercise measured something worth keeping: **OpenTDB's own labels agree
with a UK-office judgement only 39% of the time**, and it under-rates by about
0.4 of a step. Its "easy" means easy *within that category's fandom* — the pool
contains "Which game did Sonic first appear in? → Rad Mobile" and "the metric
prefix atto- → one quintillionth", both rated easy. The gap is worst exactly
where you would expect: anime +0.71 steps, video games +0.68, general knowledge
+0.33, science 0.00.

What this costs, by level — and it is much less than it sounds, because
**`mixed` is the default**:

| Level | Effect |
|---|---|
| `mixed` (default) | Fully fixed — draws on everything |
| `medium` | Fully fixed |
| `ramp` | Mostly; its easy and hard slots still come from the rated pool |
| `easy` / `hard` | **Unchanged.** A hard Sport round still draws on 15 questions |

Two things would actually work, if this ever matters enough: hand-rating a
capped set, or a build-time LLM pass validated against a hand-labelled gold set.
Both were costed; neither is queued.

### Four things that will bite

- **Team names go in the list with their city, not on their own.** Nearly every
  American franchise nickname is also an ordinary English word, and the filter
  reads the distractors too, so a bare entry takes out a wide swathe of
  perfectly good questions. `vikings` cost us Lindisfarne and the Danelaw,
  `raiders` cost us Raiders of the Lost Ark, `pirates` the Disneyland ride,
  `cubs` the answer to what a baby shark is called, and `mariners` the Ancient
  Mariner — about 370 questions between them, none about American sport. The
  packs are cap-bound so none of this showed up as a size change; it silently
  swapped good questions for arbitrary ones. Only genuinely unambiguous
  nicknames — `yankees`, `dodgers`, `lakers`, `knicks`, `celtics`, `49ers` —
  belong in the list bare.
- **`toPattern` appends `s?`, and that is load-bearing.** Every term list in
  `classify.ts` is matched with a word boundary at each end, so `\bsuper bowl\b`
  misses "Super Bowls" and `\bteam\b` misses "teams". Questions are asked in the
  plural at least as often as the singular, so without it an intact-looking list
  quietly catches half of what it names. American football got through the sport
  filter twice before this was spotted.
- **`TextDecoder('windows-1252')` is not cp1252 in Node.** Every label —
  `windows-1252`, `cp1252`, `x-cp1252` — decodes as Latin-1, mapping 0x80–0x9F
  to C1 control characters rather than to punctuation. That range is exactly
  where cp1252 keeps curly quotes, dashes and ellipses, which a trivia corpus is
  full of. `decodeCp1252` does the 32-entry mapping by hand. The failure is
  silent: the string is valid, just full of invisible control characters.
- **The encoding is per file, not per corpus.** Twelve of the twenty-two files
  are cp1252 and ten are UTF-8. Decoding everything as cp1252 — which the old
  version of this note assumed — turns every accented character in the other ten
  into "RenÃ©e", which is also silent. Strict UTF-8 first, cp1252 on the throw.
- **Sport is the one pack filtered *positively*.** It has to name a sport with a
  following in Britain or it is dropped. The source's `sports` file is
  overwhelmingly American and stripping it by exclusion was a losing game: three
  passes of adding leagues, franchises and positional vocabulary each caught more
  and each left a long tail. Inverting it is shorter, stricter, and costs volume
  the pool can afford. It is the same shape as `uk-leaning`, which has always
  been a positive filter.

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
- **`firestore.seed.rules` is not the ruleset to play on.** It exists only for
  the one-off vault seed and denies everything else while it is live. If rooms
  suddenly stop working entirely, check which ruleset is published — and run
  `npm run check-rules`, which now catches exactly this.
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
- **`elapsedMs` is measured on the answering device**, and still is. Correct
  answers no longer ship anywhere — that half was fixed by the vault, without a
  Cloud Function and without leaving the free tier, which the review had
  assumed impossible. Bounding `elapsedMs` against the question's open time in
  the rules was considered again and rejected for the same reason as before: it
  costs a document read per answer and would silently reject honest answers
  from anyone on a slow connection, which is worse than the cheat.
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
watched happen with real clients. `npm run host-room -- 10` plus a browser is
the way to try it — and that harness has itself not been run since the vault
landed, so it exercises the gate and the vault lookup on the way through.

Nothing is queued after that. If you are changing anything about the answer
window, [read its section first](#the-configurable-answer-window): the number
lives in `firestore.rules` as well as the client, and two of the three rules
around it exist to close holes that are not obvious from the client side.
