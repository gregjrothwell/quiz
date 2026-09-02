# Handover — Vibe Quiz

> **Owner: Greg Rothwell. Last updated: 2 September 2026. Budget: 150 lines.**

Real-time office quiz. Static site on GitHub Pages, Firebase for live rooms.
Built to replace Polly in Teams.

- **Live:** https://gregjrothwell.github.io/quiz/
- **Repo:** https://github.com/gregjrothwell/quiz (public, `master`, deploys from `gh-pages`)
- **Firebase project:** `quiz-d686e` (Firestore + Realtime Database in europe-west1 + Anonymous auth)

**This file is the way in, not the record.** It was 2,422 lines until 20 August
2026 — more to read than the codebase it describes. Depth is in `decisions/`, the
dated spine is `TOTAL-RECALL.md` (older half in [`recall/`](recall/)), and the
hook says so if this one grows.

## Read this before changing

| If you're changing | Read |
|---|---|
| repeats, the question history, why a level was withdrawn | [`decisions/repeats.md`](decisions/repeats.md) |
| staking points on the last question | [`decisions/wager.md`](decisions/wager.md) |
| the vault, reveals, answer secrecy, **when a client may ask** | [`decisions/vault.md`](decisions/vault.md) |
| the answer window or its rules | [`decisions/answer-window.md`](decisions/answer-window.md) |
| the season table, squads, weekly boards, `recordGame`, anything called `team` | [`decisions/season.md`](decisions/season.md) |
| squads **during** the round | [`decisions/live-squads.md`](decisions/live-squads.md) |
| the opening titles, honours, rosettes | [`decisions/form-and-awards.md`](decisions/form-and-awards.md) |
| `playerId`, recovery codes, claiming | [`decisions/identity.md`](decisions/identity.md) |
| the clock, timing, the countdown | [`decisions/clock.md`](decisions/clock.md) |
| joining, room codes, links, presence | [`decisions/joining.md`](decisions/joining.md) |
| scoring an answer that lands late | [`decisions/late-answers.md`](decisions/late-answers.md) |
| the review panel or the replay | [`decisions/review-replay.md`](decisions/review-replay.md) |
| packs, harvesting, classification | [`decisions/questions.md`](decisions/questions.md) |
| voting on a question, retiring one | [`decisions/question-votes.md`](decisions/question-votes.md) |
| rules, App Check on Firestore and the RTDB, anything security-shaped | [`decisions/security.md`](decisions/security.md) |
| App Check on **authentication** specifically | [`decisions/app-check-auth.md`](decisions/app-check-auth.md) |
| anything that adds reads or writes | [`decisions/cost.md`](decisions/cost.md) |
| — before assuming a thing is a style choice | [`decisions/gotchas.md`](decisions/gotchas.md) |
| — before trusting a claim in here | [`decisions/state-of-play.md`](decisions/state-of-play.md) |
| — before assuming a behaviour is a bug | [`decisions/known-limits.md`](decisions/known-limits.md) |
| what a question is worth, and why it is not a speed curve | [`decisions/scoring.md`](decisions/scoring.md) |
| the countdown, and whose clock it runs on | [`decisions/shared-clock.md`](decisions/shared-clock.md) |
| the shareable result card, and how it gets to the player | [`decisions/final-card.md`](decisions/final-card.md) |
| what to build next, and what each idea costs | [`decisions/ideas-review.md`](decisions/ideas-review.md) |
| whether an idea was already turned down | [`decisions/scope.md`](decisions/scope.md) |
| upgrading anything in `package.json` | [`decisions/dependencies.md`](decisions/dependencies.md) |
| the studio set, or any lighting cue | [`decisions/lighting.md`](decisions/lighting.md) |

## State as of 2 September 2026

**Shipped and played.** 525 tests on `fix-repeat-questions`, 529 on
`final-question-wager`; clean types and lint, no `any` or `@ts-ignore`.

