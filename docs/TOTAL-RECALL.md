# TOTAL-RECALL

> **Owner: Greg Rothwell. Last updated: 28 August 2026. Budget: 300 lines.**

The dated spine. Newest first, a few lines per entry. When one needs more room
than that it moves to `decisions/<topic>.md` and the entry here keeps a pointer —
depth goes outward, chronology stays central.

Append; do not rewrite an earlier entry to make it look as if we always knew. A
correction is a new dated note that says what changed, and the wrong claim stays
visible.

**Split on 28 August 2026**, at 474 lines against a 300 budget. Everything up to
and including 20 August moved *verbatim* to
[`recall/2026-08.md`](recall/2026-08.md) — not reworded, because compressing an
old entry to make it fit is the thing the paragraph above forbids. Every one of
them is still listed below by date, so the chronology reads end to end from here.

## 2026-08-28 — The office can vote a question out

Office feedback on question quality. Players rate a question at the reveal; the verdicts fold
back into the packs as a retirement list. **Built, rules paste outstanding.**

Shape, and the three reasons it is a global collection rather than a room one: no reads (an
in-room collection is another `Q·N²` term, ~+540 a game at six players), it outlives
`prune-rooms`, and the uid as document id deduplicates it for free. The document is one field,
`good` or `bad` — no option index, so it cannot leak what the vault protects. 90 writes a game,
no reads. `shouldRetire` is 5 votes and 60% bad, in the engine so `npm test` covers it.

**The trap:** deleting a question from `public/packs/` retires nothing, because
`fetch-questions --resort` rebuilds the packs from `.cache/` and would resurrect it silently.
So `src/questions/retired.json` is the record and the packs are downstream; `seal.test.ts`
now checks no retired id is back in a pack. 482 tests.

**Two corrections made while building.** `delete: if false` on the vote path was written first
and was wrong — it buys nothing, since `update` already lets anyone flip their own verdict, and
it costs a row no client can remove, which is exactly the `prune-rooms --probe-rows` litter
this repo already had to sweep once. And `check-rules` currently passes all six *deny* cases
for the wrong reason: with no rule published, everything is denied. They only prove anything
after the paste.

`questions.md` hit 259 against its 250 budget, so this **split** into
`decisions/question-votes.md` rather than being tidied — the harvest pipeline and what the
office does to it afterwards are different subsystems meeting at `public/packs/`.
→ [`decisions/question-votes.md`](decisions/question-votes.md)

## 2026-08-28 — The join link goes straight into the room

Office feedback: following the link still costs a press on a screen that already knows both
answers. `shouldAutoJoin` (`src/engine/autoJoin.ts`) skips it. Written as a **list of
refusals** — no code, no remembered name, whitespace name, not signed in, not connected, link
already used, already in a room — because the refusals are the half worth testing. All of them
fall back to exactly today's landing screen with the code filled in. 11 tests, 459 total.

**The Lurker is the one refusal about the game rather than readiness.** Their side lives in
session storage on purpose, so a fresh session has a squad and no side; auto-joining would
bank their week to Lurkers instead of whoever they sat with, and nobody would see it happen.
Verified live: name and code both present, still refused, and the landing screen put the
"playing with" picker up. An empty squad is *not* the same case and goes straight in.

Proved in both directions in the browser: a cleared browser lands on the landing screen with
the code filled; a browser holding a name goes straight in; the lobby then says *"The link
brought you straight in as Linky, playing for Hermes"* with **Not you? Start again**, which
returns to the landing screen without re-joining. A room created by hand shows no such line.
→ [`decisions/joining.md`](decisions/joining.md)

## 2026-08-28 — The shared clock is live, and has been played

