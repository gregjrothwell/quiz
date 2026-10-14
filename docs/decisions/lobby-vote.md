# Lobby vote — the room says which set it wants

> **Owner: Greg Rothwell. Last updated: 12 October 2026. Budget: 250 lines.**

## Story

As a player in the lobby, I can see the packs and vote for one, so the
quizmaster picks what the room wants.

Greg, 8 October 2026. Before this only the quizmaster saw any pack; everybody
else read "Waiting for … to choose a set". That was never a decision. The
picker was built for the quizmaster and the pick lives in their browser's
state until Start.

## Acceptance criteria

1. Every player in the lobby sees every pack's title, blurb and live vote count.
2. Tapping a pack casts your vote; tapping another moves it; tapping your own
   again takes it back. One vote per player.
3. The pack the quizmaster has highlighted is marked on every screen.
4. The quizmaster still chooses and starts. The vote never starts a round.
5. Votes and the highlight clear when the round starts, and on a reset.
6. A player who has left stops counting.
7. Proved end to end against the emulator with two browsers (`npm run e2e`).

## Decisions

**Advisory, not binding.** An automatic winner needs tie-breaks, a timeout,
abstentions, and takes the level, length, wager, steal and jigsaw away from the
quizmaster. Going with the room is one tap.

**Players vote on packs only.** Length, level and modes stay with the
quizmaster.

**Two fields on the room document, no ruleset paste.** `packVotes` (uid → pack
id) and `browsing` (the quizmaster's highlighted pack, or null). `wellFormed()`
does not `hasOnly` the room's keys — the same reason `wagerEnabled`,
`stealEnabled` and `expiresAt` needed none. Checked against `firestore.rules`
on this branch, and proved by the e2e allow case: a second browser's vote lands
and the quizmaster's screen counts it.

**Not in `players.{uid}`.** `playerOk` `hasOnly`s the entry's keys, so a vote
there would need a paste — and the project rule is that `players` changes only
by membership writes.

**Written field by field, like `players`.** A vote is `packVotes.{uid}`, the
highlight is `browsing`. A phase transition never writes either wholesale
(`toUpdate` drops them) except when it crosses into or out of the lobby, where
`start` and `reset` clear them. A dispatch in the lobby — `selectPack`, the
opening titles — would otherwise stamp the quizmaster's stale view of the
votes over everyone else's, which is the `players` race again.

**Untrusted on read.** Any member can write any field of the room, so
`readPackVotes` keeps only string values naming a real pack, and the tally
counts only uids still in `players` (AC 6 for free — the reaper and Leave
already remove the seat).

## Not covered

- **Any member can overwrite another's vote**, as they already can the players
  map. Accepted for a room of colleagues; closing it is a hand-published rule.
- **Not checked against the live ruleset.** The emulator runs the repo copy.
  The repo copy matched live at `check-rules` 91/91 on 27 September and no rule
  has changed since, but a live vote is the real check — the first office
  lobby after go-live.

## Cost

Each vote is one write delivered to every listener: *N* reads. At 4–11 seats
and a couple of changes each, a few hundred reads. At thirty, ~1,800 — real on a
day already near the 50k free tier ([`cost.md`](cost.md)). The highlight costs
the same per click.

## Evidence, 8 October 2026

- `npm run typecheck`, `lint`: clean. `npm test`: 1,425 passed, 92 files —
  `packVote.test.ts` (18) and four reducer cases are new. The reducer's start
  and reset cases failed before the fields existed.
- `e2e/lobby-vote.spec.ts` against the emulator, repo rules, `dist/` built from
  this branch: 3/3 with the smoke tests. **Proved it can fail:** with the vote
  pointed at `players.{uid}.vote` (refused by `playerOk`) it went red at "your
  vote is pressed", then green again once restored.
- Run locally on installed Chrome (`channel: 'chrome'` via a throwaway config)
  because no Playwright Chromium was downloaded on this Mac. CI runs its own.
- Preview gallery `#/preview/1` and `/2`: counts, "top", the pressed vote and
  the dashed "Quizmaster's looking" card all render; no sideways scroll at 375px.

## Evidence, 12 October 2026 — after merging #72

Master moved 22 commits (Random Round, Name the Artist, Catchphrase 178). The
merge conflicted only in `HANDOVER.md` and `TOTAL-RECALL.md`. `random` is in
`PACK_IDS`, so a vote for Random Round survives `readPackVotes`.

- `typecheck`, `lint`, `build`: exit 0. `npm test`: 1,483 passed, 94 files.
- Preview `#/preview/2` at 375px: ten cards including Random Round; one vote
  pressed, "2 votes · top", "Quizmaster's looking" on Flags; no sideways scroll.
- **e2e not run locally**: this Mac has no Java, so the emulators cannot start.
  CI's Playwright run on the PR is the e2e.

## Go live

1. Merge the PR; CI builds, runs e2e and deploys. **No ruleset paste, no
   seed** — nothing in `firestore.rules` or the vault changes.
2. **Not on Friday 9 October.** The handover's rule for the thirty-seat game is
   to run nothing new against live that day.
3. The live check is the first office lobby after: a player's vote should show
   on the quizmaster's card. If it does not, the live ruleset differs from the
   repo — `npm run check-rules` before anything else.

**Live 12 October 2026, 10:09 BST** — #73, merge `05238b7`, gh-pages `ed0bac5`. CI's Playwright
passed on the PR and on master; the served `index-D-g9FXdU` is byte-identical to a local build and
carries "Vote for a set". Step 3 — the first office lobby — has not happened yet.
