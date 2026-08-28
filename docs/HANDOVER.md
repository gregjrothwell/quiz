# Handover — Vibe Quiz

> **Owner: Greg Rothwell. Last updated: 20 August 2026. Budget: 150 lines.**

Real-time office quiz. Static site on GitHub Pages, Firebase for live rooms.
Built to replace Polly in Teams.

- **Live:** https://gregjrothwell.github.io/quiz/
- **Repo:** https://github.com/gregjrothwell/quiz (public, `master`, deploys from `gh-pages`)
- **Firebase project:** `quiz-d686e` (Firestore + Realtime Database in europe-west1 + Anonymous auth)

**This file is the way in, not the record.** It was 2,422 lines until 20 August
2026 — more to read than the codebase it describes. The depth moved into
`decisions/`, the dated spine is `TOTAL-RECALL.md`, and the session-start hook
says so if this one grows again.

## Read this before changing

| If you're changing | Read |
|---|---|
| the vault, reveals, answer secrecy, **when a client may ask** | [`decisions/vault.md`](decisions/vault.md) |
| the answer window or its rules | [`decisions/answer-window.md`](decisions/answer-window.md) |
| the season table, squads, weekly boards, `recordGame`, anything called `team` | [`decisions/season.md`](decisions/season.md) |
| the opening titles, honours, rosettes | [`decisions/form-and-awards.md`](decisions/form-and-awards.md) |
| `playerId`, recovery codes, claiming | [`decisions/identity.md`](decisions/identity.md) |
| the clock, timing, the countdown | [`decisions/clock.md`](decisions/clock.md) |
| joining, room codes, links, presence | [`decisions/joining.md`](decisions/joining.md) |
| scoring an answer that lands late | [`decisions/late-answers.md`](decisions/late-answers.md) |
| the review panel or the replay | [`decisions/review-replay.md`](decisions/review-replay.md) |
| packs, harvesting, classification | [`decisions/questions.md`](decisions/questions.md) |
| rules, App Check on Firestore and the RTDB, anything security-shaped | [`decisions/security.md`](decisions/security.md) |
| App Check on **authentication** specifically | [`decisions/app-check-auth.md`](decisions/app-check-auth.md) |
| anything that adds reads or writes | [`decisions/cost.md`](decisions/cost.md) |
| — before assuming a thing is a style choice | [`decisions/gotchas.md`](decisions/gotchas.md) |
| — before trusting a claim in here | [`decisions/state-of-play.md`](decisions/state-of-play.md) |
| what a question is worth, and why it is not a speed curve | [`decisions/scoring.md`](decisions/scoring.md) |
| the countdown, and whose clock it runs on | [`decisions/shared-clock.md`](decisions/shared-clock.md) |
| the shareable result card, and how it gets to the player | [`decisions/final-card.md`](decisions/final-card.md) |
| what to build next, and what each idea costs | [`decisions/ideas-review.md`](decisions/ideas-review.md) |

## State as of 20 August 2026

**Shipped and played.** 448 tests, clean types and lint, no `any` or `@ts-ignore`.

