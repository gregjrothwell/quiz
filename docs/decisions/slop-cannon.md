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
