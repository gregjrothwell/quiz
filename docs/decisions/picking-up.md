# Picking this up — Cursor or a fresh session

> **Owner: Greg Rothwell. Last updated: 10 September 2026. Budget: 250 lines.**

Split out of [`what-to-build-next.md`](what-to-build-next.md) on 10 September
2026, which went over its 250-line budget when the picture-round and `elapsedMs`
corrections landed. **The text below is unchanged**; only where it lives is. It
was never really "what to build next" — it is how to start a session, which is a
different question and gets read at a different time.

Its dated state is 8 September and has not been re-verified. Where it disagrees
with [`../HANDOVER.md`](../HANDOVER.md), the handover wins.

**Written to be self-contained.** Cursor gets `AGENTS.md` and
`~/clawd/context/standards/`; it does **not** get `CLAUDE.md` or
`MEMORY-PROTOCOL.md`, so anything only those say is repeated here.

### State on 8 September 2026

Live is `index-B3Tfo0Nu` — `firstMs` and the pack picker, both **unplayed with
people**. Master is green: 675 tests, `check-rules` 58/58. Nothing below is
started. This file is on `next-three-research`, [PR #31](https://github.com/gregjrothwell/quiz/pull/31),
unmerged.

### The build, in order

1. **`src/engine/gameLog.ts`** — fold a finished round into a `GameRecord`. Pure
   TS, no React, no Firebase, tested offline like the rest of `src/engine/`.
2. **`useRoom`** — accumulate each question's result in a **ref** as its reveal
   lands, and write once when the room reaches `finished`. Quizmaster only, so
   several clients cannot race the same write; that is where `recordGame`
   already runs. A ref, not state: nothing renders from it.
3. **`firestore.rules`** — `match /games/{gameId}`: `create` only, no `update`,
   `read: if false`. Bound the document. **This is a paste.**
4. **`scripts/check-rules.ts`** — one allow, two deny. The allow flipping is the
   only thing that proves the paste landed; deny cases pass vacuously until the
   rule exists and mean nothing before then.
5. **`npm run read-games`** — an Admin SDK query. **Do not skip it.** Writing
   data nothing reads back is how the vault got to 13,712 answers that no
   command could answer a question about.

### Order of operations, and it is not optional

**Paste the rules, run `check-rules`, then deploy.** A client writing to a
collection the published rules have never heard of has every write refused. The
same ordering as `firstMs` on 8 September — see
[`first-touch.md`](first-touch.md).

### Five things that will bite

1. **`games/` must be top-level, never `rooms/{code}/games`.** Every client holds
   an unfiltered listener on the room's subcollections, so an in-room collection
   adds a second `Q·N²` term to the read cost of every game
   ([`cost.md`](cost.md)). This is the whole reason the design is what it is.
2. **The repo copy of `firestore.rules` is not what Firebase is running.** It is
   pasted by hand. `npm run check-rules` is the only thing that knows.
3. **Nothing in `scripts/` may import `src/firebase.ts`**, at any depth — it
   reads `import.meta.env`, which Node does not define, and the script dies
   before its own code runs. `scripts/imports.test.ts` fails if it comes back.
4. **Any A/B variant must be derived, not stored** — `hash(gameId + question.id)`
   — so every device computes the same one. The reveal has to stay a pure
   function of what every client already holds ([`scoring.md`](scoring.md) AC#6).
   A variant that differs per device scores the room differently on each screen.
5. **Doc budgets are enforced by a session hook**, and over budget means *split*,
   not tidy: `HANDOVER.md` 150, `TOTAL-RECALL.md` 300, each file in
   `decisions/` 250, `AGENTS.md` 80.

### Verify

`npm run typecheck && npm run lint && npm test`, then `npm run check-rules`
after the paste, then `npm run sync-harness 10` because this touches the end of
a round.

### Where to write things down

Session log is `~/clawd/memory/YYYY-MM-DD.md`, append-only, one file a day,
tagged `[cursor]` or `[cc]` so a double-write is visible. Living state goes in
`docs/HANDOVER.md`, the dated spine in `docs/TOTAL-RECALL.md`, depth in
`docs/decisions/<topic>.md`. **Branch, never commit to master, and never push
without Greg saying so in words.**