Merged [PR #8](https://github.com/gregjrothwell/quiz/pull/8) and deployed. Eight commits: the
shared clock, the rank-scoring rename, the host-room answers fix. The CDN was watched until it
served `index-AUAGmZGO.js` rather than assumed.

**First round anybody has played on the shared clock.** Room PMVP, 20s window, answered from
the keyboard at 10s showing: browser `CORRECT · +1,000` stamped 10.6s, terminal
`scored: ClockTest +1000` at 10.79s after open. The two agreeing is the evidence; the 0.19s
gap is write latency. Clears **keyboard shortcuts in a live round**. Ranking still unproven —
one answerer cannot show an order.

Re-run before merging: 448 tests, `check-rules` both directions, `sync-harness 10` (host +4ms,
other nine +50–53ms), `reveal-probe` accepted at 10005ms.

**Found, not fixed:** a page reload drops you out of the room — `code` is React state in
`useRoom` and nothing persists it. Pre-existing. Now in the handover's Outstanding list.
## Earlier — the full chronology, archived

Thirty entries, moved on 28 August 2026 and unchanged. Newest first, as above.

- **2026-08-20** — [host-room reads the answers, and scores them](recall/2026-08.md#2026-08-20--host-room-reads-the-answers-and-scores-them)
- **2026-08-20** — [The shared clock, and a harness that scores nothing](recall/2026-08.md#2026-08-20--the-shared-clock-and-a-harness-that-scores-nothing)
- **2026-08-20** — ["The Ladder" was already taken](recall/2026-08.md#2026-08-20--the-ladder-was-already-taken)
- **2026-08-20** — [The final screen makes a shareable card](recall/2026-08.md#2026-08-20--the-final-screen-makes-a-shareable-card)
- **2026-08-20** — [Scoring is a rank bonus, not a speed curve](recall/2026-08.md#2026-08-20--scoring-is-a-rank-bonus-not-a-speed-curve)
- **2026-08-20** — [Three directional decisions, and an ideas review](recall/2026-08.md#2026-08-20--three-directional-decisions-and-an-ideas-review)
- **2026-08-20** — [App Check on auth is enforcing after all, hours late](recall/2026-08.md#2026-08-20--app-check-on-auth-is-enforcing-after-all-hours-late)
- **2026-08-20** — [check-rules was not leaking; the three rows were older than the fix](recall/2026-08.md#2026-08-20--check-rules-was-not-leaking-the-three-rows-were-older-than-the-fix)
- **2026-08-20** — [take-stock had been under-reporting since weekly boards shipped](recall/2026-08.md#2026-08-20--take-stock-had-been-under-reporting-since-weekly-boards-shipped)
- **2026-08-20** — [The squad dropdowns were never styled](recall/2026-08.md#2026-08-20--the-squad-dropdowns-were-never-styled)
- **2026-08-20** — [The reveal was a coin flip, and the host's device always called it](recall/2026-08.md#2026-08-20--the-reveal-was-a-coin-flip-and-the-hosts-device-always-called-it)
- **2026-08-20** — [Anonymous account purge: reviewed, and the answer is don't](recall/2026-08.md#2026-08-20--anonymous-account-purge-reviewed-and-the-answer-is-dont)
- **2026-08-20** — [App Check enforced on the Realtime Database](recall/2026-08.md#2026-08-20--app-check-enforced-on-the-realtime-database)
- **2026-08-20** — [Build-time code moved out of `src/`, and two routes stopped shipping](recall/2026-08.md#2026-08-20--build-time-code-moved-out-of-src-and-two-routes-stopped-shipping)
- **2026-08-20** — [The pack seal was a convention, not a test](recall/2026-08.md#2026-08-20--the-pack-seal-was-a-convention-not-a-test)
- **2026-08-20** — [The handover was split, because it cost more than the code](recall/2026-08.md#2026-08-20--the-handover-was-split-because-it-cost-more-than-the-code)
- **2026-08-20** — [Correction: the room count, settled by measuring](recall/2026-08.md#2026-08-20--correction-the-room-count-settled-by-measuring)
- **2026-08-20** — [`host-room` had been dead for weeks](recall/2026-08.md#2026-08-20--host-room-had-been-dead-for-weeks)
- **2026-08-20** — [Squads, weekly boards and the average table went live](recall/2026-08.md#2026-08-20--squads-weekly-boards-and-the-average-table-went-live)
- **2026-08-19** — [`recordGame` proved against the live project](recall/2026-08.md#2026-08-19--recordgame-proved-against-the-live-project)
- **2026-08-17** — [A `joinedAt` from one room walked into another](recall/2026-08.md#2026-08-17--a-joinedat-from-one-room-walked-into-another)
- **2026-08-16** — [App Check enforcing on Cloud Firestore](recall/2026-08.md#2026-08-16--app-check-enforcing-on-cloud-firestore)
- **2026-08-15** — [Six wrong statements about Google's console in one afternoon](recall/2026-08.md#2026-08-15--six-wrong-statements-about-googles-console-in-one-afternoon)
- **2026-08-15** — [Rooms pruned, and TTL turned out to need billing](recall/2026-08.md#2026-08-15--rooms-pruned-and-ttl-turned-out-to-need-billing)
- **2026-08-15** — [Teams, then squads](recall/2026-08.md#2026-08-15--teams-then-squads)
- **2026-08-15** — [The security review](recall/2026-08.md#2026-08-15--the-security-review)
- **2026-08-14** — [The clock, heard rather than reasoned about](recall/2026-08.md#2026-08-14--the-clock-heard-rather-than-reasoned-about)
- **2026-08-13** — [A refused reveal stalled the round for minutes](recall/2026-08.md#2026-08-13--a-refused-reveal-stalled-the-round-for-minutes)
- **2026-08-13** — [The vault is ahead of the packs, not behind](recall/2026-08.md#2026-08-13--the-vault-is-ahead-of-the-packs-not-behind)
- **2026-08-03** — [`season-2` started with the office](recall/2026-08.md#2026-08-03--season-2-started-with-the-office)
