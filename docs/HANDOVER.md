# Handover — Vibe Quiz

> **Owner: Greg Rothwell. Last updated: 10 September 2026. Budget: 150 lines.**

Real-time office quiz. Static site on GitHub Pages, Firebase for live rooms.
Built to replace Polly in Teams.

- **Live:** https://gregjrothwell.github.io/quiz/
- **Repo:** https://github.com/gregjrothwell/quiz (public, `master`, deploys from `gh-pages`)
- **Firebase project:** `quiz-d686e` (Firestore + Realtime Database in europe-west1 + Anonymous auth)

**This file is the way in, not the record.** It was 2,422 lines until 20 August
2026. Depth is in `decisions/`, the dated spine is `TOTAL-RECALL.md` (older half
in [`recall/`](recall/)).

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
| the debug token, `check-bundle`, why a deploy must not come off `master` | [`decisions/debug-token-leak.md`](decisions/debug-token-leak.md) |
| anything that adds reads or writes | [`decisions/cost.md`](decisions/cost.md) |
| — before assuming a style choice, a bug, or a claim in here | [`gotchas.md`](decisions/gotchas.md) · [`known-limits.md`](decisions/known-limits.md) · [`state-of-play.md`](decisions/state-of-play.md) |
| what a question is worth, and why it is not a speed curve | [`decisions/scoring.md`](decisions/scoring.md) |
| the countdown, and whose clock it runs on | [`decisions/shared-clock.md`](decisions/shared-clock.md) |
| the shareable result card, and how it gets to the player | [`decisions/final-card.md`](decisions/final-card.md) |
| what to build next, what each idea costs, and what was turned down | [`what-to-build-next.md`](decisions/what-to-build-next.md#picking-this-up--cursor-or-a-fresh-session) · [`ideas-review.md`](decisions/ideas-review.md) · [`scope.md`](decisions/scope.md) |
| picture, music, jigsaw or steal rounds, and **negative points** | [`decisions/round-types.md`](decisions/round-types.md) |
| why the melody round played badly, before changing it | [`decisions/melody-round.md`](decisions/melody-round.md) |
| **Name that Tune** — volume, clips that give the answer away, the song list | [`decisions/tunes-round.md`](decisions/tunes-round.md) |
| whether an answer can be changed, and the spam exploit | [`decisions/answer-spam.md`](decisions/answer-spam.md) |
| `firstMs`, and what the reveal says about a snap guess | [`decisions/first-touch.md`](decisions/first-touch.md) |
| what a finished round left behind, and reading it back | [`decisions/game-record.md`](decisions/game-record.md) |
| upgrading anything in `package.json` | [`decisions/dependencies.md`](decisions/dependencies.md) |
| the studio set, or any lighting cue | [`decisions/lighting.md`](decisions/lighting.md) |

## State as of 10 September 2026

> **READ FIRST — the leaked App Check debug token still needs killing in the
> console.** Bundle half done: `seal-token-again` deployed 10 September
> (`index-V9wVdhyu`, gh-pages `899a4c3`), served bundle grepped clean, live app
> verified. Open half is **Greg's** — revoke and reissue at console → App Check →
> Manage debug tokens (world-readable for weeks; the bundle fix does not
> un-publish it), new value into `.env.local` after. **`master` still re-leaks on
> deploy** until `seal-token-again` lands:
> [`decisions/debug-token-leak.md`](decisions/debug-token-leak.md).

**Live is `index-V9wVdhyu`** (10 September, gh-pages `899a4c3`, from
`seal-token-again` = #39 + the token gate). **16 packs**;
**Name that Tune 177**; synth is **Classical**; **On the box** (54, hashed TMDB
stills); **Flags** (76, hashed, no jigsaw); **Sleeves** (52, mzstatic hotlink);
picture is **Fine Art**. Firebase chunk unmoved at `firebase-Cns3pSRr`.

**Name that Tune has been played and it worked** — `CX5E`, 65% over 10 of 10,
the first round the game ever *kept*. Its three notes are live: volume 0.35 plus
a corner slider, **79 songs → 177**, and every clip measured by `tune-audit`
(103 clean, 33 trimmed, 31 shifted, **10 unavoidable, left alone**). Vault
seeded. [`tunes-round.md`](decisions/tunes-round.md).
**[#39](https://github.com/gregjrothwell/quiz/pull/39) open; its content is live
via `seal-token-again`, master not moved.** Melody and picture are live and
played; melody did not work ([`melody-round.md`](decisions/melody-round.md)),
picture is unplayed with people.

**Shipped and played** otherwise: 13,593 answers; `appcheck-probe` refuses at
sign-in; reveal ~0.5s after the clock; scoring 500 + rank 500/400/300/200/100.
Counts and the two slow leaks: [`cost.md`](decisions/cost.md#measured-live-28-august-2026).
**Check the thing, not the prose.**

## Outstanding

1. **The token revoke (box above) is the open half.** The gate, its test and
   `check-bundle` are deployed and `deploy` runs the check; `master` still has
   neither, so **do not deploy from `master`** until `seal-token-again` lands.
   #35 is the first, superseded attempt's PR — close it.
   [`decisions/debug-token-leak.md`](decisions/debug-token-leak.md).
2. **A quizmaster dropping out mid-round** needs a browser and `host-room`.
3. **No Content-Security-Policy.** Deliberate: a `<meta http-equiv>` CSP breaks
   the live app silently and the stale CDN makes that painful to diagnose.
4. **Three things still want a second person**: the review panel, a quizmaster
   handover, two squads on one board. **Not the rank bonus or the wager**, which
   this list called unplayed until the live rooms said otherwise:
   [`decisions/round-types.md`](decisions/round-types.md#the-prose-was-wrong-and-that-is-a-finding).
   The **anonymous-account purge is reviewed and the answer is don't**:
   [`decisions/identity.md`](decisions/identity.md).
5. **The Ladder stops climbing** once a pack's thin `easy` or `hard` bucket is
   spent — it substitutes medium. The fix is a fold of `games/` into a real
   difficulty, not selection.
6. **The repo's `firestore.rules` was behind the console.** Fixed on
   [`#40`](https://github.com/gregjrothwell/quiz/pull/40): repo brought
   byte-forward to live (39,218 vs master's 34,889 — the extra is the `elapsedMs`
   arrival floor), stale checker fixed with it. `check-rules` green both ways
   10 September, the two allow cases FAIL→PASS. **Still do not paste master's
   rules over the console** — it would delete a live anti-cheat.
7. **Hand-built packs need a seed after any *new* ids.** All current packs are
   seeded as of 10 September. An unseeded pack breaks at reveal.
8. **`firstMs` and the pack picker are live and unplayed.** The marker is a
   deterrent, so the only test that counts is whether it changes his behaviour
   next round: [`decisions/first-touch.md`](decisions/first-touch.md).
9. **Branches, 10 September:** 26 local → 13; 31 merged still on the remote.
   Open PRs: **#39** (tunes, deployed from branch), **#40** (rules sync), **#35**
   (dead — close it). **Local-only and unpushed**: `paste-seasons-and-elapsed`
   (the live rules + season-form code that is live nowhere), `ask-recovery-code`,
   `clock-bed-and-key-repeat` (the clock bed after a melody clip — the open item
   in [`melody-round.md`](decisions/melody-round.md)), `bound-elapsed-ms`,
   `fold-votes-dry-run`, `context-standards-route`, `vote-tally` (WIP).

## Where things are

`src/engine/` pure TS rules, no React or Firebase — all the logic worth testing.
`src/lib/` Firebase wiring, packs, clock, audio, and the name / squad / sound /
volume preferences in localStorage. `src/screens/` one per phase, plus the
gallery (`Preview`).

Commands: the table in [`AGENTS.md`](../AGENTS.md), plus `fetch-questions`,
`fetch-otqa`, `asked-probe`, `take-stock`, `prune-rooms`, `write-*-pack`,
`check-bundle`, `read-games`.

`npm test` covers `src/` plus the pure parts of `scripts/`; anything touching the
network or the live project stays out, so it keeps running offline.

## If you're picking this up cold

**The token leak's bundle half is deployed and verified** (box at the top) — the
open half is Greg revoking the token in the console. Then, if rules matter to
what you're doing: `npm run check-rules` from `sync-rules-with-console` / #40 (or
two allow cases fail for the wrong reason) and `npm run sync-harness 10` — both
ran green 10 September (10/10, 0 dropped). Do not re-run `seed-vault`; everything
is seeded.

Bitten more than once: **the rules are published by hand**, so the repo copy is
not what Firebase runs ([`security.md`](decisions/security.md)); **the answer
window lives in `firestore.rules` as well as the client**
([`answer-window.md`](decisions/answer-window.md)).
