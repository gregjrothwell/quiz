# TOTAL-RECALL

> **Owner: Greg Rothwell. Last updated: 20 August 2026. Budget: 300 lines.**

The dated spine. Newest first, a few lines per entry. When one needs more room
than that it moves to `decisions/<topic>.md` and the entry here keeps a pointer —
depth goes outward, chronology stays central.

Append; do not rewrite an earlier entry to make it look as if we always knew. A
correction is a new dated note that says what changed, and the wrong claim stays
visible.

**Entries before 20 August 2026 are reconstructed** from the dates recorded in
the old 2,422-line handover, when it was split. They are a true index of what
happened and when; they are not a contemporaneous log, and anything needing the
detail should follow the pointer rather than trust the summary here.

## 2026-08-20 — The handover was split, because it cost more than the code

`docs/HANDOVER.md` had reached 2,422 lines / ~40,000 tokens, read at the start of
most sessions — more than the ~20,600-line codebase it described. Split into a
125-line way-in plus fourteen files under `decisions/`, moved verbatim. This file
is new; the project never had one, which is why the handover had been doing both
jobs. Budgets and a session-start warning now live in `~/clawd/context/`.

## 2026-08-20 — Correction: the room count, settled by measuring

The handover asserted both "leaving 3 rooms" and "79 rooms are still there". The
second was written before the prune ran and never updated. `npm run take-stock`
reports **12 rooms** today, consistent with 3 on 15 August plus rounds since. One
room predates `expiresAt` and no TTL policy can ever reach it. Both stale
readings stay visible in [`decisions/security.md`](decisions/security.md).

Also measured, and worth knowing: **0 recovery codes and 0 identity claims.** The
whole durable-identity feature has never been used by anybody.
→ [`decisions/identity.md`](decisions/identity.md)

## 2026-08-20 — `host-room` had been dead for weeks

It died on an import that reached `src/firebase.ts`, which reads
`import.meta.env` — defined by Vite and not by Node, so the script died before
its own code ran. The cost was not one broken command but three untested paths
with no other tool. `scripts/imports.test.ts` now walks the graph and fails if it
comes back. PR #4.
→ [`decisions/gotchas.md`](decisions/gotchas.md)

## 2026-08-20 — Squads, weekly boards and the average table went live

PR #2, merged and deployed: squads from a list, a weekly board, a season table
ranked on points ÷ played, a podium that stops rearranging itself, and question
text sealed for exactly as long as the clock runs. **The office has not played a
real round on any of it.**
→ [`decisions/season.md`](decisions/season.md)

## 2026-08-19 — `recordGame` proved against the live project

A solo round in the browser, including the repeat-write guard across a reload.
Until then the season write path was the least-proven code in the repo.
→ [`decisions/season.md`](decisions/season.md)

## 2026-08-17 — A `joinedAt` from one room walked into another

Room 6JA5 had a player whose `joinedAt` was the millisecond they created an
entirely different room. That reading decides the quizmaster, so a browser that
had been sitting in an earlier room could take the transport off whoever was
running this one. The remembered place is now stamped with the room it was
earned in.
→ [`decisions/joining.md`](decisions/joining.md)

## 2026-08-16 — App Check enforcing on Cloud Firestore

Proved in both directions on the day, which is the only way an enforcement
switch means anything: the live site still worked, and the same script that
passes 36/36 with its debug token was refused outright without one.

**Not** enforced on the Realtime Database, and **not** on authentication — the
negative test still signed in. Saying so is what stops the next person assuming
more was done than was.
→ [`decisions/security.md`](decisions/security.md)

## 2026-08-15 — Six wrong statements about Google's console in one afternoon

Every one was about the **platform**, not the code; every claim about this repo
in the same session was proved by running something and held up. The rule that
would have prevented all six: **never state platform behaviour from memory** —
fetch the documentation, and where it is silent, say it is silent. A correction
is not automatically right either; two of the six were corrections to earlier
errors.
→ [`decisions/gotchas.md`](decisions/gotchas.md)

## 2026-08-15 — Rooms pruned, and TTL turned out to need billing

81 rooms and 533 documents deleted, leaving 3. Season rows, the vault and the
question history untouched. The intended fix was a Firestore TTL policy;
**TTL requires billing enabled and this is a Spark project**, which is stated on
neither documentation page and is discovered at the Create Policy button.
→ [`decisions/security.md`](decisions/security.md)

## 2026-08-15 — Teams, then squads

Groups at work rather than teams playing together, so the board reads as your
league rather than the whole office. It needed no console step, which was the
whole point of bounding `team` in the rules a fortnight before writing a line of
it — the season row is validated with `keys().hasOnly([...])`, so any new field
is refused until the rules are re-pasted by hand, and that paste has broken this
game twice.
→ [`decisions/season.md`](decisions/season.md)

## 2026-08-15 — The security review

`list` dropped from `/rooms` was the whole ballgame: any anonymous visitor could
pull every live room in one query — players, scores, questions, every
`correctIndex` — and then write to all of them. Room writes are now shape-checked,
`create` requires exactly one player, and `check-rules` tests denials rather than
only permissions, because the permissive direction is completely silent.
→ [`decisions/security.md`](decisions/security.md)

## 2026-08-14 — The clock, heard rather than reasoned about

→ [`decisions/clock.md`](decisions/clock.md)

## 2026-08-13 — A refused reveal stalled the round for minutes

Question one sat on "the vault would not confirm an answer" until Reveal was
pressed by hand. The vault turns a reveal down until the server agrees the answer
window has passed, which is routine and self-correcting — but nothing retried it,
and in a room where everybody has already answered nothing is writing, so no
update ever arrived to trigger one. Now retried, capped.
→ [`decisions/vault.md`](decisions/vault.md)

## 2026-08-13 — The vault is ahead of the packs, not behind

All 14,176 pack questions across the ten packs resolve to an answer. The surplus
documents are orphans from earlier harvests: ids hash the question text, so a
revised question leaves its old answer in place, unread and harmless.
→ [`decisions/vault.md`](decisions/vault.md)

## 2026-08-03 — `season-2` started with the office

`season-1` was development and testing. Bumped rather than deleted: an empty
board either way, old rows stay recoverable, and no destructive write against
live data. A new season also starts with an empty question history.
→ [`decisions/season.md`](decisions/season.md)
