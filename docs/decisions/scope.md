# Scope — what was ruled out, and what the tier allows

> **Owner: Greg Rothwell. Last updated: 28 August 2026. Budget: 250 lines.**

Split out of [`ideas-review.md`](ideas-review.md) on 28 August 2026, when that file went over
its 250-line budget. The text is unchanged; only where it lives is.

That file is the backlog — what to build next, ranked, read at the start of a session. This one
is the closed half: the directional decisions taken, the things deliberately **not** built, and
what the Spark free tier actually permits. Read on demand, and before proposing something that
was already turned down.

## Three decisions taken, 20 August 2026

| Decision | What it changes |
|---|---|
| **The quiz stays an event.** Not a habit | Async, hostless play is rejected. Effort goes into the live round |
| **Ruleset pastes are no longer a big deal** | One per feature, when that feature needs it. **No speculative forward-bound fields** |
| **Rank-based scoring, to try** | The speed curve came from Polly and had never been questioned |

**The second overturns an assumption this repo is built on** — several places design around
*"a hand-pasted ruleset has broken this game twice"*. Relaxed, not wrong: a paste still goes out
in the right order and is verified in both directions. It just no longer bends designs around
itself. **Two pastes have gone out since, both clean.**

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
six-player rooms. Staying an event keeps every idea here well inside it. `prune-rooms` beats a
TTL policy anyway, by reaching the subcollections a sweep orphans
([`cost.md`](cost.md#the-two-slow-leaks)).

**Google's pricing is not stated here from memory.** If Blaze is ever considered, check the
calculator and set a budget alert the same day. The one thing it buys that Spark cannot fake is
a Cloud Function holding the answers server-side, ending self-reported `elapsedMs` outright —
and §5 gets most of that for one rule `get()`, so it is not a reason to move.
