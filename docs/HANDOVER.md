# Handover — Vibe Quiz

> **Owner: Greg Rothwell. Last updated: 10 September 2026. Budget: 150 lines.**

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
| **On the box / TMDB stills, and how to pick it up** | [`decisions/questions.md`](decisions/questions.md#picking-up-on-the-box) |
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
| the next three, why A/B testing is blocked, **and how to pick it up** | [`decisions/what-to-build-next.md`](decisions/what-to-build-next.md#picking-this-up--cursor-or-a-fresh-session) |
| picture, music, jigsaw or steal rounds, and **negative points** | [`decisions/round-types.md`](decisions/round-types.md) |
| why the melody round played badly, before changing it | [`decisions/melody-round.md`](decisions/melody-round.md) |
| **Name that Tune** — volume, clips that give the answer away, the song list | [`decisions/tunes-round.md`](decisions/tunes-round.md) |
| whether an answer can be changed, and the spam exploit | [`decisions/answer-spam.md`](decisions/answer-spam.md) |
| `firstMs`, and what the reveal says about a snap guess | [`decisions/first-touch.md`](decisions/first-touch.md) |
| whether an idea was already turned down | [`decisions/scope.md`](decisions/scope.md) |
| what a finished round left behind, and reading it back | [`decisions/game-record.md`](decisions/game-record.md) |
| upgrading anything in `package.json` | [`decisions/dependencies.md`](decisions/dependencies.md) |
| the studio set, or any lighting cue | [`decisions/lighting.md`](decisions/lighting.md) |

## State as of 10 September 2026

**Live is `index-C3jZR3XU`** (10 September, gh-pages `9ba0638`). **16 packs**;
**Name that Tune 177**; synth is **Classical**; **On the box** (54, hashed TMDB
stills); **Flags** (76, hashed, no jigsaw); **Sleeves** (52, mzstatic hotlink);
picture is **Fine Art**. Firebase chunk unmoved at `firebase-Cns3pSRr`.

**Name that Tune has been played and it worked** — `CX5E`, 65% over 10 of 10,
the first round the game has ever *kept*. The three notes off it are **live**:
default volume 0.35 with a slider under the corner switch; **79 songs → 177**;
every clip measured by `tune-audit` — 103 clean, 33 trimmed, 31 shifted, **10
unavoidable and left alone**. Vault seeded (95, then 4 + **1 changed**).
[`tunes-round.md`](decisions/tunes-round.md). **[#39](https://github.com/gregjrothwell/quiz/pull/39)
open; deployed from the branch, master not moved.**

**Melody and picture are live and have been played** — `voices` + hashed
`image`. The melody round did not work — [`melody-round.md`](decisions/melody-round.md).
Picture is still unplayed with people.

**Shipped and played** otherwise: 13,593 answers, both rulesets published;
`appcheck-probe` refuses at sign-in; reveal ~0.5s after the clock; scoring is
500 + rank 500/400/300/200/100. Files: [`scoring.md`](decisions/scoring.md),
[`app-check-auth.md`](decisions/app-check-auth.md), [`vault.md`](decisions/vault.md),
[`repeats.md`](decisions/repeats.md), [`wager.md`](decisions/wager.md),
[`round-types.md`](decisions/round-types.md). Check the thing, not the prose.

**What is actually in the project right now** — counts, the two slow leaks, and the
two corrections that came out of miscounting them: [`decisions/cost.md`](decisions/cost.md#measured-live-28-august-2026).

## Outstanding

1. **A quizmaster dropping out mid-round** needs a browser and `host-room`.
2. **No Content-Security-Policy.** Deliberate: a `<meta http-equiv>` CSP breaks
   the live app silently and the stale CDN makes it painful to diagnose.
3. **Three things still want a second person**: the review panel, a quizmaster
   handover, two squads on one board. **Not the rank bonus or the wager** — this
   list called both unplayed until 4 September and the live rooms said otherwise:
   [`decisions/round-types.md`](decisions/round-types.md#the-prose-was-wrong-and-that-is-a-finding).
   The **anonymous-account purge is reviewed and the answer is don't**:
   [`decisions/identity.md`](decisions/identity.md).
4. **The Ladder stops climbing** once a pack's thin `easy` or `hard` bucket is
   spent — it substitutes medium rather than repeating. The fix is a fold of
   `games/` into a real difficulty, not selection.
5. **The repo's `firestore.rules` is behind the console — do not paste it.**
   Live is 39,218 bytes against master's 34,889; the extra is the `elapsedMs`
   arrival floor, and pasting master over it would delete a live anti-cheat.
   Live is byte-identical to `firestore.rules` on the local branch
   `paste-seasons-and-elapsed`, pasted 8 September and never merged. The two
   `check-rules` FAILs are the **checker** being stale, not the rules. Fixed
   and proved green on local branch `sync-rules-with-console` (unpushed).
6. **Hand-built packs need a seed after any *new* ids.** All current packs are
   seeded as of 10 September. An unseeded pack breaks at reveal.
7. **`firstMs` and the pack picker are live and unplayed.** The marker is a
   deterrent, so the only test that means anything is whether it changes his
   behaviour in the next round: [`decisions/first-touch.md`](decisions/first-touch.md).
8. **The first round is kept.** `CX5E`, 10 September, 65% over 10 questions —
   and it named the giveaway clips before any transcript was read.

## Where things are

```
src/engine/     Pure TS game rules — no React, no Firebase. All the logic worth testing.
src/lib/        Firebase wiring (useRoom), packs, the clock, audio, and the name,
                squad, sound and volume preferences kept in localStorage.
src/screens/    One component per phase + a design gallery (Preview).
```

Commands: `dev` (port 5273), `test`, `typecheck`, `lint`, `build`, `deploy`,
`fetch-questions [-- --resort]`, `fetch-otqa`, `seed-vault`, `check-rules`,
`sync-harness [n]`, `host-room [-- secs]`, `reveal-probe`, `asked-probe`,
`take-stock`, `prune-rooms [-- --probe-rows --go]`, `fold-votes [-- --go]`,
`write-hand-packs`, `write-melody-pack`, `write-tunes-pack`, `write-flags-pack`,
`write-sleeves-pack`, `write-screens-pack`, `itunes-probe`, `tmdb-probe`,
`tune-audit`, `read-games [-- --last n | --game id | --pack id]`.

`npm test` covers `src/` plus the pure parts of `scripts/`. Anything touching the
network or the live project stays out deliberately; it must keep running offline.

## If you're picking this up cold

**On the box is live** as `index-CFub7zgz`, seeded, unplayed — do not re-run
`seed-vault`: [`questions.md`](decisions/questions.md#picking-up-on-the-box).

Otherwise: `npm run check-rules`, then `npm run sync-harness 10`. Between them
they confirm the rules are published and that ten clients stay in sync — the two
things that have actually broken in play.

Two things that have bitten more than once: **the rules are published by hand**,
so the repo copy is not what Firebase is running — and on 10 September that
drift was found running the *other* way, the console ahead of the repo
([`decisions/security.md`](decisions/security.md)). And **the answer window
lives in `firestore.rules` as well as the client**, where two of the three rules
close holes that are not obvious from the client side
([`decisions/answer-window.md`](decisions/answer-window.md)).
