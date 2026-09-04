# New round types, and what actually blocks them

> **Owner: Greg Rothwell. Last updated: 4 September 2026. Budget: 250 lines.**

Four ideas raised on 4 September — **stealing points, picture rounds, music
rounds, jigsaw rounds** — costed against the database, plus the **negative
points** decision that came out of the same conversation.

**The headline: none of the four is limited by the database.** All four add zero
reads and zero writes per game, and three need no ruleset paste at all, because
`wellFormed()` bounds `questions.size()` and never inspects a question object's
keys (`firestore.rules:242`). That is the same reason `expiresAt` and
`wagerEnabled` both landed paste-free. What blocks each one is somewhere else,
and naming it is the point of this file.

[`ideas-review.md`](ideas-review.md) is the ranked backlog; [`scope.md`](scope.md)
is what was already turned down. This is the costing for these four.

## Steal points

| | |
|---|---|
| Firebase | **0 reads, 0 writes**, either shape |
| Ruleset | none (auto-target) · one paste (targeted) |
| Blocked by | game design, not cost |

Two shapes:

- **Auto-target.** A correct answer takes a share from whoever leads. Pure
  engine — `tallyQuestion` already receives `scores` on wager questions
  (`scoring.ts:114`), and the same channel carries this. No new field, no paste.
- **Targeted.** `steal: <uid>` rides the answer document exactly as `wager` does.
  One paste: `'steal'` into the `hasOnly` list at `firestore.rules:317`,
  `is string`, `size() <= 128`. Two of the wager's five silent-swallow traps then
  recur verbatim — `liveAnswers` rebuilds each answer field by field
  (`answers.ts:28`) and the keyboard path passes its own arguments
  (`QuestionScreen.tsx:245`).

**The blocker is that picking a target costs seconds, and the rank bonus pays 100
points for being first.** A target picker competes head-on with the mechanic that
makes the round exciting. Auto-targeting sidesteps it and is the cheaper build.

**Make it a share of the victim's points, not a number**, for the reason
[`wager.md`](wager.md) gives: you cannot take what somebody does not have, so no
clamp is needed anywhere.

## Picture round

| | |
|---|---|
| Firebase | **0** |
| Pages | ~30 MB a round (10 players × 15 images × 200 kB) against a **100 GB/month** soft limit and a **1 GB** site cap — checked against GitHub's published limits, not recalled |
| Ruleset | **none** — question keys are not inspected |
| Blocked by | sourcing and licensing |

Three things to get right, none of them cost:

1. **The filename is a new seal leak.** `eiffel-tower.jpg` appears in the room
   document and in the DOM. Content-hash the filenames at harvest.
2. **The seal test forbids keys matching `/correct|answer|incorrect|solution/i`
   at any depth** (`seal.test.ts:43`). `image` passes; `answerImage` fails.
3. **A new pack touches three places** — the `PACK_IDS` union and `PACK_META`
   (`types.ts:21`), and the hardcoded `expect(packFiles.length).toBe(10)` at
   `seal.test.ts:69`.

**The real cost is not code.** No CC BY-SA corpus of four-option picture questions
exists; the text packs are ~1,500 questions each and a picture pack is hand-built.
Wikimedia Commons is the realistic source, and per-image attribution is a licence
obligation, so it needs UI. A flags or landmarks pack of ~100 public-domain
images is the honest first version.

## Music round

Two different ideas wearing one name.

- **A melody round — recommended.** `src/lib/sound.ts` is a real synth: 493
  lines, 0.9 kB shipped, no audio assets. Melodies as `Voice[]` sequences cost
  **zero bytes, zero bandwidth, zero Firebase**. The answer stays one of four
  option strings, so the vault is untouched.
- **Recorded clips — ruled out.** Copyright in the recording, on a public repo,
  with the files served from Pages.

### The licensing, which is much less restrictive than it first looks

An earlier draft of this said "pre-1900" and that was wrong. Checked against
gov.uk rather than stated from memory: **UK copyright in a musical work runs for
the life of the composer plus 70 years.** The separate 70-years-from-publication
term covers *sound recordings*. Two consequences:

- **A synth rendition is a new performance, so the recording term never
  applies.** Only the composition matters — "no recorded clips" is not a
  restriction on this round at all.
- **The test is per-tune, not per-era: did the composer die before 1956, or is
  the tune traditional?** That is a large and recognisable pool — Gershwin
  (d. 1937), Elgar (d. 1934), Holst (d. 1934), Joplin (d. 1917), Sousa (d. 1932,
  and so the Monty Python theme), Ravel (d. 1937) — plus the whole folk, carol
  and nursery-rhyme canon, and modern exceptions like *Happy Birthday*, released
  into the public domain in 2016. **The pack build checks each tune against that
  test**, rather than against a cutoff year somebody picked.

### Three blockers, none of them the database

1. **`clockVoices` runs a nine-second bed under every question**
   (`sound.ts:232`). A melody plays over the top of it, so it has to be muted on
   melody questions.
2. **Audio needs a user gesture to unlock, and the sound preference lives in
   localStorage.** A muted player cannot play this round at all — the lobby has
   to force the issue rather than let somebody sit through fifteen silent
   questions.
3. Melodies are hand-encoded note sequences. Cheap per tune, but content work.

The only missing code is a public `playSequence(voices: Voice[])`. `startClock`
(`sound.ts:386`) is the template — it already schedules an arbitrary array
through its own `GainNode` and can cancel it.

## Jigsaw / scramble round

**Strictly downstream of the picture round** — same images, different
presentation, nothing extra in the database.

