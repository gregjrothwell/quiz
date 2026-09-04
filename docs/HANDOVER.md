# Handover — Vibe Quiz

> **Owner: Greg Rothwell. Last updated: 4 September 2026. Budget: 150 lines.**

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
| picture, music, jigsaw or steal rounds, and **negative points** | [`decisions/round-types.md`](decisions/round-types.md) |
| whether an idea was already turned down | [`decisions/scope.md`](decisions/scope.md) |
| upgrading anything in `package.json` | [`decisions/dependencies.md`](decisions/dependencies.md) |
| the studio set, or any lighting cue | [`decisions/lighting.md`](decisions/lighting.md) |

## State as of 2 September 2026

**Shipped and played.** 542 tests on master, types and lint clean, no `any` or
`@ts-ignore`.

- **Squads, weekly boards, the average table, the frozen podium and the sealed
  question text are live** (20 August, [PR #2](https://github.com/gregjrothwell/quiz/pull/2)),
  and **the answer vault** with them: 13,593 answers, both rulesets published.
- **App Check enforces on Firestore, the RTDB and auth**; `appcheck-probe` refuses
  at sign-in, which is the proof: [`decisions/app-check-auth.md`](decisions/app-check-auth.md).
- **The reveal lands on its own, ~0.5s after the clock**, on the server-confirmed
  snapshot; `reveal-probe` is the instrument: [`decisions/vault.md`](decisions/vault.md#the-gate-had-no-margin-and-the-host-was-the-one-who-paid).
- **Scoring is a rank bonus, not a speed curve** — 500 for correct plus
  500/400/300/200/100 by the order the answers landed. Live since 20 August
  ([PR #6](https://github.com/gregjrothwell/quiz/pull/6)), but **ranking is still
  unproven**; that needs two answerers: [`decisions/scoring.md`](decisions/scoring.md).
- **The final screen makes a shareable PNG of the round.** Live since 20 August
  ([PR #7](https://github.com/gregjrothwell/quiz/pull/7)): [`decisions/final-card.md`](decisions/final-card.md).
- **Live since 28 August**, each proved on the deployed site and each with its
  own file: the **shared clock** ([`shared-clock.md`](decisions/shared-clock.md)),
  **live squad scoring** on points ÷ headcount ([`live-squads.md`](decisions/live-squads.md)),
  **voting a question out** ([`question-votes.md`](decisions/question-votes.md)),
  and **a join link going straight into the room** ([`joining.md`](decisions/joining.md)).
- **`npm run host-room` scores a real answer now** — it never read the answers
  subcollection, so every reveal it folded scored nobody.
- **The verdict pills, the lighting rig and the dependency pass are all live.**
  This block claimed otherwise until 2 September; corrected by checking the
  branches rather than the prose.

**Live since 2 September**, deployed and checked on the site rather than assumed:

- **The repeats are fixed** — a failed read can no longer wipe the history, and
  Gentle and Fiendish are withdrawn because the corpus cannot fill them
  ([#18](https://github.com/gregjrothwell/quiz/pull/18)): [`decisions/repeats.md`](decisions/repeats.md).
- **The last question can be played for stakes**, at no extra reads or writes
  ([#19](https://github.com/gregjrothwell/quiz/pull/19)). Rules pasted first, and
  `check-rules` flipped FAIL → PASS: [`decisions/wager.md`](decisions/wager.md).

Bundle `index-Y1gzBmfb`, watched onto the CDN rather than assumed.

**4 September, on a branch: the chair seats everybody who tied for last**, not one
figure and an ampersand — room XS4A finished with three on zero. Round types
costed and negative points decided: [`decisions/round-types.md`](decisions/round-types.md).

**What is actually in the project right now** — counts, the two slow leaks, and the
two corrections that came out of miscounting them: [`decisions/cost.md`](decisions/cost.md#measured-live-28-august-2026).

## Outstanding

1. **A quizmaster dropping out mid-round** needs a browser and `host-room`.
2. **No Content-Security-Policy.** Deliberate: a `<meta http-equiv>` CSP breaks
   the live app silently and the stale CDN makes it painful to diagnose.
3. **Three things still want a second person**: the review panel, a quizmaster
   handover, two squads on one board. **Not the rank bonus or the wager** — this
   list called both unplayed until 4 September and the live rooms said otherwise,
   which nothing but Greg's memory was going to catch:
   [`decisions/round-types.md`](decisions/round-types.md#the-prose-was-wrong-and-that-is-a-finding).
   The **anonymous-account purge is reviewed and the answer is don't**:
   [`decisions/identity.md`](decisions/identity.md).
4. **The Ladder stops climbing** once a pack's thin `easy` or `hard` bucket is
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
