# Lobby vote — the room says which set it wants

> **Owner: Greg Rothwell. Last updated: 15 October 2026. Budget: 250 lines.**

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

## Two taps, then it locks — 14 October 2026

Greg, 14 October: people are abusing the vote by clicking around for the fun of
it. Every tap is a write every screen in the room reads, and the counts flicker
on the quizmaster's cards while they are trying to read them.

**Story.** As the quizmaster, I want each player's vote to settle, so the counts
mean something and the room is not a toy while I pick.

**Acceptance criteria**

1. A player gets **two taps** per lobby: cast, then change or take back once.
   AC 2 above still holds inside them.
2. After the second the cards stay on screen with their counts, but a tap does
   nothing — no write, no change.
3. The hint says a change is left, and says the vote is locked once it is.
4. A new lobby — after a reset — gives two taps again.
5. The quizmaster's highlight is not limited: it is one person, and theirs.

**Why two.** Built at three (cast, a mistake, a correction); Greg cut it the
same evening: "1 vote per player — we can relax later if lessons have been
learned", then "actually — 2". Two keeps one change for a mis-tap on a phone.
The number is `VOTE_TAPS` in `src/engine/packVote.ts`, so relaxing it is one
line and the tests that name it.

**Not covered.** The count is in the lobby's own state, not the room: a reload
gives two more, and the console can write `packVotes.{uid}` at will — the
first is seconds of effort for a joke, the second is a hand-published rule for
a room of colleagues. **Cost** gains a ceiling: at most two writes a player,
so at thirty seats 60 writes × 30 readers ≈ 1,800 reads, where before there was
none.

> **The reload half was used, and is closed — 15 October 2026.** See the next
> section. The ceiling above did not hold while it was open.

**Live 14 October 2026, 22:26 BST** — #75 (release with #74), merge `2bf10aa`, gh-pages `21ccbd5`. CI's
Playwright, including the lock, passed on the PR and on master; the served `index-DV3kGh-I` is
byte-identical to a local build and carries "Your vote is locked in". The live check is the first office
lobby: a player's second tap locks their cards.

## The count moves to the room — 15 October 2026

Greg, 15 October: somebody got round the lock by refreshing the page — the gap
the section above accepted. The tap count was `useState(0)` in the lobby, so a
reload, or Leave and rejoin, started it from zero.

**Story.** As the quizmaster, I want the two-tap limit to hold across a reload,
so the counts settle as the 14 October story meant them to.

**Acceptance criteria**

1. A reload after both taps comes back locked, with the vote still pressed.
2. A reload after one tap leaves one change, not two.
3. The count costs no write and no read of its own.
4. A new lobby — after a start or a reset — gives two taps again.

**How.** `voteTaps.{uid}` on the room document, counted with `increment(1)` in
the same `updateDoc` as `packVotes.{uid}` (`writeOwnVote`, `useRoom.ts`). Every
player already listens to the room, so the count arrives with the vote. Cleared
by `start` and `reset` and dropped by `toUpdate` inside the lobby, exactly as
`packVotes` is. Read through `readVoteTaps`, untrusted: only a whole,
non-negative count survives. The lobby takes the larger of the room's count and
its own, so a fast second tap still counts before the room's copy comes back.

**No ruleset paste**, for the reason the vote needed none: the room's `update`
rule bounds the fields `wellFormed()` names (`firestore.rules:319`) and has no
key whitelist.

**Not covered.** The console can still write `voteTaps.{uid}` back to zero —
deliberate effort, where a refresh was not; closing it is a hand-published rule.
A private window or another device is another seat with its own vote, as it
always was.

**Evidence, 15 October 2026.** `typecheck`, `lint`, `build`: exit 0. `npm test`
1,495/1,495, 95 files — `readVoteTaps` (3), the reducer's start and reset cases,
and two reload cases in `Lobby.voteLimit.test.tsx`. **Proved it can fail:** with
the lobby reading only its own count, exactly the two reload cases went red;
green again with the room's. `e2e/lobby-vote.spec.ts` now reloads the guest
after the lock and asserts it still holds — **CI only**, no Java on this Mac.

**Go live.** Through a `release-<date>` branch per AGENTS.md; no paste, no seed.
The live check is the first office lobby after: lock a vote, reload, still locked.

**Live 15 October 2026, 11:01 BST** — #77 (carrying #76), merge `74b1c91`, gh-pages `3b63b5a`. No
release branch: one PR already held both. CI's Playwright, including the reload, passed on the PR and on
master; the served `index-BWSiBKMq` is byte-identical to a local build (SHA-256 `fe7789a6…`) and carries
`voteTaps`. The office-lobby check has not happened yet.
