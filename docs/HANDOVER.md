# Handover — Vibe Quiz

> **Owner: Greg Rothwell. Last updated: 21 September 2026. Budget: 150 lines.**

Real-time office quiz. Static site on GitHub Pages, Firebase for live rooms.
Built to replace Polly in Teams.

- **Live:** https://gregjrothwell.github.io/quiz/
- **Repo:** https://github.com/gregjrothwell/quiz (public, `master`, from `gh-pages`)
- **Firebase project:** `quiz-d686e` (Firestore + Realtime Database in europe-west1 + Anonymous auth)

**This file is the way in, not the record.** It was 2,422 lines until 20 August
2026. Depth is in `decisions/`; the spine is `TOTAL-RECALL.md` ([`recall/`](recall/) holds the older half).

## Read this before changing

| If you're changing | Read |
|---|---|
| repeats and the question history; staking points on the last question | [`repeats.md`](decisions/repeats.md) · [`wager.md`](decisions/wager.md) |
| the vault, reveals, answer secrecy, **the answer window**, and **a reveal that stalls** | [`vault.md`](decisions/vault.md) · [`answer-window.md`](decisions/answer-window.md) · [`reveal-delays.md`](decisions/reveal-delays.md) |
| the season table, squads, `recordGame`, anything called `team`; the August board; squads **during** a round | [`season.md`](decisions/season.md) · [`season-shipped.md`](decisions/season-shipped.md) · [`live-squads.md`](decisions/live-squads.md) |
| the opening titles, honours, rosettes | [`form-and-awards.md`](decisions/form-and-awards.md) |
| `playerId`, recovery codes, claiming, the anonymous-account purge | [`identity.md`](decisions/identity.md) |
| the clock and the countdown, and whose clock it runs on | [`clock.md`](decisions/clock.md) · [`shared-clock.md`](decisions/shared-clock.md) |
| joining, room codes, links, presence | [`decisions/joining.md`](decisions/joining.md) |
| scoring an answer that lands late; the review panel and the replay | [`late-answers.md`](decisions/late-answers.md) · [`review-replay.md`](decisions/review-replay.md) |
| packs, harvesting, classification, **On the box / TMDB stills** | [`questions.md`](decisions/questions.md) |
| **a picture that does not turn up**, preloading, the box a still gets | [`decisions/picture-loading.md`](decisions/picture-loading.md) |
| **an album cover that names its own album**, the sleeve audit | [`decisions/sleeves-gate.md`](decisions/sleeves-gate.md) |
| voting on a question, retiring one | [`question-votes.md`](decisions/question-votes.md) |
| rules and App Check — Firestore and RTDB, then **auth**, then the debug token and why a deploy must not come off `master` | [`security.md`](decisions/security.md) · [`app-check-auth.md`](decisions/app-check-auth.md) · [`debug-token-leak.md`](decisions/debug-token-leak.md) |
| **the CI deploy, the secret check, Playwright, the emulator**; anything that adds reads or writes | [`ci-deploy.md`](decisions/ci-deploy.md) · [`emulators.md`](decisions/emulators.md) · [`cost.md`](decisions/cost.md) · [`audit-backlog.md`](decisions/audit-backlog.md) |
| — before assuming a style choice, a bug, or a claim in here | [`gotchas.md`](decisions/gotchas.md) · [`known-limits.md`](decisions/known-limits.md) · [`state-of-play.md`](decisions/state-of-play.md) |
| what a question is worth, and why it is not a speed curve | [`decisions/scoring.md`](decisions/scoring.md) |
| the shareable result card, and how it gets to the player | [`decisions/final-card.md`](decisions/final-card.md) |
| what to build next, what each idea costs, what was turned down | [`what-to-build-next.md`](decisions/what-to-build-next.md) · [`picking-up.md`](decisions/picking-up.md) · [`ideas-review.md`](decisions/ideas-review.md) · [`scope.md`](decisions/scope.md) |
| picture, music, jigsaw or steal rounds, **negative points**, and why melody played badly | [`round-types.md`](decisions/round-types.md) · [`melody-round.md`](decisions/melody-round.md) |
| **Name that Tune** clips that give it away; **the volume slider and the two autoplay gates** | [`tunes-round.md`](decisions/tunes-round.md) · [`audio-stack.md`](decisions/audio-stack.md) |
| whether an answer can change and the spam exploit; `firstMs` and the snap guess | [`answer-spam.md`](decisions/answer-spam.md) · [`first-touch.md`](decisions/first-touch.md) |
| what a finished round left behind, and reading it back | [`decisions/game-record.md`](decisions/game-record.md) |
| upgrading `package.json`; the studio set and lighting cues | [`dependencies.md`](decisions/dependencies.md) · [`lighting.md`](decisions/lighting.md) |

