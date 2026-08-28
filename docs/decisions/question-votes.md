# Voting on questions

> **Owner: Greg Rothwell. Last updated: 28 August 2026. Budget: 250 lines.**

Split out of [`questions.md`](questions.md) on 28 August 2026, which reached 259
lines against a 250 budget when this was added to it. The text is unchanged;
only where it lives is. That file is the harvest pipeline, this one is what the
office does to it afterwards — they meet at `public/packs/` and nowhere else.

The section above costed two ways out of the difficulty problem and queued
neither. This is a different problem with the same cause: **nothing has ever let
a player say a question was rubbish.** Difficulty and quality are not the same
thing — an unfair question is not a hard one — and only the second is worth
removing from the corpus.

There is a live precedent for the shape. Skip is deliberately *not* exposed in
`QuestionScreen`: the rules cannot restrict a write to the quizmaster without
storing their uid, so a Skip button is a button anyone with the console open can
press, and one player who dislikes a question must not be able to void it for
the room. **A vote is the safe half of that.** It changes nothing about the
round being played and everything about what the packs serve next month.

## Where a verdict goes, and why not in the room

`questionVotes/{questionId}/votes/{uid}` — global, not a room subcollection.
Three reasons, all specific to this project:

- **It costs no reads.** An in-room collection needs an `onSnapshot` per client,
  which is another `Q·N²` term on [`cost.md`](cost.md) — about +540 reads a game
  at six players, +2,700 at twelve — to show a tally nobody asked for. This path
  is written and never read by a client.
- **It outlives the room.** `prune-rooms` deletes rooms and their
  subcollections. Votes banked inside one would be deleted by the tool whose
  whole job is deleting rooms.
- **It is deduplicated by construction.** The document id is the uid, so one
  person's opinion counts once however often they meet the question. Stated
  rather than hidden: voting from two browsers counts twice, because keying on
  `playerIdFor(uid)` would cost an `ownsPlayer` read per vote.

The document is **one field**, `good` or `bad`. No option index, no room code,
no timestamp — the same discipline the difficulty counters are designed to,
where a per-option breakdown would make the modal answer guessable and hand back
exactly what the vault protects. A verdict is written after the reveal and says
nothing about the answer.

**Cost:** one write per player per question — 90 a game at six players, against
20,000 a day. No reads at all.

## What retires a question, and where that is recorded

`shouldRetire` in `src/engine/questionVote.ts`: **at least 5 verdicts and at
least 60% of them bad**. It lives in the engine so `npm test` covers it, the
reasoning that pulled out `liveAnswers` — this is the rule deciding what leaves
the corpus permanently, and a second copy would not look like a bug when it
drifted.

The floor is the only thing blunting a single loud voter. The vote is
self-reported like every other value in this game, and one document per uid
means the cheapest attack is a second browser; a unanimous four is what one
determined person looks like. `npm run fold-votes` prints what six different
thresholds *would* retire before anything is written, so the numbers get chosen
against the office's real voting rather than against this paragraph.

> **The trap, and it is not obvious.** Deleting a question from
> `public/packs/*.json` does not retire it. `npm run fetch-questions -- --resort`
> rebuilds every pack from `.cache/`, so the next re-sort puts it straight back
> with nothing to say it had ever gone. **The blocklist is the record and the
> pack is downstream of it**: `--go` writes `src/questions/retired.json`, and
> `writePacks` filters against it before sorting. `seal.test.ts` checks that no
> retired id is still in a pack, which is vacuous today and starts meaning
> something the moment the first fold runs.

Vault entries for retired questions are left alone — a vault holding answers to
questions no pack serves is inert.

## Not covered

Nothing stops somebody voting `bad` from the console fifteen times under
different uids, and the five-vote floor is the only thing blunting it. And the
thresholds will not have been tested against real data until a round has been
played and voted on.

