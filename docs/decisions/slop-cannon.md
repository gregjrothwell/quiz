# The Slop Cannon — story and acceptance criteria

> **Owner: Greg Rothwell. Last updated: 26 October 2026. Budget: 250 lines.**

**Status: APPROVED 26 October 2026, as drafted.** Greg: *"Let's build the lab -
but call it slop cannon"*, then **A–D as drafted** — beacon first, quizmaster-only
switches, Keep / Bin only. This is the Lab from
[`direction-oct-2026.md`](direction-oct-2026.md#3-beta-testing--more-from-the-office),
shelved 22 October ("pointless extra complexity") and drafted on branch
`lab-story` (#122, closed). The draft's claims were re-read against `d74e581`;
what changed is below.

## What changed since the Lab draft (22 Oct → 26 Oct)

- **Every Wow item shipped without it** — Survey Says, Beat the Chaser, the
  Commentator, Quiz Wrapped. So v1 has **nothing loaded**: it ships dark (B6).
- **The name.** "Slop Cannon" on screen; `cannon` in code, rules and scripts.
  A trial is a **shot**. The error beacon is not a shot and keeps its own name.
- **No read while dark.** The kill-switch read (C2) is skipped when no shot is
  registered, so v1 costs nothing per page load.
- **The room rule cannot bound key length** (B4). Rules cannot walk a map. What
  is bounded: ≤ 8 keys and every value `true` (`values().hasOnly([true])`).
  A key is a field name, capped by Firestore at 1,500 bytes, and only the host
  can write it — the same trust as the room's `questions`. Recorded, not fixed.

## The story

> **As the quizmaster**, I want to load unfinished features into one round,
> and have the room tell me straight after whether to keep them, **so that** the
> office tries more things per week and each one gets a verdict from the people
> who played it, not from me guessing.
>
> **As Greg**, I want every error a player sees to be written down where I can
> read it, **so that** I hear about a broken round from the data, not from the
> office.

## Acceptance criteria

### A. Error beacon

- **A1.** Every message the app puts in `.notice` writes one document to
  `clientErrors/`: the room's `problem` (which carries `report()`), and the
  "Cannot reach the server" screen. So do uncaught errors and unhandled
  promise rejections on the page.
- **A2.** A document holds: `message` (≤ 300 chars), `source`
  (`notice` / `error` / `rejection`), `room` and `phase` when in a room,
  `gameId`, `build` (the bundle hash, `index-XXXX`), `device` (the class
  `q1Trace` uses), and `at` (server time). **No names, no answers, no uid** —
  in the body or the id (an auto-id).
- **A3.** At most 20 writes per page load, and one message at one room step is
  written once.
- **A4.** Rules: create only, signed in, `hasOnly` the fields above, each
  bounded, `at == request.time`. No read, update or delete from a client.
  One allow case on the client's own path, plus denies.
- **A5.** `npm run read-errors [-- --since 1d]` (Admin SDK) groups by message
  and room. 22 October would have read *8 × Missing or insufficient
  permissions · B498 · finished*.
- **A6.** A failed beacon write is dropped silently and never raises a notice.

### B. Shots

- **B1.** A shot is an entry in one registry, `src/engine/cannon.ts`: id
  (≤ 32 chars), title, one line of what it does. Off unless loaded.
- **B2.** In the lobby the quizmaster sees a **Slop Cannon** section under the
  round settings, listing every shot the kill switch allows, each unloaded.
  Nobody else sees the toggles; everyone sees which are loaded, on the
  standings between questions.
- **B3.** Stored on the room as `cannon: { [id]: true }`, set by the
  `selectPack` that starts the round and fixed for it, as `wagerEnabled` is.
- **B4.** The room rule: absent, or a map of ≤ 8 keys whose values are all
  `true`. Allow on the host's own write; deny on 9 keys and on a non-`true`.
- **B5.** The `games/` record keeps the `cannon` map when it is not empty, so
  `read-games` shows which shots were loaded.
- **B6.** With no shots registered the section does not render. v1 ships that
  way. Under the emulators only, one test shot (`test-shot`) is registered so
  e2e can drive the whole path.

### C. Kill switch

- **C1.** `config/cannon` holds `{ off: [ids] }`. Any id in it disappears from
  the lobby and is treated as unloaded by that device, **mid-round included**.
- **C2.** One read per page load, and none while no shot is registered.
  Readable by signed-in clients; written only by the Admin SDK.
- **C3.** If the read fails, every shot is treated as off. It fails safe.
- **C4.** `npm run cannon -- off <id>` / `on <id>`. Dry run by default, `--go`
  to write — the shape of `fold-votes`.

### D. Keep / Bin

- **D1.** On Final, after the podium lands, each shot that was loaded gets one
  row: its title, **Keep** and **Bin**. One tap, no change of mind.
- **D2.** Under the podium, never over it. It does not move the podium.
- **D3.** One document per player per shot per game, id
  `{gameId}_{shot}_{uid}`: as yourself only, create only, so once only.
  Delete your own, so `check-rules` leaves no litter.
- **D4.** `npm run read-cannon` prints per shot: rounds loaded, Keep, Bin, and
  how many players in those rounds did not vote.

### E. Keep / Bin on new lobby modes — APPROVED and built 26 October 2026

Added 26 October 2026. Greg: *"Extend Keep/Bin on Final to the New-stickered
lobby modes played that round … Story and ACs first."* With nothing loaded,
D never asks anything. The modes the office has just been given are what
want a verdict.

> **As Greg**, I want the room to Keep or Bin a new lobby mode straight after
> playing it, **so that** each one is judged by the people who played it while
> it is still new, not by me guessing from `read-games`.

- **E1.** A mode is asked about when the round was played with it **and** it
  wore its New sticker (`MODE_NEW_UNTIL`) on the day the round started. On
  26 October that is **Mr Fries** (to 5 Nov) and **The Double** (to 8 Nov).
  Once a sticker comes off, the question stops asking, with no other switch.
- **E2.** Decided once, by the quizmaster's device, in the `selectPack` that
  starts the round: each such mode goes into the room's `cannon` map as
  `mode-<id>` (`mode-chaser`, `mode-double`) beside any loaded shot. Every
  device then asks the same thing, a stale clock elsewhere cannot change it,
  and the room rule, the kept round (B5), the verdict rule (D3) and
  `read-cannon` (D4) need **no change**. Shots go in first, so the ≤ 8 bound
  never drops one.
- **E3.** What counts as played, from the room's flags: `chaserEnabled`,
  `doubleEnabled`, `standoffEnabled`, `wagerEnabled` (stakes),
  `stealEnabled`, `jigsawEnabled`. **Not the Ladder**: nothing persists a
  level, and its sticker came off on 15 August.
- **E4.** **The Double is asked once, at the end of the morning.** Round one's
  half-time Final does not ask about it; round two's does. Other modes are
  asked in each round that used them.
- **E5.** On Final each one gets a row like a shot's (D1–D2): its lobby name
  (*Against Mr Fries*, *The Double*), **Keep**, **Bin**, under the podium,
  one tap. The standings line (B2) names **shots only**. A mode is already on
  screen, and "Slop Cannon: Against Mr Fries" would call a finished feature
  slop.
- **E6.** The kill switch does not apply to modes. It cannot turn Mr Fries
  off, so `npm run cannon -- off mode-chaser` is refused with a message
  saying why.
- **E7.** e2e: a round with Mr Fries on asks, and `cannon` holds
  `mode-chaser`; one without asks nothing; the half-time Final of a double
  does not ask about the Double, and round two's does. Unit: the date
  boundary (5 Nov asks, 6 Nov does not).

**This makes #154 player-visible.** Keep/Bin shows up on the Final of any round
with Mr Fries or The Double from the day it ships, so #154 is no longer dark.
It needs a What's new line, e.g. *"Played Mr Fries or The Double? Tell us
Keep or Bin at the end."*

**Approved 26 Oct**, Greg: *"Approve E1–E7 as recommended: modes only, not packs; lobby names under a "New this round · keep it?" eyebrow."* Built in `be3371d`.
**Evidence:** `e2e/slop-cannon.spec.ts` 7/7 (a shot plus Mr Fries asks both, in order, and both verdicts and `games/.cannon` land; a plain half-time asks nothing; round two asks about the Double). Full e2e 41/41 (24.9 min) after the change, `host-writes` golden included. Unit 2,125. **Not covered by e2e after 8 Nov:** the mode assertions follow today's sticker dates, so after the stickers come off they prove "nothing asked"; the unit tests hold the boundary. Gallery: three new entries at `#/preview`.

| Was open — decided as recommended | Recommendation |
|---|---|
| Approve E1–E7 | — |
| New **packs** too (6 stickered today: Random, Name the Artist, The Price is Right, Survey Says, Theme Tunes, Higher or Lower)? | **Not now.** Questions already get Good/Rubbish at each reveal, and a pack verdict asked at the end of a round that *was* that pack measures the round as much as the pack. Revisit if modes produce useful verdicts |
| Wording on Final | Rows show the lobby name only. The eyebrow becomes **"New this round · keep it?"** for every row: "Slop Cannon" over Mr Fries has E5's problem |

### F. The cannon fires — DRAFT, for Greg's approval

Greg, 26 Oct: *"a cannon boom and a paper burst when the Keep/Bin panel
arrives on Final, within the flash rule."*

**The clash, read in `Final.tsx`:** the panel arrives 300 ms after the winner's
riser lands, which is when the fanfare (1.45 s) plays and the podium confetti
fires from both bottom corners (3.6 s). A boom and a burst at that moment would
step on the winner. So F fires **after the fanfare**, not on arrival.

> **As the room**, I want the Keep / Bin panel to go off like a cannon when it
> arrives, **so that** the verdict feels like part of the show and gets tapped,
> not scrolled past.

- **F1. When.** Once, 1.6 s after the fanfare starts (it ends at 1.45 s), and
  only on a Final that has rows. Not on coming back from the season table
  (the `builtPodiums` rule), and not on a Final with no podium.
- **F2. Off-screen.** If the panel is not in the viewport at that moment
  (a phone still on the podium), it fires the first time the panel scrolls
  into view, at most once.
- **F3. The boom.** A new synth cue, `cannon`: a sub thump falling to ~40 Hz,
  a short filtered crack, ≤ 0.6 s, quieter than the fanfare. Built like
  `shatter`, no audio file. Silent when muted, as every cue is.
- **F4. The burst.** About 60 pieces of paper from **one** cannon at the
  panel's left edge, up and to the right, in the house colours, cleared within
  2.5 s. It reuses the Confetti canvas (`pointer-events: none`, fixed, never
  over a button). What tells it apart from the podium confetti is where it
  starts and how small it is.
- **F5. The flash rule** ([`lighting.md`](lighting.md)). No muzzle flash:
  nothing on the page brightens and darkens. The only "smoke" is a grey puff
  at the cannon's mouth that **fades** over ≥ 500 ms. No full-screen change.
- **F6. Reduced motion** fires no burst and no puff, as the podium confetti
  already does not. The boom still plays: it is sound, not motion.
- **F7. Evidence.** Unit: the timing (F1, F6) as a pure function; the cue
  exists and is shorter than 0.6 s. Gallery: the `Final · Keep or Bin` entry
  fires it, so it can be watched at `#/preview`. A screen recording of one
  firing for Greg, since a screenshot cannot show a boom.

Cost: no reads, no writes, a few kB. What's new: none needed beyond E's line.

| Open — Greg to decide | Recommendation |
|---|---|
| Approve F1–F7 | — |
| When: after the fanfare (F1), or **on the Keep tap**, with a Bin a fizzled dud | **After the fanfare**, as asked. The tap version is the better joke, but it fires once per person rather than once for the room |
| Fire for shots only, or for modes too (Mr Fries)? | **Both**: the panel is one panel |

## Cost

Beacon: zero writes on a healthy round. Cannon dark: zero. Loaded: one read per
page load plus ≤ players × shots verdict writes a round. Well inside the free
tier ([`cost.md`](cost.md)).

## Known and accepted

- A beacon cannot report what stops it writing: signed out, App Check refused,
  offline. 22 October's failure was a rules refusal on another path, which it
  would have caught.
- `check-rules`'s beacon allow case leaves one `clientErrors` row per run
  (no uid, so no client delete). `read-errors` skips and counts them.
- A verdict is self-reported, as a question vote is. Nothing checks the voter
  was in the round; a `get()` on `games/` per vote is not worth it.

## Evidence (26 October 2026, branch `slop-cannon` off `d74e581`)

- **`e2e/slop-cannon.spec.ts`, 6/6 on the new rules; 6/6 FAIL on master's
  rules** (same spec, `firestore.rules` swapped for `origin/master`'s, then
  restored). Each failed where it should: the three allow cases refused
  ("No matching allow statements"), C2's read refused, B4 on the nine-key deny
  (old rules let it through), and the browser path at the lobby — the refused
  kill-switch read hid the section, which is C3 failing safe.
- The browser case plays a real 10-question round in two tabs: Test shot loaded
  by the host and not shown to the member; `rooms/{code}.cannon` set; the
  standings name it on the member's screen; Keep and Bin rows sit below the
  podium's bottom edge and lose their buttons after one tap; both verdicts and
  `games/{id}.cannon` land; a dispatched `ErrorEvent` on Final lands one
  `clientErrors` row with room, phase, gameId and `build: index-…`.
- **Full e2e locally: 40/40** (20.2 min, every spec incl. `host-writes` golden — an ordinary round writes no `cannon`).
- **`check-rules` live, before publish: 143 PASS, 4 FAIL** — exactly the four
  new allow cases (beacon row, kill-switch read, Keep, a round with a shot).
  The four new denies pass vacuously until then. After the merge it must read
  **147/0**; until it does, the denies prove nothing.
- Unit: 2,118 / 2,118, new files `clientError`, `cannon`, `error-report`,
  `cannon-report`, plus the game record's. Typecheck clean; changed files lint
  clean (the whole-repo `npm run lint` fails on stale `.claude/worktrees`, as
  on 22 October — not this change).

**Not covered:** the room rule in `check-rules` (the probe room is not hosted
by the checker's uid; e2e covers B4). `read-errors`, `read-cannon` and
`cannon` have not been run against live — they need the service account.
`read-cannon`'s `orderBy('cannon')` is unproved until a round carries a shot.
