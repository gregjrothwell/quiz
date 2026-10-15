# Host authority — W3's story

> **Owner: Greg Rothwell. Last updated: 15 October 2026. Budget: 250 lines.**

**Status: BUILT on `w3-host-authority` (PR #86), 15 October 2026; e2e 15/15 that
evening, AC8 included. Not live; no ruleset published.** Ships with W2 in one
release. Story approved by Greg the same day, with both defaults below as
written. What was built and what was not: [below](#what-was-built-15-october-2026).
W3 of the plan in
[`public-scale.md`](public-scale.md#the-plan-15-october-2026), under D1 (seams
now) and D2 (b) (a heartbeat claim), both decided 15 October. **No rule from
this ships until W2 is live**, so that rules and the client they match go out in
one deploy.

Every "today" claim below was read off the code on 15 October, with the file
named. Anything still to be proven is marked **to prove**.

## The story

> As **the person running a quiz for strangers**, I want **only my device to be
> able to move the game on, score it, or see the answers before the reveal**,
> so that **a player cannot rewrite the scores, skip the question, or read
> everybody's picks from the network tab**, and if my laptop dies mid-round
> the room carries on without me.

For the office it changes nothing you can see: the person who made the room
runs it, as today.

## What happens today

**Rules** (`firestore.rules`, the `rooms` block): any member may update
anything in the room. The comment says so: *accepted for a room of colleagues*.
`wellFormed`, `timingOk` and `questionsPinned` bound the damage. The vault
reveal, `rooms/{code}/reveal/{id}`, is creatable by **anyone signed in** once
the window has closed.

**Who writes the room**, every writer in `src/` (grep for `updateDoc(` /
`setDoc(`, 15 Oct):

| Writer | What | Where |
|---|---|---|
| The quizmaster's device | every `dispatch`: `selectPack`, `titles`, `clearTitles`, `start`, `reveal`, `next`, `skip`, `settle`, `openPicks`, `closePicks`, `reset` | `useRoom.ts` `dispatch`; callers in `App.tsx`, `useStandoff.ts` |
| The quizmaster's device | `browsing`; the lobby reaper deleting others' `players.{uid}` | `useRoom.ts` |
| Each player, about themselves | `players.{uid}` (join, rejoin, squad, leave); `scores.{uid}` on join; `packVotes.{uid}`, `voteTaps.{uid}` | `useRoom.ts` |
| Each player | own answer, `rooms/{code}/answers/{uid}`; own `standoff/{uid}` | `useRoom.ts`, `useStandoff.ts` |
| The quizmaster's device | the vault reveal doc | `vault.ts` |

So the client is already host-authoritative. Only the rules do not enforce it.

- **The score a joiner writes is never new.** `planJoin` (`engine/join.ts`)
  writes `scores[uid] ?? 0`: their existing score unchanged, or zero. A rule can
  say exactly that, so no host write is needed for joins.
- **Every client reads every answer as it lands.** `useRoom.ts` subscribes to the
  whole `answers` subcollection: the Q·N² term in [`cost.md`](cost.md).
  Non-hosts use it for:
  - their own pick;
  - `AnswerLamps`, who has answered;
  - after the reveal, the replay timeline and steal's "who lost what"
    (`QuestionScreen.tsx`).
- **The quizmaster is derived, not stored.** `resolveQuizmaster` picks the
  earliest `joinedAt`. A **Leave** hands over automatically. A **drop** does not,
  mid-round: `reapAbsent` (`engine/presence.ts`) only tidies the lobby, so a
  quizmaster whose lid shuts mid-round stays quizmaster, and the round stalls
  until they return or someone runs `host-room` (handover, Outstanding 5).

## What changes

1. **`hostUid` on the room.** Set on create to the creator. Today's quizmaster
   is the creator anyway in the normal case.
2. **Host-only writes:**
   - phase, index, questions, durations, settings, titles, `browsing`,
     `scores` (beyond a joiner's own unchanged or zero entry);
   - removing another player;
   - the vault reveal doc;
   - `hostUid` itself.

   **Self-writes stay open to every member:**
   - own `players.{uid}`, with no `joinedAt` change after the first write;
   - own `scores.{uid}`, unchanged or zero;
   - own `packVotes` and `voteTaps`;
   - own answer and own `standoff` doc.
3. **Answers readable by the host and by their author only.** The read rule may
   now `get()` the room. The `cost.md` warning was about N listeners each paying
   per snapshot; with one listener, the host, that is about one read per answer,
   so Q·N. **To prove:** that a rules `get()` on a collection listener is billed
   as we think. Measure it, don't trust this paragraph.
4. **The reveal publishes the picks.** The host's reveal write, which already
   carries the scores, also carries that question's answers. Clients read
   those after the reveal, so the replay, the steal and the reveal chips work
   unchanged. Bounded by `maxPlayers`, and replaced each question.
5. **Lamps move to the Realtime Database.** Each player writes
   `lamps/{code}/{gameId:index}/{uid}: true` beside their answer, writable only
   as themselves, the same shape as `presence`. RTDB is billed on bandwidth, not
   reads, so lamps stop costing a read per answer per player. A player could
   light their lamp without answering, which is mischief only.
6. **Leave hands over in the same write.** A host who leaves sets `hostUid` to
   the longest-seated remaining player, the person `resolveQuizmaster` would
   have picked.
7. **D2 (b), the heartbeat claim:**
   - The host writes `rooms/{code}/host/beat` `{ at: serverTimestamp }` every
     **15 s**. Nobody listens to it, so it costs writes, not reads.
   - When the host's RTDB presence has been gone for a while, the
     longest-seated *present* player claims the chair. In one batch they write
     `hostUid: me` and a fresh beat.
   - The rule allows the claim only if the claimant is a member and the old
     beat is older than **75 s** (`get()` once per claim). A second claimant
     finds the new beat fresh and is refused.
   - 75 s rather than 30 s because a hidden tab's timers slow down. **To
     prove:** Chrome's current throttling of hidden tabs (fetch Chrome's docs;
     from memory it is about once a minute after five minutes hidden).
   - The client only claims when presence is gone, so a host who is merely slow
     keeps the chair. The rule only checks the beat, so a rogue claim needs 75
     silent seconds first.
   - **To prove:** that a new host can carry on a question already open: read
     the answers written before the handover, reveal, and move on. The read
     rule checks the *current* `hostUid`, so it should.
8. **Expand, then contract.**
   - **Expand:** rules accept a room with no `hostUid` under today's member
     rule, and one with `hostUid` under the new rule. Clients start writing
     `hostUid`.
   - **Contract:** once every room older than the deploy has expired
     (`expiresAt`), the member rule goes.
   - Two deploys, one session.

**Not in W3:** `games/`, `seasons/…/players`, `seasons/…/asked` and
`questionVotes` are still writable by anyone signed in. The quizmaster's device
writes the first three for everybody. Owning those is W4's job (a league, and
D6's signed-in owner). Recorded so W3 is not mistaken for closing them.

## Acceptance criteria

| # | Given / when | Then |
|---|---|---|
| AC1 | A non-host member writes phase, index, questions, scores, settings, `browsing`, `hostUid`, another player's entry, or the vault reveal doc | Refused by the rules, one deny case per field group |
| AC2 | The host's device runs each dispatch type for real: `selectPack`+`titles`, `start`, `reveal`, `next`, `skip`, `settle`, `openPicks`, `closePicks`, `reset`, `clearTitles`, and the lobby reaper | Allowed. **One allow case per rule function touched**, each failing before and passing after ([the postmortem](postmortem-the-pin-that-refused-the-reveal.md)) |
| AC3 | A player joins, rejoins with a score, sets a squad, votes twice, leaves, answers, stakes, commits and reveals a standoff pick | Allowed, each through the client's own path |
| AC4 | Before the reveal, a player queries the answers | Gets their own only. The host gets every one |
| AC5 | The reveal lands | Every device shows every pick: reveal chips, replay, steal. Same scores as today, from `rank-harness`'s seven answerers |
| AC6 | Players answer | Every device's lamps light within about a second, with no player reading another's answer |
| AC7 | The host presses Leave, in any phase | The longest-seated remaining player is host in the same write |
| AC8 | The host's tab closes mid-question | Within about 90 s the longest-seated present player is host, the open question reveals with every answer counted, and the round goes on |
| AC9 | The host's tab is hidden or throttled but connected | Nobody claims; a forced claim is refused while the beat is fresh |
| AC10 | `sync-harness 30` runs a round | Reads counted, not estimated, against today's 14.6k–32.7k for ≤20 questions. The answer term should drop from Q·N² to about Q·N |
| AC11 | A room is mid-round when the expand deploy lands | It finishes normally |
| AC12 | An ordinary office round | The creator runs it and nothing on screen differs from today |

## Proof, before "done"

- `npm run check-rules`, both directions, live, after each of the two deploys.
- `host-room`, `rank-harness -- --browser`, `sync-harness 30` against live, in
  that order. They exercise the client's own paths, not probes shaped like it.
- **Six scripts reach the live answers path through the client SDK**, so they
  meet the new rules: `check-rules`, `final-harness`, `host-room`,
  `rank-harness`, `reveal-gate-probe`, `sync-harness` (grep, 15 Oct; 2 October
  counted seven). `fold-votes` and `prune-rooms` use the Admin SDK and bypass
  rules. Each is read before it is changed.
- e2e (CI only: this MacBook has no JDK, so the emulators do not start locally)
  for AC4–AC9 in the emulator.
- **The live check is an office round**, read back with `read-games`.

## Size

3–5 sessions, as estimated on 2 October:
- rules and their cases: 1–2;
- client (`hostUid`, published picks, RTDB lamps, the claim): 1–2;
- harnesses and the two deploys: 1.

The riskiest part is AC8, so it is built and proven first.

## For Greg — decided 15 October 2026, as written

1. **Approve the story.** Approved.
2. **Heartbeat timing:** a beat every 15 s, and a claim after 75 s of silence.
   A host whose laptop sleeps loses the chair after about 75–90 s. Shorter means
   faster recovery and more wrongful claims from throttled tabs.
   **Taken: 15 s / 75 s.**
3. **Lamps on the Realtime Database:** fine that a player could light their own
   lamp without answering? **Yes.**

## What was built, 15 October 2026

Expand half only, on `w3-host-authority`, PR #86. Branch cut from
`host-authority-story`, so it carries W1's commits too (#81).

| | Where |
|---|---|
| `hostUid`, `resolveHost`, `successorOnLeave`, `planClaim`; 15 s / 75 s / ask from 50 s, retry 5 s | `src/engine/host.ts` |
| The reveal publishes `lastPicks`; next, skip, start, reset clear it | `src/engine/reducer.ts` |
| Room document both ways, moved out of `useRoom` so Node can load it | `src/lib/roomDoc.ts` |
| Create names the host; beat and claim over Lite; Leave hands over; own-answer listener; lamps; `answersReady` | `src/lib/useRoom.ts` |
| Host-only writes, `selfWrite`, `claim`, answers `get`/`list`, reveal `mayReveal`, `host/beat` | `firestore.rules` |
| `lamps/{code}/{question}/{uid}` | `database.rules.json` |

**Chrome, checked 15 Oct** (MDN `setTimeout`, last modified 3 Sep 2026): after
five minutes hidden, with five or more chained timers (`setInterval` counts),
silent 30 s and no WebRTC, timers run **once a minute**. A throttled host's beats
are then up to ~60 s apart, under 75. Not covered: Firefox for Android (15-minute
minimum, may unload the tab) and Chrome's tab freezing, which the page does not
mention. A host in either keeps the chair only while presence holds.

**Proof, by criterion.** e2e is CI only (no JDK here).

| AC | Evidence | State |
|---|---|---|
| AC1, AC3, AC4, AC6, AC7, AC9, AC11 | `e2e/host-authority-rules.spec.ts`, client SDK + `reduce`/`toUpdate` | CI |
| AC2 | same file: selectPack+titles, clearTitles, start, reveal doc, reveal, next ×2, skip, reset, reaper, browsing, beat; and the final, openPicks, closePicks, settle (15 Oct evening) | CI |
| AC5, AC6, AC8, AC12 | `e2e/host-authority.spec.ts`: the host's tab closes mid-question, Ann claims, reveals both answers, moves on; and an ordinary round the creator reveals | CI, 15/15 |
| AC10 | `sync-harness 30` reads | **not done** — needs a live deploy |
| live | `check-rules` (28 W3 cases now), `host-room`, `rank-harness -- --browser`, an office round | **not done** — after the deploy |

**Before the change** (CI, `0c605f0`, tests only): the AC2/AC3 allow case
failed `PERMISSION_DENIED` (no rule for the beat), and the AC8 round failed (no
`hostUid`). Serial mode skipped the rest; it is off now.

**After** (CI run 38767293760, `40fccb7`): all nine rules cases pass, the canary
included. The AC8 round timed out on the opening titles, a test fault (fixed in
`126650e`); its result is on PR #86.

**Not built:**
- **No script writes RTDB presence**, so a browser in a harness room asks for
  the chair every 5 s from 50 s; the beat keeps every ask refused.
- **Lamps are never deleted.** About 40 bytes per player per question. A
  `prune-rooms` pass over `lamps/{code}` is the tidy.
- **The beat costs writes:** about 240 an hour per open room, all day if a tab
  is left open, against 20,000 a day.
- **An old tab in a new room** (not reloaded since the deploy) lists every
  answer and is refused, so it loses the replay. Reload fixes it.
- **The contract deploy** (no `hostUid`, no write) waits until every room made
  before the expand deploy is past `expiresAt`, 30 days.
- Whether a rules `get()` on the host's listener is billed per snapshot: AC10.

## 15 October evening: the AC8 stall, and the gaps closed

**The stall.** CI showed Ann take the chair at +75 s, then sit on "Revealing…":
`handleReveal` returned at `answersReady` every time, and her answers listener
gave one cached snapshot (`fromCache: true`, her own answer) and never one from
the server, with no error. Cause found by logging every early return (run
38799952009): before the room's first snapshot, `hostUid` read as absent, so a
joiner listed every answer as if the room were pre-W3, and was refused. **Fix:**
no answers listener until the room has been read (`roomKnown`, `useRoom.ts`).
After it, the same claim gets the server's snapshot (2 answers) in 50 ms and
reveals (run 38801025236). Why the SDK never re-confirmed that query is not
established; only that gating cures it.

**Also closed:** AC12 in a browser (never run before; "Correct · +1,000", not
"Correct"); the final's allow cases; 28 W3 cases in `check-rules`; three
harnesses make hosted rooms that beat (`scripts/hostBeat.ts`). **Late 15 Oct,
#90:** all six do; `final-harness` is the live allow case for the final (FAE8);
`rank-`/`final-harness` light lamps (Gus reads 7 of 7, 4NW8); a 429 is named.
An RTDB write keeps Node alive past `deleteApp`, so both now `process.exit`.
