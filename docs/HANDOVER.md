# Handover — Vibe Quiz

Real-time office quiz. Static site on GitHub Pages, Firebase for live rooms.
Built to replace Polly in Teams.

- **Live:** https://gregjrothwell.github.io/quiz/
- **Repo:** https://github.com/gregjrothwell/quiz (public, `master`, deploys from `gh-pages`)
- **Firebase project:** `quiz-d686e` (Firestore + Realtime Database in europe-west1 + Anonymous auth)
- **Status:** shipped and played. 272 tests, clean types and lint, no `any` or
  `@ts-ignore`. The **answer vault is live and covers the packs**: 13,593
  answers seeded against the 13,452 the packs need plus the 4 harness entries,
  both rulesets published, preflight passing.
- **The vault is ahead of the packs, not behind** — verified 13 August 2026 by
  the count below. The 137 surplus documents are orphans from earlier harvests:
  ids hash the question text, so a revised question leaves its old answer in
  place, unread and harmless. All 14,176 pack questions across the ten packs
  resolve to an answer.
- **Next: two console steps, and they are the only things outstanding.** A
  maintenance pass on 15 August 2026 did the code half of both and cannot do the
  other half from here:
  1. ~~Prune the rooms.~~ **Done, 15 August 2026: 81 rooms and 533 documents
     deleted**, leaving 3. Season rows, the vault and the question history were
     untouched and `check-rules` still passes. Re-run `npm run prune-rooms`
     occasionally — quarterly is ample at one room per game.
  2. ~~Enforce App Check.~~ **Done and enforcing on Cloud Firestore, 16 August
     2026.** Proved in both directions on the day, which is the only way to know
     an enforcement switch actually did anything:

     | | |
     |---|---|
     | Live site, real browser | creates a room, no error, no console warning |
     | `check-rules` with its debug token | 36/36 |
     | `check-rules` with the token removed | signs in, then **`Missing or insufficient permissions`** on the first Firestore call |

     That third row is the one that matters. A signed-in but unattested client
     is now refused, which is exactly the traffic anonymous auth used to let
     through — and it is the reason a script pointed at a known room code can no
     longer burn the day's 50,000 reads.

     Authentication itself is **not** enforced, only Firestore: the negative
     test still signed in. Worth knowing before assuming everything is covered.

     **Firebase console → Security → App Check → the `APIs` tab** — not the
     `Apps` tab, which is where registration lives and where the debug-token
     menu hides. **Expand the metrics view for the product, then click
     Enforce.** It takes up to 15 minutes to take effect.

     **A product only appears there once App Check metrics have populated for
     it**, which lags real traffic by up to 24 hours. On 15 August the tab
     showed nothing but a link to the Cloud Functions documentation, which reads
     like a missing step and is not one — it is the empty state. Tokens were
     already being minted and verified on the live site at the time. Wait, then
     look again.

     Requests are classified **Verified / Outdated client / Unknown origin /
     Invalid**. Enforcement refuses everything that is not Verified, so that is
     the number to watch — and it is why the metrics appearing is a
     precondition rather than an obstacle.

     Why it matters: anonymous auth means accounts can be minted against this
     project without limit, and a game is ~800 reads against 50,000 a day — so
     one room code and a script can take the quiz down for a day. That is true
     now, not at some future scale.

     Three things that are easy to get wrong:
     - **Never add `localhost` to the reCAPTCHA allowed domains.** Firebase's
       own documentation says so outright: the site key is public, so it would
       let anyone run this app against this project from their machine. Local
       work uses a registered **debug token**, which is revocable.
     - **The harnesses are covered, and it took a different provider.**
       `check-rules`, `sync-harness` and `host-room` talk to the live project
       with the client SDK from Node, and reCAPTCHA cannot attest a Node
       process. The first attempt used `ReCaptchaV3Provider` and died with
       `document is not defined` — **every `document` reference in
       `@firebase/app-check` is in the reCAPTCHA path**, which injects a div and
       two script tags. `initializeAppCheck` itself is DOM-free, so
       `scripts/appCheck.ts` uses `CustomProvider` instead and trades the debug
       token for a real App Check token over the `exchangeDebugToken` REST
       endpoint. Verified 15 August 2026: `check-rules` 36/36 and
       `sync-harness 10` all joined within 62 ms, both with tokens accepted.

       The exchange runs **eagerly**, once per client, rather than waiting for
       something to need a token. `getToken` is lazy and enforcement is off, so
       nothing would call it — and the question the preflight exists to answer
       is whether these scripts survive enforcement being switched on. Left
       lazy, it would have reported a clean run right up until the day it
       mattered.
     - **A 403 from `www.google.com/recaptcha/…` in the console is normal.**
       Those requests are cross-origin and opaque, so the browser cannot say
       which one it was. The token minted regardless; it is telemetry, not a
       failure. Check the App Check metrics screen, not the browser console.
