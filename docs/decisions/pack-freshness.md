# Pack freshness — knowing before a round is all repeats

> **Owner: Greg Rothwell. Last updated: 5 October 2026. Budget: 250 lines.**

**Greg, 5 October 2026:** "we need a regular check for if question packs are
exhausted to keep them fresh." On that day Catchphrase (30 of 30 asked) and
Sleeves (105 of 104) were both spent, and nothing had said so: Sleeves had
simply stopped being picked after 30 September.

## What is already there

- `seasons/{season}/asked/{packId}`: the ids each pack has served this season,
  read and merged when a round starts. It is capped at 500 (`ASKED_LIMIT`) and
  resets with the season.
- `npm run asked-probe` prints those counts, but **not the pack sizes beside
  them**, so "30 ids" reads the same for a pack of 30 as for one of 1,500.
- `npm run read-games` shows the last rounds by pack and length.
- The office plays about **two rounds a working day**, mostly around 08:50 and
  14:00–15:00, at 10–25 questions.

## The story — for Greg to approve

> As Greg, I want to be told when a pack the office plays is running out of
> unseen questions, so I can grow it before a round turns into repeats.

1. **`npm run freshness`** prints, per pack: its size, the ids asked this
   season, how many are unseen, and **fresh rounds left** (unseen divided by the
   median length of that pack's recent rounds, or 15). It also shows the rounds
   played in the last 14 days. It is read-only, through the Admin SDK, at about
   30 reads.
2. **Low** means a pack played in the last 14 days has fewer than **two fresh
   rounds** left. Packs nobody plays are listed but never flagged, as the
   growth rule says.
3. **It runs on its own every weekday at 08:30 on this Mac**, before the
   morning round, through a launchd agent; a missed run happens on wake. **If
   anything is low, a macOS notification** names the packs. Nothing is shown
   when all is well. The full table goes to `.cache/freshness-latest.txt`.
   *This is a standing job on Greg's Mac, so it needs his explicit yes.*
4. **Proved both ways:** a run with the threshold forced above a pack's count
   notifies and names it; a normal run with nothing low stays silent.
5. No change to the app, the rules or the season documents.

**Not in v1:** telling the quizmaster in the app ("about one fresh round of
Sleeves left") at the end of a round. That costs nothing in reads, because the
asked list is already in hand at the start of a round, but it is a client change
and reaches whoever hosts, not necessarily Greg. A good second step.