The risk is not cost: **the scramble must be identical on every device**, or
players see different puzzles and the rank bonus is unfair. Seed it from
`question.id` + `gameId`, both of which every client already holds;
`selectQuestions` already takes an injectable `Rng` (`state.ts:401`), so the
pattern exists.

The good version is a **progressive** unscramble driven by the shared clock —
tiles settle as the window runs, so answering early is worth more. That fits rank
scoring better than anything else here, and the shared clock that makes it
possible only shipped on 28 August.

**Do not let it become a drag-the-pieces puzzle.** The vault compares one string
against one option string (`vault.ts:65`, `firestore.rules:388`). An ordering
answer has no path through the reveal without a new rule *and* a new vault
document shape.

## Negative points — decided 4 September 2026

**Greg's call: yes, including the season row.** Specified here; not built.

- **The board needs nothing.** Room `scores` are already unbounded server-side —
  `wellFormed()` checks only the map's size (`firestore.rules:247`).
  `ScoreTicker` renders a negative correctly, and the reducer accumulates without
  a clamp (`reducer.ts:293`).
- **The season row is the whole constraint.** Two lines go: `points >= 0`
  (`firestore.rules:527`) and `best <= points` (`:532`) — the second becomes
  wrong once negatives exist, since one good night and three bad ones puts `best`
  above the total. **`points` still needs a lower bound**, or a crafted client can
  write any negative it likes: replace it with `points >= -maxPoints()`.
  `best >= 0` stays — `best` is a maximum taken against a zero floor
  (`records.ts:142`).
- **Paste first, deploy second.** `bankGame` has no clamp, so no client change is
  needed — which means a deploy *before* the paste silently refuses every
  negative row and loses somebody's night.
- **Nothing produces a negative yet.** A share-based stake floors at exactly
  zero. Two routes out:
  - **A minimum stake** on the wager question:
    `max(round(score × share / 100), MIN_STAKE)`. **No ruleset paste at all** —
    the wire field is a share and the engine decides what it is worth
    (`stakeFor`, `scoring.ts:63`).
  - **A wrong-answer penalty** on every question. Good arithmetic — guessing
    costs something — but it makes silence a strategy, which is bad theatre for
    an office round.

> ### Correction — negative points do not fix the chair, and the data says so
>
> This section first claimed a minimum stake "targets the case the live rounds
> actually show". **It does not, and the mistake was reasoning instead of
> looking.** XS4A's last question, read off the room:
>
> | | stake | answer | final |
> |---|---|---|---|
> | Not Bret | 100% | right | 22,800 |
> | Greg | 100% | right | 14,100 |
> | Amier | 100% | wrong | **0** |
> | Alistair | 100% | wrong | **0** |
>
> Amier and Alistair did not lose a fortune on the last question. **They arrived
> at it already on zero**, and 100% of nothing is nothing — the known limit
> [`wager.md`](wager.md) already records. They tie at the bottom because they
> scored nothing across twenty-five questions, and two people who scored nothing
> are genuinely level.
>
> So a minimum stake gives a player on zero something to lose, which is worth
> having on its own terms. **It does not break this tie** — it moves both of them
> to the same negative number. Nothing does, because the tie is real.
>
> **The chair was the right fix, and it is the whole fix.** Negative points are a
> separate improvement to the wager, wanted for their own reasons rather than for
> the bottom of the table. Ranked below accordingly.
- **Knock-on:** the average table is `points ÷ played` ([`season.md`](season.md)),
  so a negative average becomes reachable. `loadTable` orders by points
  server-side, so the ordering itself still works.

## The order

1. ~~**The chair seats everybody**~~ — **done 4 September**, and the reason this
   file exists. [`TOTAL-RECALL.md`](../TOTAL-RECALL.md).
2. **`take-stock` should report recent rounds.** Not a feature — it is what stops
   the next session getting the state wrong, as this one did. See below.
3. **Steal, auto-targeted.** The wager is proven — and XS4A shows what it does
   and does not reach: it swung the top by 22,800, and could not touch the two
   players who had nothing to stake. A steal pays the answerer out of the
   leader, so it reaches exactly the people a share-based stake cannot.
4. **The negatives paste + a minimum stake.** Demoted by the correction above —
   it makes the wager reach a player on zero, which is worth doing, but it does
   not fix the bottom of the table. Its own PR, because of the paste ordering.
5. **A melody round.**
6. **A picture round**, then **jigsaw** on top of it.

## The prose was wrong, and that is a finding

This assessment began by repeating `HANDOVER.md`'s claim that the wager and the
rank bonus had never been played. **Both were false**, and the live project said
so in one query:

| Room | Players | Qs | Wager | Notable |
|---|---|---|---|---|
| `FWAP` | 9 | 15 | on | 14,475 — `stakeFor` is the only thing that makes a score that is not a multiple of 100 |
| `XS4A` | 6 | 25 | on | **three zeros in the scores map**, two still in the room; and 8,025 |
| `K8BD` | 5 | 15 | on | one on zero |
| `YS8F` | 6 | 20 | off | two on zero — ties at the bottom predate the wager |
| `FUWH` | 8 | 15 | off | 6,100 / 3,700 / 5,600 — a total ending in anything but `000` needs a rank bonus below first |

**The fix is a command, not a discipline.** `take-stock` already reads the live
project and reports rooms, vault answers, season buckets, codes and claims — it
just never says *what was played*. Ten document reads would add the last ten
rounds with their pack, headcount, question count, wager flag and whether the
bottom was tied. Every claim this session got wrong would have been caught by it.
