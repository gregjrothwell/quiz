# The ideas review

> **Owner: Greg Rothwell. Last updated: 20 August 2026. Budget: 250 lines.**

Written after the office's first real round on the season work. **Nothing here is built** —
this is what to do next, why, and what each idea costs against the Spark free tier.

The finding it starts from: three weeks produced a sealed vault, App Check on three products,
durable identity, weekly boards, awards, a synth soundtrack, 412 tests and 3,100 lines of
docs — against **21 season players, 0 recovery codes, 0 identity claims** and five
verifications that have never met a second human. The machinery is far ahead of the playing.

## Three decisions taken, 20 August 2026

| Decision | What it changes |
|---|---|
| **The quiz stays an event.** Not a habit | Async, hostless play is rejected. Effort goes into the live round |
| **Ruleset pastes are no longer a big deal.** Greg: *"We can do them as needed"* | A paste per feature, when that feature needs it. **No speculative forward-bound fields**, so no risk of a bound field being erased by `set()` before its client exists |
| **Rank-based scoring, to try** | The speed curve came from Polly and had never been questioned |

**The second overturns an assumption this repo is built on.** Several places design around
*"a hand-pasted ruleset has broken this game twice"* — [`season.md`](season.md#why-none-of-it-needed-the-console),
[`identity.md`](identity.md#the-publish-order-kept-because-it-will-matter-again), and
`firestore.rules:479`, where `team` was bounded a fortnight ahead of its client precisely to
avoid one. That reasoning is **relaxed, not wrong**: a paste still goes out in the right order
and is verified in both directions. It just no longer bends designs around itself.

## The event's actual problems

Before any new feature; both are evidenced.

### The shared clock — it takes answers off people

[`clock.md`](clock.md#what-would-actually-fix-it) has the design written out and marked **not
started**. On 17 August a player's window opened about five seconds late, the reveal killed
his lecterns while his own face still read five seconds, and **he could not answer at all**.
It was filed as an audio nuisance for weeks before being reclassified.

The route is worked out: each client records `Date.now() - openedAt` when a question opens,
and the **minimum across a round** approximates its own pure clock skew, because delivery
latency is never negative. Subtract it and every screen shows the room's remaining time
rather than its own. `openedAt` is a `serverTimestamp()`, so this does not fold the
quizmaster's clock into anybody's score — the objection that rules out a naive shared clock.
`questionConfirmedAt` (`useRoom.ts:74`) already exists for the gate and gives half of it free.

**Zero Firebase cost, and the highest value of anything in this file.** It is also the most
safety-critical code in the app and it fails quietly, so it is its own piece of work with its
own evidence: `sync-harness 10` reports the delivery spread the design rests on.

### Nothing needing a second person has been tested

The review panel, squad-vs-squad, quizmaster handover, keyboard shortcuts in a live round, a
recovery code moving between browsers. `npm run host-room -- 10` works again as of 20 August;
that plus one browser clears three of the five in an evening, with no code written.

## The ideas

Ranked by value ÷ cost, in Firestore ops per game unless stated. Reference is
[`cost.md`](cost.md): `reads ≈ Q·N² + 3·Q·N`, against 50k reads and 20k writes a day.

### 1. Rank-based scoring — chosen

`scoreAnswer` is 500 base plus up to 500 decaying linearly across the window
(`src/engine/scoring.ts:21`). Against this project's own measurements, human reaction plus
render plus network is ~300–400ms — so on a ten-second window **anybody who simply knows it
scores 960–990**, and one second versus two is 50 points out of 1,000. The speed bonus is a
rounding error dressed as drama, and nobody has ever scored 1,000 or ever will.

**The shape:** 500 for a correct answer, plus 500/400/300/200/100 by the order the correct
answers landed, floored at 100. Four things to get right, all in `scoring.ts`, all testable:

- **Ties share a rank and the next resumes at the count awarded** — the convention
  `standings()` already uses (`scoring.ts:118`), so the game has one tie rule, not two.
- **Max per question stays 1,000**, so `maxBest()` and `best <= points` are untouched. **No
  paste needed.**
- **It raises the value of cheating.** A faked `elapsedMs` bought ~5 points under the old
  curve and buys 100 under this one, which promotes §5 to a companion change.
- **Check `awards.ts`.** `fastest` is computed independently, and "fastest finger" meaning
  something different from "took the speed bonus" is the game contradicting itself on one
  screen.

Zero cost. Pure engine, fully reversible.

### 2. Live squad scoring

Squads do **nothing** until the board after the game. Show Hermes against Bundae as a running
aggregate on the standings screen and the round has a second story in it — the whole point of
having squads, and the sort of thing only a live event can have.

**Zero Firebase cost**; the scores are already in the room. Needs `squad` on the player entry,
`playerOk`-bounded (`firestore.rules:150`) — one paste. **Watch the Lurker split**
([`season.md`](season.md#the-lurker-split-which-is-the-only-clever-part)): a Lurker sits with
a squad for the night, held in *session* storage, so the live board follows who they sat with
rather than their season record — the rule the weekly bucket already uses.

### 3. The wager

One question — the last — where you stake a share of your points. The cheapest way to make
the bottom of the table mathematically alive at question fifteen, and the app already has the
theatre to carry it: `REPLAY_SHAPE`, the chair, the frozen podium. A `wager` field on the
answer document, bounded in a paste; pure engine otherwise.

**Counter-argument, honestly:** it can feel arbitrary — a good round lost on one question. So
make it opt-in per round from the lobby, exactly as the window is.

### 4. A melody round

`src/lib/sound.ts` is a real synth: `Voice[]` of oscillator type, frequency, envelope and
filter — 492 lines, 0.9 kB shipped, no audio files. A "name that tune" round is **sequences
of `Voice`**: public-domain melodies, anthems, nursery rhymes, out-of-copyright themes.

**Zero bytes, zero licence risk, zero bandwidth, zero Firebase** — a whole new round type
built out of something already in the bundle. The seal is unaffected: a melody in a pack is
not an answer, and the vault resolves it like any other question. **The real risk:**
`clockVoices` runs a nine-second bed under every question and devices
[phase against each other](state-of-play.md#known-limits), which a melody makes audible in a
way a tick never was. It wants the shared clock first.

### 5. Bound `elapsedMs` server-side

`firestore.rules:291` says elapsed time "cannot be checked here". **Not quite true.** The
write's arrival is a server-provable lower bound on real elapsed time:

```
elapsedMs >= (request.time - openedAt) - grace
```

You cannot claim to have answered much faster than your write actually landed. With a
three-second grace it kills "claimed 3ms at the nine-second mark" and leaves honest slow
networks alone.

**Cost:** one rule `get()` on the room per answer write — ~90 reads a game against 50,000.
The answers rule avoids a `get()` today, but that reasoning is about the *read* rule, which is
evaluated per snapshot per listener; a write rule is one `get()` per write.

**The honest risk, and why this is not automatic:** a flaky client answers at 100ms, its
write lands four seconds later, and is refused — worse than the cheat it prevents. The grace
must be generous, and it must be measured against `sync-harness` first, which is the only
tool reporting the delivery spread it depends on.

### 6. Empirical difficulty — let the office rate its own questions

[`questions.md`](questions.md#the-difficulty-rating-that-is-not-there) costed two ways out of
the difficulty problem — hand-rating, or a build-time LLM pass — and queued neither. There is
a third that is free and better than both: **play already generates the ground truth.**
One write per question per game to `stats/{questionId}` = `{asked, correct}` — fifteen writes
a game — and a build-time script with the service account folds them back into
`public/packs/*.json` as a real `difficulty`. Same shape as classification: build-time, out
of `src/`, out of `npm test`. **Runtime read cost is zero**, since the packs are static.

**The leak to avoid, and it is not obvious:** bank `asked` and `correct` only. A per-option
breakdown makes the modal answer guessable, handing back exactly what the vault protects.
Two integers leak nothing.

After a season this gives ratings calibrated to *this office*, against OpenTDB's measured 39%
agreement with a UK-office judgement. It is also the only thing that would revive `easy` and
`hard`, which today ship a promise the corpus cannot keep — every imported question is marked
`medium`, so a hard Sport round draws on fifteen. **Until this exists, those two levels are
honestly deletable.** Same data, free: a question three quizmasters have skipped is a bad
question, and `skipped` is already on the room, so the corpus can clean itself.

Start the writes early — the data only accumulates if you are collecting it.

### 7. The final card as a PNG

Canvas-render the final standings as an image to paste into Teams. Zero backend, zero
Firebase, one browser API. Right now the quiz ends and **nothing leaves the tab** — and for
an event, the artefact is what advertises next week to whoever missed this one.

### 8. Ask for the recovery code

Zero codes and zero claims, because nothing has ever asked anyone to save one. One line on
the final screen the first time somebody wins. That is the feature's missing 10%. Fix the
untested gap while you are there:
[`identity.md`](identity.md#a-recovery-code-would-not-fully-save-them-either) reasons that a
purged account with a stored code fails both `ownsPlayer` branches with nothing prompting a
re-claim.

### 9. Rank on form, not on average

[`season.md`](season.md#things-that-will-bite) already names the complaint: points ÷ played
means **the people who turn up most lose** — Joe 8th → 1st, Rach 2nd → 10th on the live rows.
Best four of the last six rounds, golf's dropped scores, rewards turning up without punishing
one bad night. Needs a `recent` array on the season row (one paste); the arithmetic is pure
and belongs beside `bankGame` in `records.ts`. **It also fixes a quieter bug**: `loadTable`
asks for the top fifty *by points* and re-sorts by average in the client, so past fifty rows
the tail of the average board is silently wrong. A stored form figure could be ordered
server-side. Twenty-one rows today, so not urgent — but it is why this is worth more than it
looks.

## Crazy, and mostly cheap

- **The corridor screen.** A telly showing the board and the countdown to Thursday — for an
  event, that is the poster. **Costed, and it is the one shape that breaks a Spark budget:**
  the board is fifty documents, so a one-minute refresh is 72,000 reads a day — over the
  limit, from a screen nobody is watching. **Mirror the top ten into the Realtime Database
  instead**: billed on bytes and pushed rather than polled, so it is one connection held
  forever and effectively free. That inverts the usual advice here, hence writing it down.
- **Ghost racing.** Replay last week's round against a recording of how the room answered it.
  `useGameLog` already assembles that shape in memory for the awards; persist one game's log
  and the replay becomes an opponent latecomers can play against.
- **A picture round** costs Firebase nothing — images are static on Pages, so the limit to
  check is Pages' bandwidth allowance, not Firebase's.
- **A Teams webhook the quizmaster supplies.** The URL **must not be in the bundle** — Pages
  is public and a leaked webhook is a spammable channel — so it is pasted into localStorage,
  as the App Check debug token is.

## Rejected

- **The Daily Five.** An async, hostless five-question round on a date-seeded question set,
  banked into a daily bucket. Buildable with **no rules change at all**: `selectQuestions`
  takes an injectable `Rng`, `seasons/{season}` takes an unconstrained wildcard so
  `day-2026-08-20` is a free bucket exactly as `week-2026-W34` is, and `lastGame` already
  guards a second attempt. ~35 reads and ~35 writes per player per day; twenty people is
  ~1.4% of the read budget. **Rejected 20 August 2026 — the quiz is an event, not a habit.**
  Recorded because it is cheap enough to revisit if the event stops filling.
- **Auto-advance.** Existed mainly to serve the above. The derived quizmaster already covers a
  host wandering off, and [`form-and-awards.md`](form-and-awards.md#the-quizmaster-starts-the-round-and-nothing-else-does)
  records losing the start to a `setTimeout` and deliberately taking it back.
- **Chat, accounts, a native app, anything with a server.** Each trades away the constraint
  that has made this design good.

## Spark

**Nothing above needs Blaze.** Reads were never the binding constraint — the ceiling is the
Realtime Database's **100 simultaneous connections, project-wide**, about sixteen concurrent
six-player rooms. Staying an event keeps every idea here well inside it. Two things would
change that: sustained concurrency past 100, which one office cannot reach; and a Firestore
TTL policy, which needs billing and which `prune-rooms` already beats by reaching the
subcollections a TTL sweep orphans ([`cost.md`](cost.md#the-two-slow-leaks)).

**Google's pricing is not stated here from memory.** If Blaze is ever considered, check the
calculator and set a budget alert the same day. The one thing it buys that Spark cannot fake
is a Cloud Function holding the answers server-side, ending self-reported `elapsedMs`
outright — and §5 gets most of that for one rule `get()`, so it is not a reason to move.

## The order

1. **An evening with `host-room` and a browser.** Three untested paths, no code.
2. **The shared clock.** The only thing here currently taking answers off a real person.
3. **Rank-based scoring** (§1) — chosen, free, and what the office notices first.
4. **`stats/{questionId}` writes** (§6) — one paste, fifteen writes a game, start collecting.
5. **Live squad scoring** (§2) and **the PNG card** (§7). Then §3, §4, §5 and §9, in
   whatever order the office asks for.

Evidence: `check-rules` in both directions after every paste; `sync-harness 10` before and
after anything touching timing or the answer write; `reveal-probe` after anything touching
the gate; `take-stock` around anything that adds writes. **Not covered by any of it:** the
pre-warmed decoy room ([`vault.md`](vault.md#what-it-does-not-stop)), or the fact that the
questions come from a public corpus.
