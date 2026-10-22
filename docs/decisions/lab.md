# The Lab — story and acceptance criteria

> **Owner: Greg Rothwell. Last updated: 22 October 2026. Budget: 250 lines.**

**Status: DRAFT for Greg's approval. Nothing built.** Item 3 of the sequence in
[`direction-oct-2026.md`](direction-oct-2026.md#3-beta-testing--more-from-the-office).
Every claim about the code below was read on `74fd345`, 22 October 2026.

## Why now, and why the order changed

The direction review listed seven Lab parts, the error beacon fifth. **Today
moves it to first.** On 22 October no round banked for anybody, and every
device knew: each one showed "Missing or insufficient permissions" over the
podium ([`finals-history.md`](finals-history.md#22-october-2026-nobodys-round-banked)).
We found out because Greg was in the room. A beacon would have put eight
identical refusals in Firestore within a minute of the first podium.

## Cut to essentials (PLAN steps 1–2)

| Part (direction review §3) | v1? | Why |
|---|---|---|
| 5. Error beacon, `clientErrors/` | **Yes, first** | Today's failure was on every screen and nowhere else |
| 1. Lab switches per room | **Yes** | The thing the Lab is |
| 2. Kill switch, `config/lab` | **Yes** | A switch that needs a deploy to turn off is not a switch |
| 3. Keep / Bin verdict on Final | **Yes** | Without a verdict a trial is just a feature |
| `read-lab` script | **Yes** | The verdicts are worthless unread |
| 4. Round-health beacon (q1Trace for every question) | **No — later** | ~N writes a question, so ~N×Q a round. `read-traces` already answers Q1; widen only when a question it can't answer comes up |
| 6. Run sheet (Q5 handover, two squads, review panel, 30 players) | **No — it is not code** | A list for a Friday. It can live in this file once there is a Lab to run it in |

Deleted: 2 of 7 (~30%). Nothing in v1 has an item to ship behind it yet — the
first Lab item is the first Wow (Survey Says), which has its own story.

## The story

> **As the quizmaster**, I want to turn on unfinished features for one round,
> and have the room tell me straight after whether to keep them, **so that** the
> office tries more things per week and each one gets a verdict from the people
> who played it, not from me guessing.
>
> **As Greg**, I want every error a player sees to be written down where I can
> read it, **so that** I hear about a broken round from the data, not from the
> office.

## Acceptance criteria

### A. Error beacon

- **A1.** Every message the app puts in `.notice` (`report()` in `App.tsx`)
  writes one document to `clientErrors/`. So do uncaught errors and unhandled
  promise rejections on the page.
- **A2.** A document holds: the message (≤300 chars), where it came from
  (`report` / `error` / `rejection`), the room code and phase if in a room, the
  gameId, the build hash, the device class `q1Trace` already uses, and a
  server timestamp. **No names, no answers, no uid in the body.**
  The document id carries no uid either.
- **A3.** At most 20 writes per page load, and the same message from the same
  step is written once. A retry loop cannot turn into a write storm.
- **A4.** Rules: create only, signed in, `hasOnly` the fields above, every
  field bounded, `at == request.time`. No read, update or delete from any
  client. **One allow case** on the client's own write path, plus deny cases;
  the allow case fails before the rule is published and passes after.
- **A5.** `npm run read-errors [-- --since 1d]` (Admin SDK) groups by message
  and room. Today's failure would have read: *8 × Missing or insufficient
  permissions · B498 · finished*.
- **A6.** A beacon write that fails is dropped silently — it must never itself
  raise a notice. (The one place an empty catch is right; it gets a comment
  saying so.)

### B. Lab switches

- **B1.** A Lab item is an entry in one registry in `src/engine/lab.ts`: id,
  title, one line of what it does, and whether it is on by default (always no).
- **B2.** In the lobby, the quizmaster sees a **Lab** section under the round
  settings, listing every item the kill switch allows, each off. Nobody else
  sees the toggles; everyone sees which are on.
- **B3.** The choice is stored on the room as `lab: { [id]: true }`, set before
  the round starts and fixed for it, the same way `wagerEnabled` is.
- **B4.** The room rule bounds it: a map of at most 8 keys, each id ≤32 chars,
  each value `true`. Allow case on the quizmaster's own write, deny on an
  oversized map and a non-boolean. (S2 on 22 October was exactly this gap.)
- **B5.** The `games/` record keeps the `lab` map, so `read-games` shows which
  items were on in each round.
- **B6.** With no items registered, the Lab section does not render. v1 ships
  that way: the machinery is live and dark.

### C. Kill switch

- **C1.** `config/lab` holds `{ off: [ids] }`. Any id in it disappears from the
  lobby and is treated as off by every client, **including mid-round**.
- **C2.** One read per page load. It is world-readable to signed-in clients and
  writable by nobody but the Admin SDK.
- **C3.** If the read fails, every Lab item is treated as off. A broken switch
  fails safe.
- **C4.** `npm run lab-off -- <id>` / `lab-on` writes it. Dry run by default,
  `--go` to write — same shape as `fold-votes`.

### D. Keep / Bin verdict

- **D1.** On Final, once the podium has landed, each Lab item that was on gets
  one row: its title and two buttons, **Keep** and **Bin**. One tap each, no
  change of mind, shaped like the question votes.
- **D2.** Under the podium, never over it. It does not move the podium.
  (Today's judder came from something being inserted above it.)
- **D3.** Stored one document per player per item per game; a player can vote
  only as themselves and only once.
- **D4.** `npm run read-lab` prints per item: rounds it was on, Keep, Bin, and
  how many players didn't vote.

## Cost

Beacon: zero writes on a healthy round. Today's round: 8. Lab: one extra read
per page load (`config/lab`), plus ≤ players × items verdict writes per round.
Well inside the free tier ([`cost.md`](cost.md)).

## Order of build

A first (A1–A6), as its own PR: it is useful the day it ships, with no Lab
item needed. Then B + C together, then D. Each is a PR players won't notice
until an item exists, so each carries `What's new: none — <why>` except A,
which also needs none (players see nothing).

## Open — Greg to decide

| Decision | Owner |
|---|---|
| Approve the story, the cut (no round-health beacon, run sheet not code) and the order (beacon first) | Greg |
| Who sees the Lab toggles: quizmaster only (as drafted), or the whole room votes them on | Greg |
| Verdict: Keep / Bin only (as drafted), or a third "Not sure" | Greg |
| Whether today's two unbanked rounds are banked from `games/` (separate from this) | Greg |
