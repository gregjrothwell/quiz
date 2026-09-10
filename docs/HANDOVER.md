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
| the season board as it shipped in August, before form ranking | [`decisions/season-shipped.md`](decisions/season-shipped.md) |
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
| **the CI deploy, the secret check, and why Playwright gets the emulator** | [`decisions/ci-deploy.md`](decisions/ci-deploy.md) · [`audit-backlog.md`](decisions/audit-backlog.md) |
| anything that adds reads or writes | [`decisions/cost.md`](decisions/cost.md) |
| — before assuming a style choice, a bug, or a claim in here | [`gotchas.md`](decisions/gotchas.md) · [`known-limits.md`](decisions/known-limits.md) · [`state-of-play.md`](decisions/state-of-play.md) |
| what a question is worth, and why it is not a speed curve | [`decisions/scoring.md`](decisions/scoring.md) |
| the countdown, and whose clock it runs on | [`decisions/shared-clock.md`](decisions/shared-clock.md) |
| the shareable result card, and how it gets to the player | [`decisions/final-card.md`](decisions/final-card.md) |
| what to build next, what each idea costs, and what was turned down | [`what-to-build-next.md`](decisions/what-to-build-next.md) · [`picking-up.md`](decisions/picking-up.md) · [`ideas-review.md`](decisions/ideas-review.md) · [`scope.md`](decisions/scope.md) |
| picture, music, jigsaw or steal rounds, and **negative points** | [`decisions/round-types.md`](decisions/round-types.md) |
| why the melody round played badly, before changing it | [`decisions/melody-round.md`](decisions/melody-round.md) |
| **Name that Tune** — volume, clips that give the answer away, the song list | [`decisions/tunes-round.md`](decisions/tunes-round.md) |
| whether an answer can be changed, and the spam exploit | [`decisions/answer-spam.md`](decisions/answer-spam.md) |
| `firstMs`, and what the reveal says about a snap guess | [`decisions/first-touch.md`](decisions/first-touch.md) |
| what a finished round left behind, and reading it back | [`decisions/game-record.md`](decisions/game-record.md) |
| upgrading anything in `package.json` | [`decisions/dependencies.md`](decisions/dependencies.md) |
| the studio set, or any lighting cue | [`decisions/lighting.md`](decisions/lighting.md) |

## State as of 10 September 2026

> **READ FIRST — deploys now come from CI, and the season board is short on
> purpose.** 10 September: `.github/workflows/ci.yml` builds and publishes from
> `master`; the token gate, `check-bundle` and `predeploy` are all on `master`,
> so the leak is closed at the source rather than on a branch.
> [`decisions/ci-deploy.md`](decisions/ci-deploy.md). **The season board's form
> figures are estimates** on every row but one — the scores they are defined
> over were never stored, so they were seeded from `best` and the mean and decay
> as people bank. [`decisions/season.md`](decisions/season.md).

**Live is `index-qJCbuGrA`** (10 September, gh-pages `d412adc`, **deployed by
CI** — the author line on a gh-pages commit now says whether it came from CI or
a laptop). **16 packs**; **Name that Tune 177**; synth is **Classical**; **On
the box** (54, hashed TMDB stills); **Flags** (76, hashed, no jigsaw);
**Sleeves** (52, mzstatic hotlink); picture is **Fine Art**. Firebase chunk
unmoved at `firebase-Cns3pSRr`.

**Played and kept, all three rounds the game has ever recorded:** Name that Tune
`CX5E` 65% ([`tunes-round.md`](decisions/tunes-round.md)), Picture `RX4P` 55%,
Best of British `RX4P` 42%. **The picture round had been played all along** and
three docs said otherwise — `read-games` settled it, the third such drift. Melody
is live, played, and did not work ([`melody-round.md`](decisions/melody-round.md)).

**Shipped and played** otherwise: 13,593 answers; `appcheck-probe` refuses at
sign-in; reveal ~0.5s after the clock; scoring 500 + rank 500/400/300/200/100.
Counts and the two slow leaks: [`cost.md`](decisions/cost.md#measured-live-28-august-2026).
**Check the thing, not the prose.**

## Outstanding

1. **29 of 30 season rows carry an *estimated* `form`**, seeded by
   `npm run backfill-form` — the scores it is defined over were never stored, so
   these are invented and decay as people bank. Real ones were not overwritten
   ([`season.md`](decisions/season.md)).
2. **A quizmaster dropping out mid-round** needs a browser and `host-room`.
3. **No Content-Security-Policy.** Deliberate: a `<meta http-equiv>` CSP breaks
   the live app silently and the stale CDN makes that painful to diagnose.
4. **Three things still want a second person**: the review panel, a quizmaster
   handover, two squads on one board. **Not the rank bonus or the wager** —
   [`round-types.md`](decisions/round-types.md#the-prose-was-wrong-and-that-is-a-finding).
   **Anonymous-account purge: reviewed, and the answer is don't**
   ([`identity.md`](decisions/identity.md)).
5. **The Ladder stops climbing** once a pack's thin `easy`/`hard` bucket is
   spent — it substitutes medium. The fix is a fold of `games/` into real
   difficulty, **a query now rather than a build** — but `games/` holds three
   rounds, so it is gated on playing, not coding.
6. **Do not paste `master`'s rules over the console.** The repo is byte-forward
   (39,218) but the console is the source of truth; a paste the wrong way deletes
   a live anti-cheat. `check-rules` **69/69 both ways, 10 September**.
7. **Hand-built packs need a seed after any *new* ids.** All seeded as of
   10 September; an unseeded pack breaks at reveal.
8. **`firstMs` and the pack picker are live and unplayed.** It is a deterrent,
   so the only test is whether his behaviour changes next round:
   [`first-touch.md`](decisions/first-touch.md).
9. **CI actions on deprecated Node 20** —
   [`#45`](https://github.com/gregjrothwell/quiz/pull/45) bumps them and its
   `verify` run is green, but it **conflicts**: #44 touched the same workflow
   after that branch was cut. Merge `master` into it. Its finding is worth
   keeping — the four actions need **different** majors (checkout/setup-node v5,
   upload-artifact v6, download-artifact v7), because v5 of the artifact pair
   advertises Node 24 support while still defaulting to node20.
10. **Branches, 10 September:** #35 and #39 closed; #40, #41, #42, #43, #44, #46
    merged. **`#45` is the only one open**, and it conflicts. **Still local-only and unpushed**:
    `ask-recovery-code` (one line on the final screen; live counts are 1 recovery
    code, 0 claims — the cheapest thing on the list), `clock-bed-and-key-repeat`,
    `bound-elapsed-ms`, `fold-votes-dry-run`, `context-standards-route`,
    `vote-tally` (WIP). Four features finished and existing on one laptop.

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

**The token leak is closed** (box at the top) — what's left is getting the gate
onto `master` so a deploy from there is safe. Then, if rules matter to what
you're doing: `npm run check-rules` from `sync-rules-with-console` / #40 (or two
allow cases fail for the wrong reason) and `npm run sync-harness 10` — both ran
green 10 September (10/10, 0 dropped). Do not re-run `seed-vault`; everything is
seeded.

Bitten more than once: **the rules are published by hand**, so the repo copy is
not what Firebase runs ([`security.md`](decisions/security.md)); **the answer
window lives in `firestore.rules` as well as the client**
([`answer-window.md`](decisions/answer-window.md)).
