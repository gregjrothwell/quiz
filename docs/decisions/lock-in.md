# Lock it in — a pick is free, a lock is final

> **Owner: Greg Rothwell. Last updated: 29 October 2026. Budget: 250 lines.**

**Status: built 29 October 2026, not live.** PROJ-78. Greg, that evening:
"lock in enter key?", then "continue" on the four design points below.

`firstMs` exposed snap guessing ([`first-touch.md`](first-touch.md)) and did not
stop it: in Y86U two players first touched a lectern under 1s on 14 and 11 of 15
questions. This is the "pick freely, then lock" shape from
[`answer-spam.md`](answer-spam.md#better-pick-freely-then-lock--is-that-your-final-answer),
turned down on 8 September for the extra press and taken now because exposing
it was not enough.

## The story

> As a player, I want my speed to count from when I commit, not from when I
> first touched a lectern, so that a blind guess I can quietly take back stops
> beating people who read the question.

## Acceptance criteria

1. **A pick is local.** Tapping a lectern or pressing A–D / 1–4 marks it and
   writes nothing. Moving it is free and leaves no trace.
2. **A lock is the answer.** Enter, or tapping the lectern you already picked,
   writes the answer once, timed at the lock. That is the only write, so the
   lamp lights on lock and the room sees who has locked, not who has picked.
3. **A lock is final.** The lecterns and the stake are shut for that player
   until the next question. The client refuses, as it does for a Catchphrase
   call; the rules are unchanged (a crafted client can already lie about time).
4. **An unlocked pick is not lost.** With 2s left it locks itself, timed at
   the full window: it scores, and ranks behind every answer that was locked.
   A pick made inside those 2s locks the same way at once.
5. **Enter is safe.** Enter on a focused lectern is that lectern's tap, not a
   second lock. The quizmaster's Enter still reveals and moves on once the
   clock has run out. Inside the call box, Enter is the call box's.
6. **A Catchphrase call is unchanged**: it is already final, and writes at once.
7. **The status line says what to do**: "Pick an answer", then "Enter or tap
   again to lock it in", then "Locked in".
8. **Scoring is unchanged.** Rank still reads `elapsedMs`; only when it is
   stamped moves.

## Why no rules change and no extra writes

The answer is one document per player, reused question to question
(`rooms/{code}/answers/{uid}`). A pick that stays on the device costs nothing,
and the lock is the write that was already happening. Doubling it (pick, then
lock) would double the part of a round's reads that grows with the square of
the room ([`cost.md`](cost.md)). Finality is enforced by the client, as for a
call — the threat here is a player using the ordinary screen, not a crafted
client.

The auto-lock is at 2s, not at 0, because a write that lands after the host
has revealed is not counted, and the office has seen 4–5s writes. 2s is a
compromise: it keeps most of a slow write inside the window.

## What it costs

One more press per question for everyone, and a pick nobody locks is ranked
last. The What's new line says so.
