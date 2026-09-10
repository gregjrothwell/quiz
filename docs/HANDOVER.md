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

> **READ FIRST — the live bundle is leaking the App Check debug token.** The
> 10 September deploy came off `master`, which reads
> `VITE_FIREBASE_APPCHECK_DEBUG_TOKEN` unconditionally; Vite inlines it at build
> time and `deploy` builds on the machine holding `.env.local`. Grepped the
> served bundle: one hit. **The fix is pushed on `seal-token-again` and is NOT
> deployed** — `npm run deploy` from that branch, **then revoke and reissue the
> token in the console.** It has been world-readable, and taking it out of the
> bundle does not un-publish it.

**Live is `index-C3jZR3XU`** (10 September, gh-pages `9ba0638`). **16 packs**;
**Name that Tune 177**; synth is **Classical**; **On the box** (54, hashed TMDB
stills); **Flags** (76, hashed, no jigsaw); **Sleeves** (52, mzstatic hotlink);
picture is **Fine Art**. Firebase chunk unmoved at `firebase-Cns3pSRr`.

**Name that Tune has been played and it worked** — `CX5E`, 65% over 10 of 10,
the first round the game ever *kept*. Its three notes are live: volume 0.35 plus
a corner slider, **79 songs → 177**, and every clip measured by `tune-audit`
(103 clean, 33 trimmed, 31 shifted, **10 unavoidable, left alone**). Vault
seeded. [`tunes-round.md`](decisions/tunes-round.md).
**[#39](https://github.com/gregjrothwell/quiz/pull/39) open; deployed from the
branch, master not moved.** Melody and picture are live and played; melody did
not work ([`melody-round.md`](decisions/melody-round.md)), picture is unplayed
with people.

**Shipped and played** otherwise: 13,593 answers; `appcheck-probe` refuses at
sign-in; reveal ~0.5s after the clock; scoring 500 + rank 500/400/300/200/100.
Counts and the two slow leaks: [`cost.md`](decisions/cost.md#measured-live-28-august-2026).
**Check the thing, not the prose.**

## Outstanding

1. **The debug-token leak above comes first.** `seal-token-again` has the
   `import.meta.env.DEV` gate, its test, and `scripts/check-bundle.ts`, with
   `deploy` running the check between `build` and `gh-pages`. Proved both ways:
   a clean build exits 0, a planted token exits 1 and names the file. **This
   shipped once before** — live in sixteen deploys from 15 August, fixed on
   `seal-the-debug-token`, and that branch was never merged, so deploying from
   master put it straight back.
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
6. **The repo's `firestore.rules` is behind the console — do not paste it.**
   Live is 39,218 bytes against master's 34,889; the extra is the `elapsedMs`
   arrival floor, and pasting master over it would delete a live anti-cheat.
   Live is byte-identical to that file on `paste-seasons-and-elapsed`. The two
   `check-rules` FAILs are the **checker** being stale, not the rules — fixed
   and proved green on `sync-rules-with-console`.
7. **Hand-built packs need a seed after any *new* ids.** All current packs are
   seeded as of 10 September. An unseeded pack breaks at reveal.
8. **`firstMs` and the pack picker are live and unplayed.** The marker is a
   deterrent, so the only test that counts is whether it changes his behaviour
   next round: [`decisions/first-touch.md`](decisions/first-touch.md).
9. **Branches, 10 September:** 26 local → 13, merged ones deleted; 31 merged
   still on the remote. **Local-only and unpushed**: `paste-seasons-and-elapsed`
   (the live rules + season-form code that is live nowhere),
   `sync-rules-with-console`, `ask-recovery-code`, `clock-bed-and-key-repeat`
   (the clock bed after a melody clip — the open item in
   [`melody-round.md`](decisions/melody-round.md)), `bound-elapsed-ms`,
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

**Deploy `seal-token-again` first** (box at the top), then revoke the token in
the console. Then `npm run check-rules` (from `sync-rules-with-console`, or two allow cases
fail for the wrong reason) and `npm run sync-harness 10` — the rules being
published and ten clients staying in sync are the two things that have actually
broken in play. Do not re-run `seed-vault`; everything is seeded.

Bitten more than once: **the rules are published by hand**, so the repo copy is
not what Firebase runs — and on 10 September that drift ran the *other* way, the
console ahead of the repo ([`security.md`](decisions/security.md)). And **the
answer window lives in `firestore.rules` as well as the client**
([`answer-window.md`](decisions/answer-window.md)).
