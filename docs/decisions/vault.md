# The answer vault

> **Owner: Greg Rothwell. Last updated: 20 August 2026. Budget: 250 lines.**

Moved verbatim out of `docs/HANDOVER.md` on 20 August 2026, when that file reached
2,422 lines. The text is unchanged; only where it lives is.

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
window](answer-window.md#the-configurable-answer-window) for why both of those are load-bearing.

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

## The gate had no margin, and the host was the one who paid

**20 August 2026.** Everything above is about *whether* the gate opens. This is
about *when* a client may ask, which turned out to be a separate question with a
much worse answer.

The rule is `request.time > openedAt + durationSecs * 1000` — strict, on the
server's clock. A client cannot read that clock, so it has to pick a local moment
it can prove is later. `useQuestionClock` was assumed to be one, and said so:

> *"measured from when this device saw the question open, which is necessarily
> after the server stamped it — so a local clock always expires a little after the
> gate does, never before."*

**True of every device except the one that reveals.** The quizmaster *wrote* the
question open, and latency compensation delivers that write back as a local
snapshot before the server has seen it — so their countdown starts at roughly the
click while `openedAt` is stamped a hop later. Worse: both writes cross the same
network and are judged by the same clock, so latency and skew **cancel**, leaving
only the milliseconds between the countdown expiring and the write going out.

### What the measurement said

`npm run reveal-probe [secs] [offsetMs]` writes a single candidate — the answer
the vault already holds for the harness question — so the only clause that can
refuse it is `windowClosed()`. A refusal is the gate and nothing else.

| | |
|---|---|
| pending local snapshot | +6 to +12ms after the open write was issued |
| server-confirmed snapshot | +55 to +96ms |
| margin at the local anchor | **about 7ms** |
| asking 100ms early | **REFUSED** |
| asking 250ms early | **REFUSED** |

`npm run sync-harness 10` says it from the other side without being asked to: the
host saw the question at **+6ms** and the other nine at **+82–86ms**.

So the reveal was a coin flip on jitter, and the app paid a flat 1500ms
`REVEAL_RETRY_MS` every time it lost one — most of them, on a network jitterier
than a home connection. **The scripts hid it:** `host-room` added 1000ms of slack
and `check-rules` 1500ms, both explaining that the browser got the same margin for
free. It never did, and the harness passed by compensating for the bug.

### The fix, and why it needs no tuning

Anchor on the first **server-confirmed** snapshot instead
(`src/engine/revealGate.ts`, `questionConfirmedAt` in `useRoom`). It cannot reach
the device before the server stamped `openedAt`, because the stamping happens
first and the snapshot travels afterwards:

    confirmedAt (local, real time)  >  openedAt (server, real time)

so a reveal issued at `confirmedAt + durationMs` reaches the server strictly after
`openedAt + durationMs` — **whatever the latency and whatever the skew. Neither
appears in the arithmetic.** The 100ms of slack guards `Date.now()` going backwards
under an NTP correction and nothing else; a test pins that it is still correct at
zero, so nobody fixes a refusal by growing it. It costs about 80ms — the round trip
the old anchor was stealing.

### Measured after

Two questions in a live browser round, 15-second window, nothing pressed:

| | |
|---|---|
| clock hits zero | button reads **Revealing…** |
| reveal lands | **+478ms**, **+561ms** |
| answer on screen | **+1.2s** |
| error notices raised | none |

`npm run check-rules` still refuses a reveal inside the window, and still allows
one after it — 36 of 36, both directions.

### What is still in the gap, and is not a bug

`resolveAnswer` fires four candidates and three are refused every time by design:
236–289ms against 34–48ms for one clean write, because each denial disrupts the
write stream — and it costs the room update after it about double. The replay hold
is up to **1820ms** (`REPLAY_SHAPE`), 700ms when nobody answered. That is the
largest single component of the gap, and it is deliberate showmanship rather than
latency: trimming it is a product decision, and `spreadMs` is the number.

---