- **Squads, weekly boards, the average table, the frozen podium and the sealed
  question text are live** (20 August, [PR #2](https://github.com/gregjrothwell/quiz/pull/2)),
  and **the answer vault** with them: 13,593 answers, both rulesets published.
- **App Check enforces on Firestore, the RTDB and auth**; `appcheck-probe` refuses
  at sign-in, which is the proof: [`decisions/app-check-auth.md`](decisions/app-check-auth.md).
- **The reveal lands on its own, ~0.5s after the clock**, on the server-confirmed
  snapshot; `reveal-probe` is the instrument: [`decisions/vault.md`](decisions/vault.md#the-gate-had-no-margin-and-the-host-was-the-one-who-paid).
- **Scoring is a rank bonus, not a speed curve** — 500 for correct plus
  500/400/300/200/100 by the order the answers landed. **Live since 20 August**
  ([PR #6](https://github.com/gregjrothwell/quiz/pull/6)); scored in a live room,
  but **ranking is still unproven** — that needs two answerers:
  [`decisions/scoring.md`](decisions/scoring.md).
- **The final screen makes a shareable PNG of the round.** Live since 20 August
  ([PR #7](https://github.com/gregjrothwell/quiz/pull/7)): [`decisions/final-card.md`](decisions/final-card.md).
- **Live since 28 August**, each proved on the deployed site and each with its
  own file: the **shared clock** ([`shared-clock.md`](decisions/shared-clock.md)),
  **live squad scoring** on points ÷ headcount ([`live-squads.md`](decisions/live-squads.md)),
  **voting a question out** ([`question-votes.md`](decisions/question-votes.md)),
  and **a join link going straight into the room** ([`joining.md`](decisions/joining.md)).
- **`npm run host-room` scores a real answer now** — it never read the answers
  subcollection, so every reveal it folded scored nobody.

- **The verdict pills, the operated lighting rig and the dependency pass all
  merged and deployed** — `origin/gh-pages` was rebuilt 49 seconds after the
  merge. This block said "on a branch and not deployed" until 2 September;
  corrected by checking the branches rather than the prose.

**On a branch, not merged and not deployed** (2 September):

- **The repeats are fixed**: a failed history read can no longer wipe the
  history, and Gentle and Fiendish are withdrawn because the corpus cannot fill
  them. Branch `fix-repeat-questions`: [`decisions/repeats.md`](decisions/repeats.md).
- **The last question can be played for stakes**, at zero extra reads and writes.
  **Wants `firestore.rules` pasting first.** Branch `final-question-wager`:
  [`decisions/wager.md`](decisions/wager.md).

**What is actually in the project right now** — counts, the two slow leaks, and the
two corrections that came out of miscounting them: [`decisions/cost.md`](decisions/cost.md#measured-live-28-august-2026).

## Outstanding

1. **A quizmaster dropping out mid-round** needs a browser and `host-room`.
2. **No Content-Security-Policy.** Deliberate: a `<meta http-equiv>` CSP breaks
   the live app silently and the stale CDN makes it painful to diagnose.
3. **Nothing needing a second person has been tested** — the review panel, a real
   quizmaster handover, two squads on one board, and **a rank bonus with more than
   one right answer in it**. Keyboard shortcuts cleared 28 August. The
   **anonymous-account purge is reviewed and the answer is don't**:
   [`decisions/identity.md`](decisions/identity.md).
4. ~~**A reload drops you out of the room.**~~ **Fixed and live, 28 August**,
   verified on production: [`decisions/joining.md`](decisions/joining.md).
5. ~~**Two colour tokens fail WCAG AA.**~~ **Fixed and live**, `5d36bf3`:
   `--ink-dim` is `#7a96bc` and `--cyan-dim` `#159fcc`, clearing 4.5 on all three
   surfaces (worst case 4.95, against 3.27 before). Listed as open here until
   2 September, a week after the fix shipped.
6. **The Ladder stops climbing** once a pack's thin `easy` or `hard` bucket is
   spent — it substitutes medium rather than repeating, which is the right
   trade but is not what the tile promises. Measured over six rounds against the
   live history; the fix is the `stats/{questionId}` counters, not selection.

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

Commands: `dev` (port 5273), `test`, `typecheck`, `lint`, `build`, `deploy`,
`fetch-questions [-- --resort]`, `fetch-otqa`, `seed-vault`, `check-rules`,
`sync-harness [n]`, `host-room [-- secs]`, `reveal-probe`, `asked-probe`,
`take-stock`, `prune-rooms [-- --probe-rows --go]`, `fold-votes [-- --go]`.

`npm test` covers `src/` plus the pure parts of `scripts/`. Anything touching the
network or the live project stays out deliberately; it must keep running offline.

## If you're picking this up cold

Fastest way to be useful: `npm run check-rules`, then `npm run sync-harness 10`.
Between them they confirm the rules are published and that ten clients stay in
sync — the two things that have actually broken in play.

A solo round in the browser does more than it sounds: it proved `recordGame`
against the live project on 19 August, repeat-write guard and all.

Two things that have bitten more than once, both with their own file: **the rules
are published by hand**, so the repo copy is not what Firebase is running
([`decisions/security.md`](decisions/security.md)); and **the answer window lives
in `firestore.rules` as well as the client**, where two of the three rules exist
to close holes that are not obvious from the client side
([`decisions/answer-window.md`](decisions/answer-window.md)).
