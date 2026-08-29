# Handover — Vibe Quiz

> **Owner: Greg Rothwell. Last updated: 29 August 2026. Budget: 150 lines.**

Real-time office quiz. Static site on GitHub Pages, Firebase for live rooms.
Built to replace Polly in Teams.

- **Live:** https://gregjrothwell.github.io/quiz/
- **Repo:** https://github.com/gregjrothwell/quiz (public, `master`, deploys from `gh-pages`)
- **Firebase project:** `quiz-d686e` (Firestore + Realtime Database in europe-west1 + Anonymous auth)

**This file is the way in, not the record.** It was 2,422 lines until 20 August
2026 — more to read than the codebase it describes. Depth is in `decisions/`, the
dated spine is `TOTAL-RECALL.md` (older half archived in [`recall/`](recall/)),
and the hook says so if this one grows.

## Read this before changing

| If you're changing | Read |
|---|---|
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

## State as of 29 August 2026

**Shipped and played.** 513 tests, clean types and lint, no `any` or `@ts-ignore`.

- **Squads, weekly boards, the average table, the frozen podium and the sealed
  question text are live** (20 August, [PR #2](https://github.com/gregjrothwell/quiz/pull/2)).
- **The answer vault is live**: 13,593 answers, both rulesets published.
- **App Check enforces on Firestore, the RTDB and auth**; `appcheck-probe` refuses
  at sign-in, which is the proof: [`decisions/app-check-auth.md`](decisions/app-check-auth.md).
- **The reveal lands on its own, ~0.5s after the clock**, on the server-confirmed
  snapshot; `reveal-probe` is the instrument: [`decisions/vault.md`](decisions/vault.md#the-gate-had-no-margin-and-the-host-was-the-one-who-paid).
- **Scoring is a rank bonus, not a speed curve** — 500 for correct plus
  500/400/300/200/100 by the order the answers landed. **Live since 20 August**
  ([PR #6](https://github.com/gregjrothwell/quiz/pull/6)); scored in a live room,
  but **ranking is still unproven** — that needs two answerers:
  [`decisions/scoring.md`](decisions/scoring.md).
- **The final screen makes a shareable PNG of the round**, chair and all. **Live
  since 20 August** ([PR #7](https://github.com/gregjrothwell/quiz/pull/7)):
  [`decisions/final-card.md`](decisions/final-card.md).
- **Every device counts the same window from the same origin**, corrected for its
  own clock offset. **Live since 28 August** ([PR #8](https://github.com/gregjrothwell/quiz/pull/8))
  and played the same day — `CORRECT · +1,000` at 10.6s in the browser against
  `scored: ClockTest +1000` in the terminal, the two agreeing being the point:
  [`decisions/shared-clock.md`](decisions/shared-clock.md).
- **Squads score live under the standings**, ranked on points ÷ headcount.
  **Live since 28 August** ([PR #16](https://github.com/gregjrothwell/quiz/pull/16));
  rules pasted first, which was the whole risk: [`decisions/live-squads.md`](decisions/live-squads.md).
- **Players vote on a question at the reveal**, and `fold-votes` turns the
  verdicts into a retirement list. **Live since 28 August**, proved end to end:
  [`decisions/question-votes.md`](decisions/question-votes.md).
- **A join link goes straight into the room** when the browser already knows its
  name. **Live since 28 August**:
  [`decisions/joining.md`](decisions/joining.md).
- **`npm run host-room` scores a real answer now** — it never read the answers
  subcollection, so every reveal it folded scored nobody.

- **The design review is built** — the `.chip` cascade collision that silently killed
  the difficulty signal, both dim tokens past AA, a thin-supply warning, the player's
  reveal, four components named. **Live 29 August** ([PR #17](https://github.com/gregjrothwell/quiz/pull/17)), proved in a real room.
- **Every interactive target is 44px** — pills, sound toggle, filter chips; the
  chips needed their row gap opened or wrapped rows would have overlapped: [`decisions/state-of-play.md`](decisions/state-of-play.md#the-ui-measured--28-august-2026).
- **The rig is operated rather than just lit** — the house dims for the question,
  and blazes on `finished`. **Live since 29 August**: [`decisions/lighting.md`](decisions/lighting.md).
- **Seven in-range dependency bumps and `globals` 17**; four majors measured and
  held: [`decisions/dependencies.md`](decisions/dependencies.md). Shipped inside
  PR #17 **unverified** — the one part of that merge nobody checked.

**What is actually in the project right now** — counts, the two slow leaks and the
corrections that came of miscounting them: [`decisions/cost.md`](decisions/cost.md#measured-live-28-august-2026).

## Outstanding

1. **A quizmaster dropping out mid-round** needs a browser and `host-room`.
2. **No Content-Security-Policy.** Deliberate: a `<meta http-equiv>` CSP breaks
   the live app silently and the stale CDN makes it painful to diagnose.
3. **Still needing a second person** — the review panel, a real quizmaster
   handover, two squads on one board, and **a rank bonus with more than one right
   answer in it**, still the oldest unproven claim here. A player's reveal *was*
   proved against a real quizmaster on 29 August. Keyboard shortcuts cleared 28
   August. The
   **anonymous-account purge is reviewed and the answer is don't**:
   [`decisions/identity.md`](decisions/identity.md).
4. ~~**Two colour tokens fail WCAG AA.**~~ **Fixed and live, 29 August** —
   `--ink-dim` `#7a96bc` at 4.99, `--cyan-dim` `#159fcc` at 4.95, both with
   headroom rather than at the 4.52/4.51 minimums.

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
`sync-harness [n]`, `host-room [-- secs]`, `reveal-probe`, `take-stock`,
`prune-rooms [-- --probe-rows --go]`, `fold-votes [-- --go]`.

`npm test` covers `src/` plus the pure parts of `scripts/`. Anything under
`scripts/` that touches the network or the live project stays out deliberately;
`npm test` must keep running offline.

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
