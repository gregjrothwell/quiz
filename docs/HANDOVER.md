# Handover — Vibe Quiz

> **Owner: Greg Rothwell. Last updated: 20 August 2026. Budget: 150 lines.**

Real-time office quiz. Static site on GitHub Pages, Firebase for live rooms.
Built to replace Polly in Teams.

- **Live:** https://gregjrothwell.github.io/quiz/
- **Repo:** https://github.com/gregjrothwell/quiz (public, `master`, deploys from `gh-pages`)
- **Firebase project:** `quiz-d686e` (Firestore + Realtime Database in europe-west1 + Anonymous auth)

**This file is the way in, not the record.** It was 2,422 lines until 20 August
2026 and cost ~40,000 tokens to read at the start of every session — more than
the codebase it describes. The depth moved, unchanged, into `decisions/`; the
dated spine is `TOTAL-RECALL.md`. Keep this one short: that is the whole point of
it, and the session-start hook will say so if it grows.

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
| rules, App Check, anything security-shaped | [`decisions/security.md`](decisions/security.md) |
| anything that adds reads or writes | [`decisions/cost.md`](decisions/cost.md) |
| — before assuming a thing is a style choice | [`decisions/gotchas.md`](decisions/gotchas.md) |
| — before trusting a claim in here | [`decisions/state-of-play.md`](decisions/state-of-play.md) |

## State as of 20 August 2026

**Shipped and played.** 412 tests, clean types and lint, no `any` or `@ts-ignore`.
(This line said 397 until 20 August; it was one short even before the 14 added
with the reveal gate. Counted, not remembered: `npm test`.)

- **Squads, the weekly board, the average season table, the frozen podium and the
  sealed question text are live** ([PR #2](https://github.com/gregjrothwell/quiz/pull/2),
  merged and deployed 20 August). **The office has not yet played a real round on
  any of it.**
- **The answer vault is live and covers the packs.** 13,593 answers against the
  13,452 the packs need plus 4 harness entries. Both rulesets published, preflight
  passing. The surplus are orphans from earlier harvests — ids hash the question
  text, so a revised question leaves its old answer unread and harmless.
- **App Check enforces on Cloud Firestore and the Realtime Database** (16 and 20
  August), each proved in both directions. **Auth itself is still not
  enforced.** `npm run appcheck-probe` signs in unattested and reports what each
  product does — one command, any time:
  [`decisions/security.md`](decisions/security.md).
- **The reveal now lands on its own, ~0.5s after the clock.** It was a coin flip
  with about 7ms of margin, and the quizmaster's device was the one that lost it —
  latency compensation started their countdown a network hop before the server
  stamped `openedAt`. Anchored on the server-confirmed snapshot instead, which is
  provable rather than tuned. `npm run reveal-probe` is the instrument, and both
  it and `sync-harness 10` show the same +6ms/+85ms split:
  [`decisions/vault.md`](decisions/vault.md#the-gate-had-no-margin-and-the-host-was-the-one-who-paid).
- **`npm run host-room -- 10` works again** after being dead for weeks on an
  import outside Vite. `scripts/imports.test.ts` fails if it comes back.

**Measured live, 20 August 2026** (`npm run take-stock`):

| | |
|---|---|
| rooms | 12 — one predates `expiresAt` and no TTL policy can ever reach it |
| vault answers | 13,593 |
| `season-2` players | 21 |
| recovery codes / identity claims | **0 / 0** — nobody has ever used the feature |

> **Correction, 20 August 2026.** This file previously said both "leaving 3
> rooms" (15 August, after the prune) and "79 rooms are still there" in the
> security section. The second was written *before* the prune ran and never
> updated; the first was right. Settled by measurement, not by reasoning — 12
> rooms today is 3 plus the rounds played since. Both stale readings are left
> visible in [`decisions/security.md`](decisions/security.md) rather than edited
> away.

## Outstanding

1. **A real round on the new season work.** Played by the office on 20 August.
   What came back was the reveal delay below; nothing else has been reported yet,
   and nobody has been asked. **Ask before assuming it went otherwise fine.**
2. **Two paths still need a browser plus `host-room`:** a quizmaster dropping out
   mid-round, and the keyboard shortcuts in a live game. Both are reachable now
   that the harness runs.
3. **No Content-Security-Policy.** Deliberate — a `<meta http-equiv>` CSP breaks
   the live app silently and the stale-CDN window makes that painful to diagnose.
   Its own change, with a round of testing.
4. **App Check on authentication — enabled, but not doing anything.** Four
   `appcheck-probe` runs over 20 minutes all signed in unattested, while the
   docs say `SignUp` (which anonymous sign-in uses) is covered. Unresolved, and
   not to be reasoned away: [`decisions/security.md`](decisions/security.md).
   The **anonymous-account purge is reviewed and the recommendation is not to
   enable it** — it buys nothing on Spark and would orphan all 21 season rows,
   since nobody has claimed a recovery code:
   [`decisions/identity.md`](decisions/identity.md).
5. **Nothing needing a second person has been tested** — the review panel, a real
   quizmaster handover, two squads on one board.

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
`take-stock`, `prune-rooms`.

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