- **The read budget has been counted** — see [what it all
  costs](#what-it-all-costs-and-how-much-room-is-left). Roughly 27 full quiz
  nights a day against the free tier, for a weekly quiz, **at six players** —
  the cost is quadratic in room size, which is the part worth carrying around.
  [The round in review](#the-round-in-review),
  [durable identity](#durable-identity), [Form](#form--the-opening-titles) and
  [teams](#teams--shipped-15-august-2026) are all shipped, published and
  deployed. **What is missing is a round with other people in it** — a solo game
  on 15 August found the one real fault so far, and the things it could not
  reach are listed under [verified vs not](#verified-vs-not). [The closing
  seconds carry a
  clock](#the-clock) — nine seconds of gameshow music in place of the two-tone
  tick, deployed and heard on 14 August 2026. [The answer window is
  selectable](#the-configurable-answer-window) — 10 / 15 / 20 seconds, chosen in
  the lobby, defaulting to 10. The lobby also hands out a join link to paste
  into the chat — see [ways into the room](#ways-into-the-room).
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
> 36 checks — twelve that must be allowed and twenty-four that must be refused.
> Count them with `grep -c "label:" scripts/check-rules.ts` rather than trusting
> this line; it has drifted twice. The vault
> seven include the one that catches `firestore.seed.rules` being left
> published, which would leave every answer in the game overwritable by anybody.
>
> It now signs in **twice**, as two independent anonymous users. That is not
> thoroughness for its own sake: the whole point of a recovery code is that a
> *different browser* takes on an identity, and the rule branch that permits it
> cannot be reached from the client that already owns that identity, because the
> `playerId == uid` branch short-circuits in front of it. One client could only
> ever have proved that branch by reasoning about it.

---

## Turning the vault on

**Done on `quiz-d686e` — 13,593 answers, verified by the preflight and recounted
on 13 August 2026.** Kept here because it has to be repeated for any new
project, and after any re-harvest that changes question ids.

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

### Checking the vault without paying for it

**Do not run `seed-vault` to find out whether the vault needs seeding.** It
reads every document to work out what is new — 13,500 reads against a free tier
of 50,000 a day — and it costs that whether it writes anything or not. Four runs
in one afternoon took the day's reads with them and left the game unplayable;
see `b24358f`.

An aggregate count bills about one read per *thousand* index entries, so the
same question costs tens of reads instead of thousands:

```ts
const live = (await db.collection('vault').count().get()).data().count;
```

Compare it against `Object.keys(.cache/vault.json).length`, and spot-check ten
ids from that file with `db.getAll(...)` to confirm the *contents* match and not
just the total — a count alone cannot tell a correct vault from one holding the
right number of wrong answers. Around 24 reads all in. That is the check that
produced the numbers at the top of this file on 13 August 2026.

Expect the live count to run *ahead* of the local one. Orphans from revised
questions accumulate and are never cleaned up, so ahead is the healthy state;
only *behind* means a re-seed is due.

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

## The awards

Four rosettes under the final standings: fastest finger, comeback of the night,
the only one who knew, and boldly wrong. `src/engine/awards.ts` computes them and
is pure and tested; `src/components/Awards.tsx` owns the wording, the same split
as the lobby and its level names.

**The game keeps no record of itself, which is the whole difficulty.** The
answers subcollection holds one document *per player* and overwrites it every
question, and `useRoom` filters it to the current index — so `room.answers` is
only ever the question in play, and `lastDeltas` only the last one. By the final
screen, who answered what and how fast is gone.

`useGameLog` therefore accumulates it on each client as the game runs, in memory
only. Every client already receives every reveal, so this costs no reads, no
writes and no rules change, and identical input on every device means identical
awards. **The cost is that a reload loses it**, which is why `Final` only shows
awards when `log.length === room.questions.length`: a device that missed
questions would name different winners to the one beside it, and two screens
disagreeing about who was fastest is worse than neither saying.

**Confirmed on the live site**, 13 August 2026: a full ten-question game with
four players finished with all four rosettes on the final screen, which also
proves `useGameLog` caught every question — one short and nothing would have
shown at all.

Two rules the tests pin down, both about not lying:

- **An award nothing earned is left out, not shown empty.** A round nobody ever
  got right has no fastest finger, and inventing one from the wrong answers
  would be a confident lie.
- **Joint winners are sorted.** Ties would otherwise list by object key order,
  which differs between clients.

`contrarian` counts wrong answers *nobody else picked*. Being wrong with the
crowd is a bad question; being wrong alone is a decision. Note this needs three
or more players to mean anything — with two, every wrong answer is also a lonely
one.

---

## Form — the opening titles

**Shipped.** Before question one the room is told who it contains: the defending
champion, the best round of the season, who has the most rosettes, and who is
playing for the first time. Ten weeks of quizzes had left a column of numbers on
a screen most people looked at once, and every round opened as if nobody in it
had ever played before.

`formFor` in `src/engine/form.ts` is pure and tested; `ColdOpen` owns every word,
the same split as the awards and the review.

### It costs six reads, not three hundred

`loadForm` fetches one document per player in the room — read **once**, by
whoever starts the round, and written into the room document everybody is already
listening to. That is the reveal's pattern: one device pays, the rest learn it
from an update they were receiving anyway.

The obvious alternative is `loadSeason`, which is already there. It reads the
whole board — up to fifty documents — to answer a question about six people, and
every client would run it. Six against three hundred.

### The quizmaster starts the round, and nothing else does

**This was wrong in the first version and was found by playing a round.** The
titles ran for six seconds and then started the round themselves, so pressing
Start handed the beginning of the quiz to a `setTimeout`. Greg's report was
exactly right: *you lose control over the actual moment the quiz starts.*

The beginning is the one moment a quizmaster most wants to hold — while the room
reads the card, while somebody finds their drink, while you ask whether everyone
is ready. So the titles now wait. `Start the round` is a second, deliberate
press, with `Back` beside it for a pack chosen in error.

Two things make that safe:

- **The room cannot get stuck behind a quizmaster who wandered off**, because the
  role is derived from who has been present longest. If they close their laptop,
  somebody else inherits the button within a second. That is also why the old
  per-device timeout could be deleted rather than kept as a fallback.
- **The window rides inside the digest** (`form.durationSecs`) rather than on the
  quizmaster's device, so the round still opens on the window that was chosen if
  the chair changes hands while the titles are up. It cannot go on the room's own
  `durationSecs`: `timingOk()` pins that field to its previous value on every
  write except the one that opens a question, so writing it during the titles
  would be refused outright.

A room the season knows nothing about — one full of first-timers with no records
at all — has no titles worth showing and starts on the single press it was given.

### Why the titles live in the lobby

**Because the answering window is stamped by the server the moment a question
opens.** Anything laid over question one comes straight out of the room's
thinking time, which is the same reasoning that already put the round title card
on the standings screen rather than over the question.

So the round is introduced while the room is still in `lobby`, carrying a `form`
digest, and `start` follows six seconds later. This deliberately avoids a **new
phase**: the rules pin `phase` to five values, so a sixth would have cost a rules
republish, and the whole point of the Phase 2 ruleset was to be the last one.

### Three things that will bite

- **The round is started by an effect, not by `await sleep(...)` in
  `handleStart`.** `dispatch` closes over `room`, so anything awaited between
  taking that closure and writing folds the round over a snapshot that is however
  many seconds old — the same staleness that once let a pack fetch erase everyone
  who joined while it ran, measured at five of ten players. Six seconds of titles
  is a far wider window than that fetch ever was.
- **The card is time-boxed on every device, not just cleared by `start`.** A
  quizmaster who closes their laptop mid-sequence would otherwise leave the room
  on a title card nobody can clear. Every client runs its own timer from
  `form.at`, so the room falls back to a working lobby on its own.
- **`toRoomState` defaults `form` to null, and that is load-bearing.** Every room
  created before this has no field at all, and `undefined` is not `null` — the
  showing condition tests against null, so leaving it undefined would read as
  "the titles are up" in every older room.

### `playerId` on the player entry, at last

Phase 2 bounded it in the rules and deliberately left the client half unwritten.
This is the feature that needed it: the digest has to map uid to season record,
and the alternative is a `claims` read per player per game for something each
player can simply state about itself.

Written **only when it differs from the uid**, which needs a claimed recovery
code. Unconditionally it would put a redundant copy of the uid into every entry
in every room. The creator's entry carries it too — `createAndJoin` does not go
through `writeSelfIntoRoom`, so without that the one person guaranteed to be in
every room is the one whose record the titles could not find.

---

## Durable identity

**Shipped, rules published and verified on 15 August 2026.** `npm run
check-rules` reports 33 of 33, and `npm run sync-harness 10` had ten clients
joined and seeing the round start within 83 ms with none dropped — which was the
real risk, since `playerOk` gates every room write.

A season row used to be keyed on the anonymous auth uid. That uid is durable per
browser and dies with site storage: iOS Safari evicts after about a week without
a visit, and a work machine has never had it. While the row held points that cost
a total. Now it holds rosettes, and an eviction would erase a season of earned
reputation silently — the feature meant to make the league feel continuous
becoming the one that makes it feel arbitrary.

**You cannot move a Firebase Auth uid between browsers.** A custom token needs a
server, which means leaving the free tier; linking a real provider means an
account, which is the one thing anonymous auth is here to avoid. So the uid stops
being the identity.

### The shape

A **`playerId`**, which *defaults to the uid*. That default is what makes the
whole thing free: every row written before this is keyed by a uid, which is now
simply a playerId nobody has claimed. **There is no migration**, and a player who
never touches any of it is on exactly the path they were on.

A second browser takes on an identity by presenting a **recovery code** —
permanent, regenerable, and revocable. It is stored beside the remembered name
and shown on the season screen.

| Collection | What it holds |
|---|---|
| `recovery/{CODE}` | `{ playerId }`. Readable by id, never listable, never updatable, deletable by its owner. |
| `claims/{uid}` | `{ playerId, code }`. This browser's identity, readable only by it. |

### This is the room code's pattern, not the vault's

Worth being precise, because the first sketch of this design got it wrong. The
vault is `allow read: if false` because **its document ids are public** — they
ship inside the packs — so an answer had to be unreadable and merely checkable
by a rule.

A recovery code is the opposite: **the id itself is the secret.** So knowing it
is the whole proof, and the code is simply read. What that needs instead is
`list: if false`, exactly as `/rooms` has, because a capability you can
enumerate is not one. 29⁸ is about 5×10¹¹.

### Three things that will bite

- **`exists()` must come before `get()`.** A `get()` on a missing document
  returns null, and reading `.data` off null errors the rule, which denies. Drop
  the `exists()` and every browser that has never claimed anything is locked out
  of *its own row* — the common case, broken by a guard meant for the rare one.
  Both calls read the same document inside one evaluation and Firestore caches
  that, so the pair still costs one read.
- **The `||` must put the uid case first.** Rules short-circuit, so an unclaimed
  player pays no extra read at all and only somebody who has claimed pays one,
  once per game. Reversed, every player in every game pays a document read for a
  branch almost none of them need.
- **Minting is restricted to an identity the writer already holds.** Without
  that, anybody could read a playerId off the season table — they are the
  document ids of a readable collection — mint a code pointing at it, claim it,
  and write that person's row. `ownsPlayer` on `recovery` create is the whole of
  what stops it.

### Claiming folds in the record the browser already had

Without this, claiming leaves the row the claiming browser had built up sitting
on the board forever under the same person's name — nothing writes to it again
and nothing removes it. **Two rows, one human, on a table the office looks at**,
and it would have hit the two-machine case that motivated the whole feature.

`foldRecords` in `src/engine/records.ts` is the arithmetic and is pure and
tested; `mergeRecords` in `src/lib/season.ts` does nothing but read two
documents, call it, and write one back. Four things about it are load-bearing:

- **It runs *after* the claim, never before.** Writing the target row needs
  `ownsPlayer` to pass, which needs the claim already in place. Deleting the
  source works either way, because a browser always satisfies the uid branch for
  its own uid — which is also why a claimed browser can still tidy up after
  itself later.
- **Only ever the browser's own uid row.** Never a previously claimed identity:
  somebody moving between two identities is not asking for the first one's record
  to be poured into the second, and doing it would quietly move another person's
  history.
- **It is idempotent**, because the source is deleted in the same transaction
  that folds it in. A failure leaves a visible duplicate rather than a corrupt
  total, and typing the code again retries it.
- **`best` is a maximum, everything else a sum.** A personal best is not improved
  by having been set on two devices. There is a test asserting the merged row
  still satisfies every bound the rules impose, so a merge can never write a row
  the rules would then reject.

### What it does not do

- **Anyone holding a code can write that row.** Same trust model as the room
  code, deliberately. The blast radius is a leaderboard entry, and a leaked code
  can be revoked by deleting it.
- **Revoking strands nobody.** A browser that has already claimed carries its own
  `claims` document, and the season rules read *that*; the recovery document is
  consulted only when a claim is made. So deleting it stops the code being used
  again and leaves everyone who already used it exactly where they are.
- **Two devices of one person in one room are two players.** They share a
  playerId, so the second banks nothing — `lastGame` is the same game id. That is
  the right answer, and it is worth knowing before somebody reports it as a bug.

### The publish order, kept because it will matter again

Rules first, then deploy — same as [the answer
window](#the-configurable-answer-window) and the opposite of the vault's.

The new rules are fully backwards-compatible with any deployed bundle: every
field added is optional and defaulted, and the season rule's uid branch is what
an unclaimed client hits. **The reverse order is the broken one** — a new client
writing `fastest: 1` onto a season row against the old ruleset is refused by
`hasOnly`, and nobody's game gets banked.

That compatibility was traced field by field before publishing rather than
assumed, which is why the rules went live while the old bundle was still being
served and nothing broke in between.

---

## The round in review

Two panels under the rosettes, saying what the round did to the room rather than
what the room did to each other: **the one that beat everybody** — a question at
least two people answered and nobody got, shown with the answer they all missed —
and **nobody missed it**, where everyone who answered was right.

**It costs nothing.** `reviewFor` in `src/engine/awards.ts` reads the same
`useGameLog` records the awards already run on, which every device already has
because every device already receives every reveal. No reads, no writes, no rules
change.

Three decisions in it are load-bearing:

- **Two answers minimum.** One person wrong on their own is a guess, not a
  question that beat the room; one person right on their own is already the lone
  wolf's rosette. Both readings need a room to be true of.
- **Candidates are sorted, not taken in log order.** The log's order is a property
  of how *this device* watched the game. Ranking by how many people a question
  happened to, and settling ties on the lowest index, is what stops two screens
  naming different questions — the same failure the awards' sorted joint winners
  avoid.
- **The engine returns an index; the screen holds the prompt.** `Highlight` is a
  question number and a count, and `src/components/Review.tsx` owns every word.
  Same split as the awards and the lobby's level names.

### The log now survives a reload

`useGameLog` mirrors itself into **session** storage, keyed by `gameId`. Session
rather than local because the log describes the game this tab is in the middle of;
local storage would keep a finished game's log on every device forever for
something no later visit can use.

This mattered little while the awards were decoration — the final screen already
withholds them from a partial log, which is better than two screens disagreeing.
It matters a great deal for what comes next, because the same log is what will be
banked against a season, and a reloaded device would otherwise under-report
somebody's honours permanently and silently.

`parseLog` validates on the way **out** of storage as well as in, for the same
reason `cleanName` does: what is in storage is whatever an earlier build wrote
there, or whatever a bored player with the console open put there instead. A
record that will not parse is dropped rather than repaired, which shortens the log
and so withholds the awards — the safe direction.

**Not yet verified in a real room.** The parsing is covered both ways by tests and
the panels were checked on fixtures at 1280, 375 and 320 px, but nobody has
reloaded mid-game against a live room and watched the awards survive.

---

## The replay

The reveal always had a beat between the clock stopping and the verdict landing
— `HUSH_MS`, 700ms of blacked-out lecterns. It is now spent replaying the
question: every player's name lands on the lectern they picked, in the order
they got there, carrying the time they took. The verdict follows the last
arrival.

**It costs nothing.** Every device already holds `room.answers` — who picked
what and how long each took — because that is what the scoring runs on. The
replay reads the same object. No extra reads, no extra writes, no rules change,
nothing new in the room document.

`src/engine/replay.ts` is the whole of the timing, and it is pure and tested.
Two decisions in it are load-bearing:

- **Ties break on uid.** Two answers on the same millisecond would otherwise
  replay in object-key order, which differs between devices — and the room would
  watch two versions of who got there first.
- **The spread is normalised against `fullSpreadFromMs` (2.5s), not against the
  answers alone.** Normalising against the answers would stretch a photo finish
  across the full window: four people within 200ms of each other would arrive
  over more than a second, misrepresenting a scoreline that those 200ms decided.
  Dividing by at least 2.5s compresses a long tail but never exaggerates a short
  one. A tight race stays tight and ends sooner, because there is nothing to
  watch.

**`room.answers` is a new object on every snapshot.** `useRoom` rebuilds it from
scratch each time the subcollection listener fires, so anything memoised on its
identity recomputes whenever anybody's answer changes. The replay learned this
the hard way: memoised that way, a player changing their answer during the
reveal rescheduled every timer from zero, sending each chip back off the screen
to land again and pushing the verdict late. The timeline is now frozen on the
first render that has answers and not recomputed after — deliberately including
the case where a genuinely new answer arrives, because the replay is a retelling
of the question as it closed.

Frozen with a `useState` adjusted during render rather than a ref, which
`react-hooks/refs` rejects, or an effect, which `react-hooks/set-state-in-effect`
rejects. The "no replay" case is a shared constant rather than a fresh `[]`, or
the scheduling effect's dependencies change on every clock tick.

Three things follow from the replay that are easy to undo by accident:

- **The lecterns stay lit while it runs.** The old drum roll blacked out every
  tile but your own pick, which would make three of the four lecterns places
  nobody could be seen landing on. The blackout is still there for a question
  nobody answered, where there is nothing to replay and the beat falls back to
  `HUSH_MS`.
- **`prefers-reduced-motion` is handled in JS, not only in CSS.** The stylesheet
  flattens animations, but the replay is a sequence timed with `setTimeout` —
  motion the stylesheet cannot reach. `useReducedMotion` skips it and goes
  straight to the settled state.

---

## The clock

The last nine seconds of every question carry a gameshow clock: a walking bass
in A minor over a swung ride cymbal, brass marking every third second, and a
gong on zero. It replaces the two-tone tick, which told you time was passing
but never that it was running out. `tick` and `tock` are gone from the `Cue`
union entirely.

**Composed backwards from the buzzer.** `CLOCK` in `src/lib/sound.ts` is indexed
by *seconds remaining*, not seconds elapsed. That is the whole design and the
reason it survives a configurable answer window: 10, 15 and 20 all land the
identical closing cadence and differ only in how much walk they get in front,
and a window shorter than the lead — the rules allow five — starts further down
the table and still finishes on the same note. Nothing is stretched to fit, so
there is no duration that sounds wrong.

**Scheduled in one call, against the audio clock.** `startClock(remainingMs)`
schedules every oscillator to the buzzer in a single pass. The old tick fired
from a React effect on `secondsLeft`, which rides the 100ms interval in
`useQuestionClock` — so each tick landed up to a tenth of a second late. Nobody
can hear that on a lone beep and everybody can hear it on a pulse. Offsets are
computed from the real `remainingMs` rather than from whenever the call
happened, so the music stays locked to the timer face no matter what the render
loop is doing.

The cost is that it commits to an ending, so **anything that ends the question
early has to come and cancel it**: `stopClock` is called on reveal, on unmount,
and by `setMuted`. Muting cannot wait for the next note not to play, because the
next note is already scheduled.

**The gong is a cue, not part of the bed.** It fires on the reveal that already
existed (`useCue('gong', ...)`), which is deliberate: scheduled as the bed's
last cell it would sit exactly where `stopClock` runs, and the auto-reveal on
expiry would cancel it before it sounded. It replaces the old `hush` cue
outright. Its partials sit at deliberately non-whole-number ratios because a
struck plate does not vibrate in octaves — **there is a test guarding that**,
since tidying them into neat multiples would silently turn the gong back into a
bass note with nothing to show it had happened.

It is tuned to A, so it resolves the iv–V–i the walk has been climbing. The bed
ends on a leading tone that never resolves; the gong is the chord it wanted.

### Why it is not the Countdown music

Because that is a specific Alan Hawkshaw composition, copyright Channel 4, and
one of the most lucrative commissions in British television precisely because it
earns a royalty every time the clock runs. There is no open-source version and
there will not be one; every free download of it is an unlicensed rip, and a
re-recording is a derivative of the composition and needs the same licence.

What is protected is the **melody**. What is not protectable — and what does
most of the work of sounding like teatime television — is the furniture: the
walking bass, the swing, the section voicings, the chromatic approach into the
V, the gong. Those are ideas, and the harmony is a turnaround that sits under
half the standards written before 1960. All of it is used here deliberately and
none of it is anybody's property.

**Do not "improve" this by moving the melody closer to theirs.** Musical
infringement turns on whether an ordinary listener recognises the tune, so a
deliberate near-miss is the shape of case that loses — "we changed a few notes"
is the classic losing defence. Risk on that axis is not linear: it is near-zero
until it is total. Every other axis was already spent.

Freesound has genuinely CC0 clock ticks if anyone reaches for samples, but they
buy nothing this does not already synthesise, and they would put an asset on the
critical path of a round for the first time. The one genuinely public-domain
British option is the Westminster Quarters (1793, Big Ben) — it was built and
rendered, it counts down naturally in quarters to the hour bell, and it was
passed over rather than rejected. Parliament's *recordings* carry their own
copyright; the tune does not, and this project synthesises.

### What has and hasn't been checked

Verified: the arithmetic (six tests, including that every answer length lands
the same cadence and that a 3.4s window truncates correctly), the gong's
inharmonicity, and the real Web Audio path driven headless in the browser —
no errors, restart-while-running and double-stop both safe, 65 oscillators for a
full bed.

**Heard, and it works.** Confirmed by ear on 14 August 2026, which closes the
one gap none of the above could: the bed and the gong sound right, and the
balance set by eye on a waveform — 0.194 against 0.323 at peak — turned out to
be right by ear too. That was the likeliest thing to need tuning and it did not.

Two things the ear test did not settle, because neither shows up on one device:
whether several laptops in a room phase audibly against each other (see [known
limits](#known-limits)), and how it holds up over fifteen questions rather than
one. Round fatigue is the reason the bed is nine seconds and not the whole
window, but nobody has yet sat through a full round of it.

---

## Ways into the room

Three routes to the same place, in the order they are worth reaching for:

1. **The link**, copied from the lobby and pasted into the Teams chat. One tap
   and the joiner lands on the landing screen with the code already filled, so
   all they supply is a name.
2. **The code read aloud**, four characters from an alphabet that omits every
   pair people confuse — I/1/L, O/0, Z/2. This is the route that always works.
3. **The QR**, for a player on their phone with the call on their laptop. It
   carries the same link, and always did — the QR was never a picture of the
   four characters, which is worth saying because it is the natural assumption
   and it made the QR look far less useful than it was.

All three go through `codeFromHash` in `src/engine/roomCode.ts`, which is
strict on purpose: an invalid code returns null rather than half-filling the
field, because a partly-populated box someone then types into is how you join a
room nobody meant to be in.

The copy button degrades rather than lying. `navigator.clipboard` needs a
secure context and a permission the browser can refuse, and on an insecure
origin it is absent outright — which throws where the others reject. All of it
lands in one fallback: select the text, say so, and let the reader use their own
copy shortcut. A copy button that silently fails is worse than no button,
because the next paste is whatever was on the clipboard already.

**Nothing here needs rules or a re-seed** — it is client-side routing over a
room code that already existed.

---

## Next session — start here

Written 11 August 2026, revised 13 August after the join link went out, again on
14 August after the chair and the sticky desk, and again on 15 August when the
round in review shipped and the next two phases were agreed.

> ### The three-phase plan, and why identity comes before the honours
>
> **Phase 1 — the round in review. Done.** See [its section](#the-round-in-review).
>
> **Phase 2 — durable identity. Next, and the only one that touches the rules.**
> `seasons/{season}/players/{uid}` is keyed on the anonymous auth uid, which dies
> with site storage: iOS Safari evicts after about a week, and a second machine
> has never seen it. Today that costs a points total. Once rosettes and titles
> hang off the same key, an eviction erases a season of earned reputation
> silently — and the feature meant to make the league feel continuous becomes the
> one that makes it feel arbitrary. It is also the same root cause as item 1
> below.
>
> The shape: **a `playerId` that defaults to the uid**, so every existing
> `season-2` row keeps working with no migration, and a second browser may
> *claim* an existing `playerId` by presenting a permanent recovery code.
> Verification reuses the vault's asymmetry exactly — `recovery/{CODE}` is
> `allow read: if false`, so no client can look a code up while the rule itself
> can `get()` it. Claiming is an assertion judged server-side, like a reveal.
> `exists()` must precede `get()` or an unclaimed browser is locked out of its
> own row, and the `||` must put the uid case first so the ordinary player still
> pays zero extra reads.
>
> **You cannot do this any cheaper without accounts.** Moving a Firebase Auth uid
> between browsers needs either a custom token — a server, so Blaze — or linking
> a real provider, which is an account. Decoupling the season from the uid is the
> only route that keeps anonymous auth's no-signup appeal, which is most of why
> the app is pleasant to join.
>
> **Phase 3 — Form.** A cold open before question one built from the season rows
> of the people actually in the room, plus honours accumulating on those rows.
> Phase 2 publishes every rule it needs, including an optional `playerId` on each
> player's own entry so the digest costs no extra reads.

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

## What it all costs, and how much room is left

**Counted 15 August 2026, and it is now one command:**

```bash
npm run take-stock
```

Aggregate counts, so the whole thing costs single-digit reads. **This is the
script to reach for instead of `seed-vault`**, which reads every answer to work
out what is new and has taken the game down for a day. It needs the service
account, because `list` is denied to clients on `/rooms` and `/recovery` and a
count is a query.

| | |
|---|---|
| rooms | 79 — of which **1 carries `expiresAt`** |
| vault answers | 13,593 |
| `season-2` players | 20 |
| recovery codes | 0 |
| identity claims | 0 |

The last two are zero because they shipped that morning.

`take-stock` now also counts how many rooms carry `expiresAt`, which is the
number that says how much of the backlog a TTL policy can actually reach — and
the check that the field is still being written at all. The 78 without it
predate the change and will sit there until somebody removes them from the
console.

### Reads, for a six-player night

| | |
|---|---|
| The round itself | ~1,500 |
| The opening titles | ~12 — six for the digest, six for the fan-out |
| Everyone opening the season board | ~300 — 50 rows each |
| **A full night** | **~1,812** |

**About 27 full nights a day against a 50,000-read free tier, for a weekly
quiz.** Writes are nowhere near the limit: a game is well under 200 against
20,000 a day.

### The number that matters is not 1,812, it is the shape

**That figure is for six players, and the cost is quadratic in room size.**
Every client holds an unfiltered `onSnapshot` on the answers subcollection, so
each answer written is one changed document delivered to all *N* listeners:

```
reads ≈ Q·N²  (answers)  +  ~3·Q·N  (room-document transitions)
```

| Players | Reads, 15 questions | Games/day on the free tier |
|---|---|---|
| 6 | ~810 | ~61 |
| 12 | ~2,700 | ~18 |
| 25 | ~10,500 | ~4.7 |
| 50 | ~39,750 | ~1.25 |
| 100 | ~154,500 | **one game cannot finish** |

Doubling the room roughly quadruples the bill. Nothing about an office quiz gets
near this — but it is the reason "how many nights a day" is a misleading way to
hold the budget, and the first thing to re-derive if the rooms ever get bigger.

**The wall that arrives first is not Firestore, though.** The Realtime Database
on the Spark plan caps at **100 simultaneous connections, project-wide**, and
every player holds one for presence. That is around sixteen concurrent
six-player rooms across the whole project, and connections are refused rather
than degraded. Blaze raises it to 200,000.

If the reads ever genuinely bind, the fix is not a rewrite: **move the answers
fan-out to the Realtime Database**, which is already wired up, already carries
presence, and is billed on bytes rather than per document. A 50-player game is
~7.5 MB against a 10 GB/month allowance — roughly 35× the headroom, on the same
free tier. It is contained to `useRoom.ts`, because `submitAnswer` and
`room.answers` are the only surface anything else sees.

### What the season work actually added

Almost nothing per game, which was the point of every design decision that
looked fussy at the time:

- **The opening titles cost twelve reads, not three hundred.** `loadForm` runs
  once, on the quizmaster's device, and everybody else learns the result from a
  room update they were already receiving. `loadSeason` would have been fifty
  rows per person.
- **`ownsPlayer` costs nothing for an unclaimed player.** Rules short-circuit and
  the uid branch is first, so only somebody who has claimed an identity pays a
  read — one, once per game, when their row is banked.
- **Honours, the merge and the review are free.** Honours ride inside the
  transaction that already reads the row; the merge is two reads on a claim,
  which happens once ever; the review reads a log that is already in memory.

**The season board was the one line worth watching**, and it is the one thing
here that is user-driven rather than per-game: 50 reads every time somebody
opened it, and the final screen points them at it. At six people that was 300 a
night.

**It is now cached for a minute** (`TABLE_CACHE_MS` in `src/lib/season.ts`),
which is aimed at the pattern that actually costs — one person bouncing between
the final screen and the board and back — rather than at one person looking
once. Both writers in that file clear the cache, so your own game and your own
claim always show immediately; the window can only ever hide somebody else's
row, for less than a minute. A lower `TABLE_LIMIT` is still the next lever if it
ever matters.

### The two slow leaks

- **Rooms.** 79 after a couple of months, at roughly one per game, every one
  holding players' names, and `allow delete: if false`. **Every room created
  from 15 August 2026 carries an `expiresAt` timestamp** so a Firestore TTL
  policy has something to expire against — the client half is done, and **the
  console half is not.** Until the policy exists, nothing is being deleted.

  > ### Firestore TTL policies need billing enabled
  >
  > **Creating one on this project fails with `403: Project quiz-d686e has
  > billing disabled`.** TTL is a Blaze feature. The Firebase and Cloud TTL
  > documentation does not say so anywhere on the page — it is discovered at the
  > Create Policy button. Written down here so nobody spends another afternoon
  > looking for the setting.
  >
  > So the answer is **`npm run prune-rooms`**, not a policy. It does the same
  > job from a machine that already holds the service-account key, and it is
  > better in two ways: it deletes the `answers` and `reveal` subcollections,
  > which a TTL sweep orphans forever, and with `--legacy` it reaches the rooms
  > written before `expiresAt` existed, which a policy can never touch.
  >
  > ```bash
  > npm run prune-rooms              # lists what it would delete, deletes nothing
  > npm run prune-rooms -- --legacy  # also lists rooms with no expiresAt
  > npm run prune-rooms -- --go      # actually deletes
  > ```
  >
  > It is capped at 200 rooms a run and skips `rules-check-live`, which the
  > preflight owns and recreates. Nothing runs it automatically; at one room per
  > game that is a job for once a quarter, and `take-stock` says when it is due.

  `expiresAt` is still the right field and is still written, because it is what
  makes "past its expiry" a question the data can answer rather than a guess
  about age. The retention lives in `ROOM_RETENTION_MS` in `useRoom.ts` and is
  thirty days.

  **If this project ever moves to Blaze**, a TTL policy becomes available and is
  worth having as well — it is automatic where the script is not. Google Cloud
  console → Firestore → Databases → `(default)` → Time-to-live → Create Policy,
  collection group `rooms`, timestamp field `expiresAt`, **expiration offset 0**
  because the thirty days are already in the field. The field name is **typed
  in, not chosen from a list**: Firestore has no schema, so the form cannot
  enumerate fields, and it does not need the field to exist yet either. Even
  then, keep the script — a policy still orphans the subcollections.

  No rules change was needed for `expiresAt`, which is worth knowing before
  anybody goes looking: `wellFormed()` bounds the fields it names and does not
  `hasOnly` the document's keys, the same reason `openedAt` can be written
  without being declared.

  79 rooms currently predate `expiresAt`. `npm run prune-rooms -- --legacy`
  lists them; nothing has been deleted.

- **Recovery codes are never tidied**, though they are deletable by their owner,
  which is how a leaked one is revoked. One document per person who ever asks
  for a code, so it is far slower than rooms.

---

## Where things are

```
src/engine/     Pure TS game rules — no React, no Firebase. All the logic worth testing.
src/lib/        Firebase wiring (useRoom), pack loading, the question clock, the house audio,
                and the remembered name — the one other thing kept in localStorage besides
                the sound preference, and written to the same pattern.
src/screens/    One component per phase + a design gallery (Preview).
src/questions/  Pack types and the classification rules, with tests.
src/design/     One stylesheet, design tokens at the top.
scripts/        Build-time question harvest, and the multi-client test harnesses.
```

Commands: `npm run dev` (serves at `/quiz/`, port 5273), `test`, `typecheck`, `lint`,
`build`, `deploy`, `fetch-questions [-- --resort]`, `fetch-otqa`, `seed-vault`,
`check-rules`, `sync-harness [n]`, `host-room [-- secs]`, `take-stock`.

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
| **`.stage` is `overflow: clip`, with `overflow: hidden` declared above it** | Both keep the beams and the halo in their box, but `hidden` *also* makes `.stage` a scroll container — so a `position: sticky` descendant sticks to a box as tall as the page, which never scrolls. That is why the desk sat below the fold on a fifteen-question round. The duplicate declaration is the fallback: a browser too old for `clip` drops that line, loses the sticky desk and keeps the beams contained, which is the right way round to fail. |
| **The answer lamps carry names; they used to be anonymous dots** | The dots were defended on the grounds that watching the room commit is the tension of a live round. It is — but a dot cannot be chased, and the question actually being asked is *who are we waiting for*. What must not leak is **which lectern** somebody picked, and that is untouched. Both sides are already streamed to every device, so it costs no reads. Ordered by arrival and never re-sorted, so no name moves while it is being read. |
| **The chair's label may overhang its column, but only to a cap** | A tie for last joins two names with an ampersand into a column barely wider than the chair. A span sizes to its content, so letting it overhang solves the common case — but a name with no space in it has nothing to wrap on and would run out of the side of the stage silently, since `.stage` clips rather than scrolls. The cap is what bounds it; `break-word` rather than `anywhere` is what stops BARTHOLOM/EW. |
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
| **Sound is on by default** (`src/lib/sound.ts`) | It only ever plays after a deliberate click — creating a room, joining, answering — so it can't ambush anybody on page load, and muted-by-default means nobody discovers it exists. The toggle is top-right on every screen and the choice persists. Every cue is synthesised from oscillators: the stings as files would have been most of a bundle the handover already calls heavy, and an asset that 404s behind a proxy is a silent round with nothing on screen to explain it. That reasoning got stronger with the clock — nine seconds of music is the one cue where a 404 would be unmissable, and it still ships as zero bytes. |
| **The clock table is indexed by seconds *remaining*** (`CLOCK`) | It is composed backwards from the buzzer, which is what makes one piece of music fit every answer window without being stretched. Reindexing it forwards would mean a 10s and a 20s round ending differently, and a 5s imported room ending mid-phrase. See [the clock](#the-clock). |
| **The bed is scheduled in one call, not a note at a time** (`startClock`) | Per-note firing rides the 100ms render interval, so every note lands up to a tenth of a second late — inaudible on a beep, ruinous on a pulse. The cost is that it commits to an ending, so `stopClock` must be called on reveal, on unmount, and on mute. |
| **The gong is a reveal cue, not the bed's last note** | Scheduled as part of the bed it would sit exactly where `stopClock` runs, and the auto-reveal on expiry would cancel it before it sounded. As a cue on the existing reveal trigger it cannot be cancelled by the stop that clears the bed. |
| **The gong's partials are not whole multiples of its fundamental** | A struck plate does not vibrate in octaves; that inharmonicity is the entire difference between a gong and a low note. There is a test, because rounding them to neat ratios is exactly the kind of tidy-up that looks like an improvement and silently destroys the cue. |
| **The clock is an original composition, and must stay one** | The Countdown music is Alan Hawkshaw's, copyright Channel 4. Melody is what's protected; the walk, swing, voicings and gong are not. Moving the tune closer is the one change that converts near-zero legal risk into total — see [why it is not the Countdown music](#why-it-is-not-the-countdown-music). |
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
| **The opening titles are a lobby state, not a sixth phase** (`form` on the room) | The rules pin `phase` to five values, so a sixth costs a rules republish — and the Phase 2 ruleset was meant to be the last. A round introduced while the room is still in `lobby` needs no new phase and no console step. |
| **Nothing starts a round on a timer** (`handleBeginRound`) | The first version ran the titles for six seconds and then started the round itself, which handed the beginning of the quiz to a `setTimeout`. Found by playing a round: the start is the one moment a quizmaster most wants to hold. The room cannot stall behind an absent quizmaster because the role is derived from who has been present longest, so the button always exists for somebody. |
| **The chosen window rides inside the digest** (`form.durationSecs`) | It cannot go on the room's own `durationSecs`, which `timingOk()` pins to its previous value on every write except the one that opens a question — writing it during the titles is refused outright. Inside the digest it is ordinary data the rules do not inspect, and it survives the quizmaster's chair changing hands while the titles are up. |
| **`loadForm` reads one document per player, not the season table** | `loadSeason` reads up to fifty documents to answer a question about six people, and every client would run it. One device reads six and writes a digest the rest get from an update they were already receiving — the reveal's pattern. |
| **The landing page has a short-viewport tier, keyed on height not width** | It was never too narrow — it ran out of vertical room the moment the team box arrived, and a laptop is about 900px of content. A monitor with the room keeps the full-size wordmark and the generous rhythm; a laptop gets the compact one. Nothing is hidden or moved either way, so there is still only one layout to reason about. |
| **That tier lives at the very end of the stylesheet** | It overrides `.stage__inner`, `.wordmark`, `.lede` and `.panel`, all of which are defined further down the file — at equal specificity the later rule wins, so a media query placed above them silently does nothing. This was got wrong twice while writing it: once the wordmark did not shrink, then moving the block to fix that quietly reverted the panel and lede overrides instead. |
| **Name and team sit side by side above 46rem** (`.identity`) | They are one thought — who is playing — and stacking them cost the landing page exactly the height that put it behind a scroll. Same breakpoint as the two action panels, so the page reflows once on the way down to a phone rather than twice. |
| **A team is grouped on a normalised key but shown as it was typed** (`teamKey`) | Free text means "Engineering", "engineering" and " Engineering " all exist. Keying on trimmed lowercase merges them on the board without rewriting anybody's spelling. Deliberately nothing cleverer — collapsing "Eng" into "Engineering" needs a dictionary, and merging two teams somebody meant to keep apart is worse than showing both. |
| **An empty team never clears one that is already set** (`GameResult.team`) | The team lives on the season record but is remembered per browser. A regular who set theirs on a laptop and then played from a phone would otherwise wipe it by banking a single game, silently. Removing a team is a deliberate edit, not a side effect of playing. |
| **Firebase is a separate build chunk** (`vite.config.ts`) | Not to make the download smaller — it is a few hundred bytes bigger. As one file every deploy changed the hash, so a returning player re-fetched the whole 260 kB including the Firebase half that had not changed, seeing nothing until it landed. Split, an ordinary deploy leaves that hash alone. Proven by building twice across a real code change; a comment-only change proves nothing, because minification strips it and the output is byte-identical. |
| **`motion` is a separate chunk too** (`vite.config.ts`) | Same argument, measured rather than assumed: it is 119.71 kB raw / 39.61 kB gzipped, which was 35% of the app chunk, for `MotionConfig` and the standings reorder and nothing else. Split, an ordinary deploy re-invalidates 74 kB gzipped instead of 114 kB. Matched on `framer-motion` as well as `motion`, because that is what `motion/react` re-exports and half of it lands back in the app chunk otherwise. |
| **The season table is cached for a minute** (`TABLE_CACHE_MS`) | It is the one read here that is user-driven rather than per-game, and the final screen points every player at it. The pattern that costs is bouncing between the final screen and the board, not looking once. Both writers in `season.ts` clear the cache, so your own game and your own claim are never what the window hides. Handed out as a copy, because the cache holds the only reference and an in-place sort added later would corrupt every read after it rather than failing where it was written. |
| **`recordAsked` is given the history rather than reading it** | `selectQuestions` has already read the same document to choose what to serve, so reading it again was the same document twice in one round start. The cost is that the read-to-write gap widens from nothing to the length of a round start, so two rooms opening the same pack in the same season inside that window would see one overwrite the other's history. What is lost is a repeated question, which is the thing this mechanism is a best effort against anyway — the caller already swallows a failure here for the same reason. |
| **`bankedRef` is cleared when banking fails** (`App.tsx`) | It is set before the write, so a re-render cannot bank twice — but that also meant one flaky moment on the final screen lost the game permanently, because the ref said it had been banked and nothing ever looked again. Retrying is safe by construction: `recordGame` compares `lastGame` inside its transaction, so a retry that races a write which did land is a no-op. Nothing retries on a timer; the next room update or a reload is what tries again, and on a finished room the document is almost never written. |
| **A whole-document `set` must name every field, including ones no feature uses yet** (`PlayerRecord.team`) | Both season writers use `set`. `team` was bounded in the rules ahead of its feature, and neither writer knew about it — so the first game anybody played after teams shipped would have cleared their league, and the one after that too. Teams would have appeared to work and quietly emptied themselves overnight. Anything else added to `firestore.rules` ahead of its client needs the same treatment. |
| **`playerId` defaults to the auth uid** (`playerIdFor`) | It is what makes the change free. Every season row already written is keyed by a uid, which the new scheme reads as a playerId nobody has claimed — so there is no migration, no backfill, and a player who never claims anything behaves byte-for-byte as they did. Nothing is even stored until a claim happens. |
| **`exists()` precedes `get()` in `ownsPlayer`** | A `get()` on a missing document returns null and reading `.data` off null *errors* the rule, which denies. Without the guard, every browser that has never claimed anything is locked out of its own row — the common case broken by a check meant for the rare one. |
| **`ownsPlayer` tests the uid branch first** | Rules short-circuit. First, an unclaimed player costs no extra read and only a claimed one pays, once per game. Reversed, every player in every game pays a document read for a branch almost none of them need. |
| **A recovery code is *read*, where a vault answer is *asserted*** | Opposite problems. The vault's document ids ship inside the packs, so they are public and an answer had to be unreadable. A recovery code's id *is* the secret, so knowing it is the whole proof. What that needs is `list: if false`, which is the room code's pattern, not the vault's. |
| **A recovery code can only be minted for an identity you already hold** | playerIds are the document ids of a readable collection — anyone can read one off the season table. Without `ownsPlayer` on create, they could mint a code pointing at it, claim it, and own that person's row. |
| **`recovery` is deletable by its owner but never updatable** | Update is the dangerous one: it would let whoever handed a code out re-aim it at another identity afterwards. Delete is revocation, and it strands nobody — a browser that already claimed holds its own `claims` document, which is what the season rules actually read. It is also what stops `check-rules` leaving an undeletable document behind on every run. |
| **Claiming folds the browser's own row in, and only its own** (`mergeRecords`) | Otherwise claiming leaves an abandoned row on a shared board under the same person's name, which is exactly the two-machine case the feature exists for. Only the uid row, never a previously claimed identity — that would move somebody else's history. Run after the claim, because writing the target needs `ownsPlayer` to pass. |
| **The merge arithmetic lives in the engine, the transaction in lib** (`foldRecords`) | It is the one piece of this that can quietly corrupt a season total, and a Firestore transaction is not something a test can reach. There is a test asserting the merged row still satisfies every bound the rules impose, so a merge cannot write a row the rules would then reject. |
| **Honours are banked only from a log covering the whole game** (`sawWholeGame`) | The final screen already withholds the awards from a partial log, but that is a screen saying nothing for one evening. Banking is permanent, so a device that reloaded mid-game would under-report somebody's shelf forever. The check is exported and shared rather than written twice, because the way two copies drift is one of them quietly banking off a partial log. |
| **A joint award counts in full for everybody who shared it** (`honoursFor`) | Sharing the fastest finger is still having been the fastest finger. A fraction is not something a shelf can hold, and awarding it to nobody loses the thing that happened. |
| **The season table shows a dash, not a nought, for no rosettes** | Almost every row predates honours entirely. A column of zeroes reads as a season of failure rather than a column with no history behind it. |
| **The review returns a question index, never a prompt** (`Highlight`) | The engine has no business holding copy, and an index cannot be reworded into something the round did not do. `Review.tsx` owns the sentences, the same split as the awards and the lobby's level names. |
| **The review ignores a question fewer than two people answered** (`MIN_ATTEMPTS`) | One wrong answer on its own is a guess rather than a question that beat the room, and one right answer on its own is the lone wolf's rosette, already awarded. Both panels are claims about a room. |
| **Review candidates are sorted rather than taken in log order** | The order the log holds is a property of how *this device* watched the game. Two screens naming different questions is exactly the failure the awards' sorted joint winners exist to avoid, and it would show up only when two people compared screens. |
| **The game log is in `sessionStorage`, not `localStorage`** | It describes the game this tab is in the middle of. Local storage would leave a finished game's log on every device forever, for something no later visit can read — and the log is the one thing here that is worthless the moment its game is over. |
| **`.review` sizes its columns with `minmax(min(18rem, 100%), 1fr)`** | A bare `minmax(18rem, …)` is honoured even when the container is narrower than 18rem, so the track runs out of the side of a small phone. `.stage` clips rather than scrolls, so it would go silently. The rosettes get away with a bare `13rem` only because that is smaller than any screen we have met. |
| **Fonts are self-hosted** (`src/design/fonts.css`) | The display faces carry the whole look; a network that blocks `fonts.googleapis.com` would drop it to Impact with no warning. Archivo is variable — Google's CSS lists it once per weight but serves the same file each time, so it's declared once instead of shipping 105 kB of duplicates. |

---

## Verified vs not

**Verified against the live Firebase:** anonymous sign-in, room creation, pack
selection, round start, question render, answer write, reveal and scoring, and
leaving a room. Engine covered by 140 tests including six full three-question
games (quizmaster disconnect, skip, reset, ties). 272 across the repo, the
balance being the question pipeline, the clock's arithmetic, the review, the
honours and the recovery code.

> The count in this file had been stale at 192 for several commits before the
> review landed; the suite was already at 208. Read it as "roughly this many"
> and trust `npm test`.

**Verified in the browser, on fixtures only:** every screen at 1280px and 390px,
the level picker disabling a level its pack can't fill, and no horizontal scroll
at the narrow width. Added 14 August: the remembered name prefilled with **Start
a new room** live on arrival and an empty box on a first visit; both podium
fixtures with the chair; the desk pinned at every scroll position on a
fifteen-question, ten-player round; and the chair's label at its worst case — 24
characters with no space in them — measured against the podium row height to
confirm it cannot push the risers around.

**A round has now been played on all of it, solo, on 15 August 2026.** It found
one real fault — the titles starting the round on a timer, [now
fixed](#the-quizmaster-starts-the-round-and-nothing-else-does) — and nothing
else. What a solo round could not cover, and what to watch on the next one with
other people in it:

- **The titles on more than one device.** Everybody should now leave the card at
  the same moment, because they all leave on the same room update rather than on
  their own timers. Never watched.
- **A recovery code actually moving a record between two browsers**, and the
  merge folding the old row in. `check-rules` proves the rules permit it from a
  genuinely second client; nobody has done it through the UI.
- **Honours appearing on the season table.** They are banked from the game log,
  which is now persisted, but a rosette has never travelled from a final screen
  to a row.
- **The review panel with a real room in it.** Both its highlights need at least
  two people who answered, so a solo round can never show either.
- **Two people in different teams on the board.** The filter is covered on
  fixtures and the rules accept the field, but no real record has carried a team
  yet — the first game anybody plays after the deploy of 15 August will be the
  first to write one.

**Not verified in a real room:** everything from 14 August. The name persists
across a reload on one browser, but has not been watched surviving a week, and
the iOS Safari eviction window above applies to it. Nobody has yet lost a round
badly enough to sit in the chair in anger.

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

1. ~~**Whether the clock sounds right.**~~ **Done** — heard on 14 August 2026
   and it works, including the bed-to-gong balance that had been set by eye
   rather than by ear. What one pair of ears cannot cover is several laptops
   phasing against each other, or fifteen questions of it in a row; both are
   noted under [the clock](#the-clock).
2. **Quizmaster handover with real clients.** The reaper and the join race are now
   covered by `sync-harness`, but a quizmaster actually dropping out mid-round and
   the role passing to somebody else has still only been tested in the engine.
3. **Keyboard shortcuts in a live round.** A–D/1–4 to answer, Space to reveal or
   advance. Compiles and the legend renders; keys never pressed in a real game.
4. **A ramped round in play.** `selectQuestions` is unit-tested, but nobody has
   watched a fifteen-question ladder actually climb in a live room.
5. **Reachability from the work network.** `github.io` is confirmed fine.
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
- **~262 kB gzipped across two chunks** — 114 kB of app and 148 kB of Firebase —
  plus 67 kB of fonts. **The split is about the deploy, not the download.** As
  one file, every deploy changed the bundle's hash, so a returning player
  re-fetched all of it including the Firebase half that had not changed, and saw
  nothing at all until it landed because `index.html` is a 0.7 kB shell. That was
  the delay after each deploy, and only after each deploy — every visit
  afterwards was cached. Split, an ordinary change leaves the Firebase chunk's
  hash alone. **Verified by building twice across a real code change**, not
  assumed: the app hash moved and the Firebase hash did not. `font-display: swap`
  was already set, so the fonts were never part of it. The review, the
  recovery panel, the identity modules and the opening titles added about 5 kB
  between them. The
  lobby QR
  code added about 10 kB of that (`qrcode-generator`, MIT, no dependencies) —
  more than it looked like it would. Code-splitting is the fix if it matters.
  The clock added 0.9 kB, being oscillators rather than audio.
- **Devices in the same room will phase against each other.** Each one schedules
  its own clock from when *it* saw the question open, and those moments differ by
  the spread of the Firestore snapshot. This was already true of the tick and
  nobody remarked on it; nine seconds of music makes it far more noticeable. It
  cannot be fixed by syncing to `questionOpenedAt` without folding the
  quizmaster's clock offset back into every device — the thing
  `useQuestionClock` exists to avoid. If it grates in a real room, the honest
  fix is fewer laptops with the volume up, not a shared clock.
- **A non-member can still write an answer document.** Nothing checks
  membership on the way in — the room code is the capability, as everywhere
  else. It no longer *scores*, and no longer inflates the answered count, but
  the write itself is still possible and the rules still permit it. What that
  costs now is a stray document, not somebody's game.
- **Season standings follow the browser until somebody saves a recovery code.**
  Anonymous auth gives a durable uid with no sign-up, which is the whole appeal
  and was the whole limitation — **iOS Safari evicts site storage after about a
  week without a visit**, so a weekly quiz survived and a fortnight off did not.
  [Durable identity](#durable-identity) is the answer to that, and it is opt-in
  by design: a player who never saves a code is exactly where they always were,
  and eviction still costs them everything. The remembered name has the same
  lifetime and for the same reason, which is deliberate: it is
  stored beside the uid rather than fetched from the season row, so the two can
  never disagree about who this browser is.
- **Honours are counted per device, so a device that missed a reveal banks
  none.** `useGameLog` is assembled from reveals this client saw, and
  `sawWholeGame` refuses to bank from a short log — which is the safe direction,
  but it means a player can silently lose a night's rosettes rather than merely
  see a screen say nothing. Session storage made this much rarer, since a reload
  no longer loses the log; a coalesced snapshot could still do it. Not fixable
  without letting one device write everybody's row, which is the thing the rules
  deliberately prevent — the same trade-off as somebody closing the tab before
  the final screen.
- **The `recovery` collection only grows.** Same shape as rooms never being
  deleted: each minted code is a permanent document. It is deletable by its
  owner, which is how a leaked code is revoked, but nothing tidies up
  automatically. One document per person who ever asks for a code, so it is a
  much slower leak than rooms.
- **The season board is the one read that scales with curiosity rather than with
  play** — 50 rows every time somebody opens it, and the final screen now points
  them there. Counted properly under [what it all
  costs](#what-it-all-costs-and-how-much-room-is-left).
- **The answer lamps have no cap, so a very large room makes a tall desk.** Ten
  names wrap to two rows on a phone, which is about 20% of the screen and was
  judged worth it. Twenty names would be four rows and would start to crowd the
  lecterns. It degrades rather than breaks — the strip grows and the question
  scrolls under it — but if the office ever fields that many, the fix is to name
  only who is *outstanding* and collapse the rest to a count.
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

14,176 questions from two sources, both CC BY-SA 4.0 and **committed as JSON** —
no runtime API, no key in the bundle, no rate limit:

- [Open Trivia DB](https://opentdb.com) — 3,996 questions, each with a
  difficulty rating
- [OpenTriviaQA](https://github.com/uberspot/OpenTriviaQA) — ~39,000 usable
  questions, no difficulty rating, capped into the packs

Packs: General Knowledge / Geography / History / Odds & Ends / Music / Science /
TV & Film / Best of British 1,500 each, Video Games 1,400, Sport 776 — counted
from `public/packs/` on 13 August 2026, after the US-nickname filter fix in
`eafcfce` gave Sport its 20 back.

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
| Sport | 125 | **776** |
| Best of British | 201 | 1,500 |
| Geography | 299 | 1,500 |
| History | 340 | 1,500 |
| General Knowledge | 345 | 1,500 |
| TV & Film | 397 | 1,500 |
| Music / Science | 399 | 1,500 |
| Odds & Ends | 640 | 1,500 |
| Video Games | 999 | 1,400 |

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
> need checking, there are two cheap ways and neither is this script:
> [an aggregate count](#checking-the-vault-without-paying-for-it) answers "is it
> seeded?" for about 24 reads, and `npm run check-rules` proves the vault *path*
> works for about 24 operations.

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

## Lessons from the 15 August session

Six wrong statements were made about Google's console and Firebase's product
behaviour during one afternoon's work. Every one of them was about the
**platform**, not the code — the codebase claims in the same session were
checked empirically and held up. That asymmetry is the lesson, so it is written
down here rather than quietly fixed.

| What was claimed | What is true |
|---|---|
| "Add `localhost` to the reCAPTCHA allowed domains" | **Never do this.** Firebase's docs say so outright: the site key is public, so it lets anyone run this app against this project from their machine. Debug tokens exist for exactly this. |
| A TTL policy on `createdAt` would work | It deletes when the field is *in the past*, so a creation stamp marks every room eligible the instant it is written. The field must be an expiry. |
| "A TTL policy has no duration setting" | An optional **expiration offset** exists. The correction to the first error overshot into a second one. |
| "Leave the offset blank" | The form requires a value. It is `0`. |
| TTL was presented as a free-tier fix | **TTL requires billing enabled.** Creating one on Spark fails with a 403, which is stated on neither documentation page. |
| Enforcement lives at a named console path | Half right, and asserted before checking. Security → App Check → APIs → **expand the Cloud Firestore row** → Enforce. |
| "The APIs tab is empty because metrics lag by 24 hours — wait" | It was not empty. The Cloud Firestore row was there, below the Functions row that happened to be on screen. A day was lost to this. |

**The rule that would have prevented all six: never state platform behaviour
from memory.** Fetch the documentation first, and where the documentation is
silent — as it was on TTL and billing — say it is silent rather than filling the
gap with a plausible guess. A confident wrong instruction about a console costs
more than "I need to check", because it is acted on.

**The second rule: a correction is not automatically right either.** Two of the
six were corrections to earlier errors. After being wrong once about a thing,
verify the replacement claim harder than the original, not less.

**The third rule, and the expensive one: when what somebody reports seeing
contradicts what you told them, ask what is on their screen. Do not explain the
contradiction away.** Told that the enforcement tab showed only a Functions row,
the answer given was an invented mechanism — metrics lag, empty state, wait a
day — and a day was duly lost. The real answer was that the Cloud Firestore row
was sitting just off the bottom of the screenshot. A report from someone looking
at the thing beats a theory about the thing, every time, and the cheapest
possible move was one question.

**What did work**, and is worth keeping as the pattern: every claim about *this
repo* was proved by running something. The `expiresAt` write was confirmed by
creating a real room and reading it back. The App Check token was confirmed by
decoding it out of IndexedDB. The Node incompatibility was found by running
`check-rules` rather than reasoning about whether `firebase/app-check` needs a
DOM — and the fix was found by grepping the package to see *which* code touched
`document`. Nothing in that column had to be walked back.

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
- **An error notice must be tied to the state it was raised against.** `App.tsx`
  stamps every `report()` with the room's `gameId:index:phase` and renders it
  only while that still matches, because the failures worth showing here are
  transient by design — the vault refuses a reveal until the server agrees the
  clock has run out, and says so. Held as a plain `string`, one such refusal
  stayed on screen for the rest of the game. Derive the staleness; do not clear
  it in an effect, which trips `react-hooks/set-state-in-effect` and leaves a
  frame where the room has moved on and the old notice is still painted.
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

- `npm audit` — 0 vulnerabilities, production and dev. **This drifted and was
  put back on 15 August 2026**: two high-severity advisories had appeared in
  dev-only transitives (`nanoid` under `vite`, `brace-expansion` under `eslint`),
  cleared by `npm audit fix`. The production tree was never affected. Re-run it
  before a review rather than reading this line — that is the whole lesson.
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

1. ~~**No App Check, no rate limiting.**~~ **App Check is enforcing on Cloud
   Firestore as of 16 August 2026**, verified by a negative test: the same
   script that passes 36/36 with its debug token is refused outright without
   one. Anonymous accounts can still be minted, but they can no longer *read*
   anything without attesting, which was the exposure — the free tier is 50k
   reads a day and a game is ~800, so a script pointed at one room code could
   take the quiz down for the office for a day.

   Still open around it:
   - **The Realtime Database is not enforced**, only Firestore. It holds
     presence only, so the blast radius is ghosts in a lobby rather than the
     read budget, but it is not covered.
   - **Authentication is not enforced.** The negative test still signed in.
   - **No rate limiting**, and no budget: **on Spark there is no bill to run up
     and no budget to set** — budgets live in Cloud Billing, which a free
     project has no account for. The substitute is the console's usage alerts.
     **If this project is ever moved to Blaze, set a budget that day** — the
     same exhaustion stops being an outage and starts being an invoice.
2. ~~**Rooms are never deleted**~~ **Solved, 15 August 2026 — but not the way
   it was planned.** Rooms carry `expiresAt` and `npm run prune-rooms` removes
   the expired ones along with their subcollections. The intended fix was a
   Firestore TTL policy; **TTL requires billing enabled and this is a Spark
   project**, which is not stated on either documentation page and is discovered
   at the Create Policy button. The item is closed once somebody actually runs
   the script with `--go`; 79 rooms are still there. See [the two slow
   leaks](#the-two-slow-leaks).
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
