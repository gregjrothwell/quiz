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

## State as of 4 September 2026

**Live** (bundle `index-CIOq186A`): chair, take-stock, steal (opt-in, unplayed),
mute, lobby squad picker, negatives paste (`check-rules` 52/52). Squads, vault,
App Check, rank bonus, wager, repeats/Gentle+Fiendish withdrawn. 653 tests on
master.

**Melody and picture went live 4 September** (#22, #23, #24): 70 tunes and 49
stills, `voices` + hashed `image`, jigsaw as a lobby flag, lobby force-unmute,
`authorDied` T−71. The vault holds 13,712 answers — `seed-vault` added the 119
on the day. Proved in room `NDH7`: the reveal put `tile--correct` on the right
still. **The melody half has still never been heard by anybody** — it needs
ears, and no round has used it. `npm run rank-harness` came back off a stranded
branch at the same time.

**Shipped and played** otherwise: 13,593 answers, both rulesets published;
`appcheck-probe` refuses at sign-in; reveal ~0.5s after the clock; scoring is
500 + rank 500/400/300/200/100. Files: [`scoring.md`](decisions/scoring.md),
[`app-check-auth.md`](decisions/app-check-auth.md), [`vault.md`](decisions/vault.md),
[`repeats.md`](decisions/repeats.md), [`wager.md`](decisions/wager.md),
[`round-types.md`](decisions/round-types.md). Shared clock, live squads, votes
and join-into-room since 28 August. Check the thing, not the prose.

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
   spent — it substitutes medium rather than repeating, which is right but is not
   what the tile promises. The fix is `stats/{questionId}`, not selection.
5. **The melody round has never been played.** The picture half is proved live;
   the tunes are synthesised and nobody has listened to one, so "it plays" is
   still an assumption. Any new hand-built pack needs `npm run seed-vault`
   before its ids can score — `resolveAnswer` throws rather than scoring zero.
6. **`TOTAL-RECALL.md` is 350 lines against 300.** It wants an archive pass to
   `recall/2026-09.md` — older entries moved *verbatim* with a dated one-line
   pointer left behind, not compressed.

## Where things are

```
src/engine/     Pure TS game rules — no React, no Firebase. All the logic worth testing.
src/lib/        Firebase wiring (useRoom), packs, the clock, audio, and the name,
                squad and sound preference kept in localStorage.
src/screens/    One component per phase + a design gallery (Preview).
src/design/     One stylesheet, design tokens at the top.
docs/decisions/ One subsystem each. Reached from the table above.
```

Commands: `dev` (port 5273), `test`, `typecheck`, `lint`, `build`, `deploy`,
`fetch-questions [-- --resort]`, `fetch-otqa`, `seed-vault`, `check-rules`,
`sync-harness [n]`, `host-room [-- secs]`, `reveal-probe`, `asked-probe`,
`take-stock`, `prune-rooms [-- --probe-rows --go]`, `fold-votes [-- --go]`,
`write-hand-packs`.

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