## State as of 21 September 2026

> **READ FIRST — nothing has been deployed since 11 September, the sleeves pack
> is rebuilt and needs a vault seed, and the season board's form figures are
> estimates.** `.github/workflows/ci.yml` builds and publishes from `master`, so
> the token leak is closed at the source
> ([`decisions/ci-deploy.md`](decisions/ci-deploy.md)). Every season row but one
> carries a **seeded, estimated** `form`
> ([`decisions/season.md`](decisions/season.md)). Branch
> `picture-loading-and-sleeves-ocr` fixes two things the office hit — see
> Outstanding 1 and 2.

**Live is `index-n26s0ofl`** (11 Sep 09:38, gh-pages `3eb7221`, `96dee89`/#52,
CI) — *this box was a deploy behind twice running; check gh-pages, not it.*
Firebase chunk **moved to `firebase-W6iQUl4r`** (#51 touched `src/firebase.ts`).
**16 packs**; **Name that Tune 177**; synth **Classical**; **On the box** 54
(hashed TMDB stills); **Flags** 76 (hashed, no jigsaw); **Sleeves** 52 live but
**44 on the branch** after the cover audit; picture is **Fine Art**. Every still
now carries `imageWidth`/`imageHeight`, and a picture question puts the picture
beside the answers above 64rem.

**Played and kept:** eleven rounds. Name that Tune `CUC4` **80%, 3.1s median —
the best recorded** ([`reveal-delays.md`](decisions/reveal-delays.md)); four On
the box at 83–89%; **Sleeves `53FN` at 85%, which was the pack answering itself**
([`sleeves-gate.md`](decisions/sleeves-gate.md)); text rounds 21–47%. Melody is
live, played, and did not work ([`melody-round.md`](decisions/melody-round.md)).
**Check the live records, not the prose — three docs have drifted on this.**

**Otherwise:** `appcheck-probe` refuses at sign-in; reveal ~0.5s after the clock;
scoring 500 + rank 500/400/300/200/100; counts in
[`cost.md`](decisions/cost.md#measured-live-28-august-2026).

## Outstanding

1. **The sleeve audit is not enough on its own — a person has to look.** Vision
   missed the printed title on **a third** of the covers it cleared, twice
   running: letterspaced, scripted or upside down. Nineteen are refused by hand
   in `sleeve-refusals.ts`; `sleeve-audit -- --sheet` is how the pass is done.
   The 44 ratings are **judgements, not measurements**
   ([`sleeves-gate.md`](decisions/sleeves-gate.md)).
2. **Ask Bret whether it was one picture or the lot.** `M9YU` has eight questions
   at 6/6, so he was not blind throughout
   ([`picture-loading.md`](decisions/picture-loading.md)).
3. **40 sleeve albums will not resolve at all** — GB album search returns
   tributes and soundtracks, so they need `collectionId`s found by hand in the
   store. The audit names them every run.
4. **29 of 30 season rows carry an *estimated* `form`**, seeded by
   `npm run backfill-form` — the scores it is defined over were never stored, so
   these are invented and decay as people bank. Real ones were not overwritten
   ([`season.md`](decisions/season.md)).
5. **A quizmaster dropping out mid-round** needs a browser and `host-room`.
6. **No Content-Security-Policy.** Deliberate: a `<meta http-equiv>` CSP breaks
   the live app silently and the stale CDN makes that painful to diagnose.
7. **Three things still want a second person**: the review panel, a quizmaster
   handover, two squads on one board. **Not the rank bonus or the wager** —
   [`round-types.md`](decisions/round-types.md#the-prose-was-wrong-and-that-is-a-finding).
8. **The Ladder stops climbing** once a pack's thin `easy`/`hard` bucket is
   spent — it substitutes medium. The fix is a fold of `games/` into real
   difficulty, **a query now rather than a build**, and `games/` now holds
   eleven rounds rather than three, so it is no longer gated on playing.
9. **Do not paste `master`'s rules over the console.** The repo is byte-forward
   (39,218) but the console is the source of truth; a paste the wrong way deletes
   a live anti-cheat. `check-rules` **69/69 both ways, 10 September**.
10. **Hand-built packs need a seed after any *new* ids.** All seeded as of
    10 September; an unseeded pack breaks at reveal.
11. **`firstMs` and the pack picker are live and unplayed.** It is a deterrent,
    so the only test is whether his behaviour changes next round:
    [`first-touch.md`](decisions/first-touch.md).
12. **Cass could not join `CUC4`**, undiagnosed, no join ever written — **ask her
    what the screen said** ([`app-check-auth.md`](decisions/app-check-auth.md)).
13. **#52 has now been played eight times and `RevealTiming` is being written** —
    every round since carries gate/resolve/dispatch. No stall has recurred, so
    the reveal fix is still unproved rather than disproved
    ([`reveal-delays.md`](decisions/reveal-delays.md)).
14. **Branches:** #35–#49 closed or merged, nothing open. **On
    `picture-loading-and-sleeves-ocr`, unpushed:** the picture box, the preload,
    the side-by-side layout, the sleeves gate. Also unpushed:
    `ask-recovery-code` (cheapest on the list), `clock-bed-and-key-repeat`,
    `bound-elapsed-ms`, `fold-votes-dry-run`, `context-standards-route`,
    `vote-tally` (WIP). ~40 merged remote branches could be pruned.
    

## Where things are

`src/engine/` pure TS rules, no React or Firebase — all the logic worth testing.
`src/lib/` Firebase wiring, packs, clock, audio, stills, and the name / squad /
sound / volume preferences. `src/screens/` one per phase, plus `Preview`.

Commands: the table in [`AGENTS.md`](../AGENTS.md), plus `fetch-questions`,
`fetch-otqa`, `asked-probe`, `take-stock`, `prune-rooms`, `write-*-pack`,
`check-bundle`, `read-games`, and two new ones — **`sleeve-audit`** (Mac + `uv`;
reads what is printed on each album cover) and **`still-dimensions`** (sizes
every still in the packs). `npm test` covers `src/` plus the pure parts of
`scripts/`; anything touching the network stays out, so it runs offline — a test
importing `read-games` breaks that, since that module calls `main()` at import.

## If you're picking this up cold

**The token leak is closed and the gate is on `master`**, so a CI deploy is
safe. If rules matter: `npm run check-rules` and `npm run sync-harness 10`, both
green 10 September (69/69 both ways; 10/10, 0 dropped).

**Seeded 21 September** — 42 added, 1 changed, nothing deleted, and read back
from Firestore: 44 of 44 published sleeves hold a valid answer. The 52-question
pack still live keeps working, because the seed only ever adds.

Bitten more than once: **the rules are published by hand**, so the repo copy is
not what Firebase runs ([`security.md`](decisions/security.md)); **the answer
window lives in `firestore.rules` as well as the client**
([`answer-window.md`](decisions/answer-window.md)).