- **Squads, the weekly board, the average season table, the frozen podium and
  the sealed question text are live** (deployed 20 August, [PR #2](https://github.com/gregjrothwell/quiz/pull/2)).
- **The answer vault is live**: 13,593 answers, both rulesets published.
- **App Check enforces on Cloud Firestore, the Realtime Database and
  authentication**; `appcheck-probe` refuses at sign-in, which is the proof.
  [`decisions/app-check-auth.md`](decisions/app-check-auth.md).
- **The reveal lands on its own, ~0.5s after the clock**, anchored on the
  server-confirmed snapshot; `reveal-probe` is the instrument:
  [`decisions/vault.md`](decisions/vault.md#the-gate-had-no-margin-and-the-host-was-the-one-who-paid).
- **Scoring is a rank bonus, not a speed curve** — 500 for correct plus
  500/400/300/200/100 by the order the correct answers landed. No rules change.
  **Live since 20 August** ([PR #6](https://github.com/gregjrothwell/quiz/pull/6)).
  Scored in a live room, but **ranking itself is still unproven** — ranks need
  two answerers: [`decisions/scoring.md`](decisions/scoring.md).
- **The final screen makes a shareable PNG of the round**, chair and all. **Live
  since 20 August** ([PR #7](https://github.com/gregjrothwell/quiz/pull/7)):
  [`decisions/final-card.md`](decisions/final-card.md).
- **Every device counts the same window from the same origin**, corrected for
  its own clock offset. **Live since 28 August**
  ([PR #8](https://github.com/gregjrothwell/quiz/pull/8)), and **played** the
  same day — `CORRECT · +1,000` at 10.6s in the browser against
  `scored: ClockTest +1000` in the terminal, the two agreeing being the point:
  [`decisions/shared-clock.md`](decisions/shared-clock.md).
- **A join link goes straight into the room** when the browser already knows its
  name — a returning player's press on a screen that knew both answers. Built,
  **not deployed**: [`decisions/joining.md`](decisions/joining.md).
- **`npm run host-room` scores a real answer now** — it never read the answers
  subcollection, so every reveal it folded scored nobody.

**Measured live, 20 August 2026** (`npm run take-stock`):

| | |
|---|---|
| rooms | 25 — one predates `expiresAt`, unreachable by any TTL policy. Was 12 this morning; the reveal-gate probes and a browser round made the rest, all with `expiresAt` |
| vault answers | 13,593 |
| `season-2` players | 21 |
| `season-1` / `week-2026-W34` | 4 / 4 — **neither was being reported until today.** `take-stock` held its own `season-2` and counted nothing else, so every weekly bucket was invisible from the day weekly boards shipped. It now enumerates instead of naming |
| recovery codes / identity claims | **0 / 0** — nobody has ever used the feature |

> **Correction.** This table also listed `rules-check` at 3 and called it the
> preflight "leaving three rows on every run". **It was not** — counted, ran
> `check-rules` three more times, still 3. Those predated the cleanup and no
> client could remove them. Swept with `prune-rooms -- --probe-rows --go`.

> **Correction, 20 August 2026.** This file previously said both "leaving 3
> rooms" (15 August, after the prune) and "79 rooms are still there" in the
> security section. The second was written *before* the prune ran and never
> updated; the first was right. Settled by measurement, not by reasoning — 12
> rooms today is 3 plus the rounds played since. Both stale readings are left
> visible in [`decisions/security.md`](decisions/security.md) rather than edited
> away.

## Outstanding

1. **A quizmaster dropping out mid-round** still needs a browser plus
   `host-room`. Keyboard shortcuts cleared 28 August.
2. **No Content-Security-Policy.** Deliberate: a `<meta http-equiv>` CSP breaks
   the live app silently and the stale CDN makes that painful to diagnose.
3. **Nothing needing a second person has been tested** — the review panel, a real
   quizmaster handover, two squads on one board, and **a rank bonus with more
   than one right answer in it**. The **anonymous-account purge is reviewed and
   the answer is don't**: [`decisions/identity.md`](decisions/identity.md).
4. **A reload drops you out of the room**, back to the landing screen — `code` is
   React state in `useRoom` and nothing persists it. Found 28 August, pre-existing,
   undecided.

## Where things are

```
src/engine/     Pure TS game rules — no React, no Firebase. All the logic worth testing.
src/lib/        Firebase wiring (useRoom), pack loading, the question clock, the house audio,
                and the remembered name — the one other thing kept in localStorage besides
                the sound preference, and written to the same pattern.
src/screens/    One component per phase + a design gallery (Preview).
src/questions/  Pack types and the classification rules, with tests.
src/design/     One stylesheet, design tokens at the top.
scripts/        Build-time question harvest, and the multi-client test harnesses.
docs/decisions/ One subsystem each. Reached from the table above.
```

Commands: `npm run dev` (serves at `/quiz/`, port 5273), `test`, `typecheck`, `lint`,
`build`, `deploy`, `fetch-questions [-- --resort]`, `fetch-otqa`, `seed-vault`,
`check-rules`, `sync-harness [n]`, `host-room [-- secs]`, `reveal-probe [-- secs offsetMs]`,
`take-stock`, `prune-rooms [-- --probe-rows --go]`.

`npm test` covers `src/` plus the pure parts of `scripts/` — the OpenTriviaQA
parser and its encoding fallback, which corrupt questions silently when wrong.
Anything under `scripts/` that touches the network or the live project stays out
of the suite deliberately; `npm test` must keep running offline.

## If you're picking this up cold

Fastest way to be useful: `npm run check-rules`, then `npm run sync-harness 10`.
Between them they confirm the rules are published and that ten clients stay in
sync — the two things that have actually broken in play.

A solo round in the browser is what is left, and it does more than it sounds: it
is what proved `recordGame` against the live project on 19 August, including the
repeat-write guard across a reload.

Two things that have bitten more than once, both with their own file: **the rules
are published by hand**, so the repo copy is not what Firebase is running
([`decisions/security.md`](decisions/security.md)); and **the answer window lives
in `firestore.rules` as well as the client**, where two of the three rules exist
to close holes that are not obvious from the client side
([`decisions/answer-window.md`](decisions/answer-window.md)).
