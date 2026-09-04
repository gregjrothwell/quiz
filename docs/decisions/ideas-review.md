# The ideas review

> **Owner: Greg Rothwell. Last updated: 28 August 2026. Budget: 250 lines.**

Written after the office's first real round on the season work: what to do next, why, and what
each costs against the Spark free tier.

**The closed half lives in [`scope.md`](scope.md)** — the directional decisions taken, what was
deliberately not built, and what the Spark tier allows. Read that before proposing something
that was already turned down. This file is the open half.

**§4 and the picture-round bullet were re-costed on 4 September**, alongside two ideas that
were not here at all — stealing points and a jigsaw round — plus the decision to allow negative
points. All four in [`round-types.md`](round-types.md); the melody round's licensing in
particular is far less restrictive than §4 assumed.

> **It said "nothing here is built" until 28 August 2026.** Five of these have now shipped, and
> they are marked where they stand rather than deleted — an idea's costing is worth keeping once
> you can check it against what the thing actually took. **Shipped: rank scoring and the PNG card
> (20 August); the shared clock, question voting and auto-join from the link (28 August).**

The finding it starts from: three weeks produced a sealed vault, App Check on three products,
durable identity, weekly boards, awards, a synth soundtrack, 412 tests and 3,100 lines of
docs — against **21 season players, 0 recovery codes, 0 identity claims** and five
verifications that have never met a second human. The machinery is far ahead of the playing.

## The event's actual problems

Before any new feature; both are evidenced.

### The shared clock — it took answers off people. **Shipped 28 August 2026**

On 17 August a player's window opened about five seconds late and **he could not answer at
all**. Filed as an audio nuisance for weeks before being reclassified. This was called "the
highest value of anything in this file" and that was right. [`shared-clock.md`](shared-clock.md).

### Nothing needing a second person has been tested

**Four of the five still stand**: the review panel, squad-vs-squad, a quizmaster handover, and a
recovery code moving between browsers. ~~Keyboard shortcuts~~ cleared 28 August, answering with
`a` and `c` in a live round. A fifth has been added by shipping rank scoring: **nobody has seen
the rank bonus award an order**, because that needs two correct answers in one room and every
round so far has had one answerer.

## The ideas

Ranked by value ÷ cost, in Firestore ops per game unless stated. Reference is
[`cost.md`](cost.md): `reads ≈ Q·N² + 3·Q·N`, against 50k reads and 20k writes a day.

### 1. Rank-based scoring — **shipped 20 August 2026**

500 for correct plus 500/400/300/200/100 by the order they landed, replacing a speed curve on
which anybody who simply knew it scored 950–985. [`scoring.md`](scoring.md).

**What it left behind:** a faked `elapsedMs` bought ~5 points under the old curve and buys 100
under this one, which promotes §5 from nice-to-have to the companion change this never got.

### 2. Live squad scoring — **built 28 August 2026, rules paste outstanding**

Hermes against Bundae under the standings, so the round has a second story in it. Zero Firebase
cost — the scores are already in the room.

**Ranked on points ÷ headcount, not the total.** Built on the total first and rejected on
sight: a raw sum means the bigger squad wins by turning up, and the sides are never even.

The Lurker split was the trap this flagged and it held: `sideFor` is now **one** function,
shared with `weekSquad`, because the running total becomes the weekly bucket an hour later.
[`live-squads.md`](live-squads.md).

**This one takes the game down if it deploys before the paste** — `playerOk` uses `hasOnly`, so
a join carrying `squad` against the old ruleset is refused and nobody can join at all. Harder
than the vault or the vote, where a refusal cost one feature.

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
not an answer, and the vault resolves it like any other question.

**Its blocker is gone.** `clockVoices` runs a nine-second bed under every question and devices
used to phase against each other, which a melody would make audible in a way a tick never was.
That was "it wants the shared clock first"; the shared clock shipped on 28 August, so this is
now unblocked and is the cheapest genuinely *new* thing on the list.

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

### 6. Let the office rate its own questions — **half shipped 28 August 2026**

This was one idea and turned out to be two, which the office's feedback separated for us:
**quality** and **difficulty**. An unfair question is not a hard one, and only the first is
worth deleting.

**Shipped — the vote.** Good or Rubbish at the reveal, one write per player per question, no
reads. `fold-votes` turns the verdicts into a retirement list.
[`question-votes.md`](question-votes.md).

**Not shipped — the counters.** One write per question per game of `stats/{questionId}` =
`{asked, correct}`, folded at build time into a real `difficulty`. Fifteen writes a game, zero
runtime reads, same build-time shape as classification.

**The leak to avoid, and it is not obvious:** bank `asked` and `correct` only. A per-option
breakdown makes the modal answer guessable, handing back exactly what the vault protects. Two
integers leak nothing. (The vote document follows the same rule and carries no option index.)

After a season this gives ratings calibrated to *this office*, against OpenTDB's measured 39%
agreement with a UK-office judgement. It is the only thing that would revive `easy` and `hard`,
which today ship a promise the corpus cannot keep — every imported question is marked `medium`,
so a hard Sport round draws on fifteen. **Until it exists, those two levels are honestly
deletable.**

Start the writes early — the data only accumulates if you are collecting it, and the votes have
a two-week head start already.

### 7. The final card as a PNG — **shipped 20 August 2026**

The round leaves the tab as an image. [`final-card.md`](final-card.md).

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

### 10. A reload should not throw you out of the room — **shipped 28 August 2026**

The only bug on this list, and it went out the same day it was written down. The room code
lives in `sessionStorage` beside the game log; leaving clears it.
[`joining.md`](joining.md).

### 11. Pick the retirement thresholds from real data

Not a feature, a follow-up with a deadline attached. `shouldRetire` is 5 votes and 60% bad, and
**those numbers have never met a real round.** `fold-votes` already prints what six thresholds
would retire, so this costs one command once there are votes — but it wants doing before the
first `--go`, because a retirement is permanent and nothing surfaces it again.

### 12. A tally on the vote

Show the room how it voted, rather than only your own verdict. Deliberately left out of v1 to
keep the write path free of reads, and the way back in is cheap: one `getCountFromServer` per
question — the aggregate trick [`vault.md`](vault.md#checking-the-vault-without-paying-for-it)
already documents — plus a `list` grant on `questionVotes`, which is one paste.

**Worth thinking about before building**, though: a visible tally turns a private opinion into a
public one, and the reason Skip is not exposed is that one player should not be able to turn the
room against a question. A count that appears before everyone has voted does some of that.

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

## The order, rewritten 28 August 2026

The first three of the old order are done. What is left re-ranks around one fact: **the app is
now ahead of the evidence again.** Three things shipped this week and only one of them has been
seen by more than one person at once.

**Do first, and none of it is a feature:**

1. **A real round with the office on it.** Voting, auto-join and the shared clock are all live
   and none has met a full room. It also clears four of the five two-person gaps and the rank
   bonus at the same time, for no code.
2. **Thresholds from real votes** (§11) — one command, but it must happen before the first
   `--go`, because retirement is permanent.
3. ~~**The reload bug** (§10)~~ — **done 28 August**, the same day it was written down.

**Then, in the order the office is likely to notice:**

4. ~~**Live squad scoring** (§2)~~ — **built 28 August**, waiting on its paste.
5. **`stats/{questionId}` writes** (§6) — start collecting now; it is worthless until it has a
   season behind it, which is an argument for doing it early rather than late.
6. **Bound `elapsedMs` server-side** (§5) — promoted by rank scoring, which took the value of a
   faked time from ~5 points to 100. Wants `sync-harness` numbers first, and now has them.
7. **A melody round** (§4) — unblocked by the shared clock, and the cheapest genuinely new
   thing here.

**Then §3, §8, §9 and §12 in whatever order the office asks for.** §8 is worth a mention every
time this list is read: **still 0 recovery codes and 0 identity claims**, because nothing has
ever asked anybody to save one, and one line on the final screen is the whole feature.

Evidence: `check-rules` in both directions after every paste — and note that **its deny cases
pass vacuously when a rule is missing entirely**, which is how a paste can look verified when it
has not happened; `sync-harness 10` before and after anything touching timing or the answer
write; `reveal-probe` after anything touching the gate; `take-stock` around anything that adds
writes. **Not covered by any of it:** the pre-warmed decoy room
([`vault.md`](vault.md#what-it-does-not-stop)), or the fact that the questions come from a
public corpus.
