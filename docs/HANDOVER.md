# Handover — Vibe Quiz

> **Owner: Greg Rothwell. Last updated: 2 October 2026. Budget: 150 lines.**

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
| repeats and the question history; staking points on the last question; **the Share or Shaft final** (on `share-or-shaft`: rules live, **not deployed**; `more-picture-questions` stacks on it, so one merge ships both) | [`repeats.md`](decisions/repeats.md) · [`wager.md`](decisions/wager.md) · [`share-or-shaft.md`](decisions/share-or-shaft.md) |
| the vault, reveals, answer secrecy, **the answer window**, and **a reveal that stalls** | [`vault.md`](decisions/vault.md) · [`answer-window.md`](decisions/answer-window.md) · [`reveal-delays.md`](decisions/reveal-delays.md) |
| the season table, squads, `recordGame`, anything called `team`; the August board; squads **during** a round | [`season.md`](decisions/season.md) · [`season-shipped.md`](decisions/season-shipped.md) · [`live-squads.md`](decisions/live-squads.md) |
| the opening titles, honours, rosettes | [`form-and-awards.md`](decisions/form-and-awards.md) |
| `playerId`, recovery codes, claiming, the anonymous-account purge | [`identity.md`](decisions/identity.md) |
| the clock and the countdown, and whose clock it runs on | [`clock.md`](decisions/clock.md) · [`shared-clock.md`](decisions/shared-clock.md) |
| joining, room codes, links, presence | [`decisions/joining.md`](decisions/joining.md) |
| scoring an answer that lands late; the review panel and the replay | [`late-answers.md`](decisions/late-answers.md) · [`review-replay.md`](decisions/review-replay.md) |
| packs, harvesting, classification, **On the box / TMDB stills** | [`questions.md`](decisions/questions.md) |
| **a picture that does not turn up**, preloading, the box a still gets | [`decisions/picture-loading.md`](decisions/picture-loading.md) |
| **an album cover that names its own album**, the sleeve audit; **a song from the album at half the clock** (live 29 Sep, #62) | [`decisions/sleeves-gate.md`](decisions/sleeves-gate.md) · [`sleeves-song.md`](decisions/sleeves-song.md) |
| voting on a question, retiring one | [`question-votes.md`](decisions/question-votes.md) |
| rules and App Check — Firestore and RTDB, then **auth**, then the debug token and why a deploy must not come off `master` | [`security.md`](decisions/security.md) · [`app-check-auth.md`](decisions/app-check-auth.md) · [`debug-token-leak.md`](decisions/debug-token-leak.md) |
| **the vault oracle, `joinedAt`, the `at` stamp, presence names** | [`security-round-sept-2026.md`](decisions/security-round-sept-2026.md) |
| **tightening any rule, gate or permission** — read this one *first*, it is why #56 broke the game | [`postmortem-the-pin-that-refused-the-reveal.md`](decisions/postmortem-the-pin-that-refused-the-reveal.md) |
| **the CI deploy, the secret check, Playwright, the emulator**; anything that adds reads or writes | [`ci-deploy.md`](decisions/ci-deploy.md) · [`emulators.md`](decisions/emulators.md) · [`cost.md`](decisions/cost.md) · [`audit-backlog.md`](decisions/audit-backlog.md) |
| — before assuming a style choice, a bug, or a claim in here | [`gotchas.md`](decisions/gotchas.md) · [`known-limits.md`](decisions/known-limits.md) · [`state-of-play.md`](decisions/state-of-play.md) |
| what a question is worth, and why it is not a speed curve | [`decisions/scoring.md`](decisions/scoring.md) |
| the shareable result card, and how it gets to the player | [`decisions/final-card.md`](decisions/final-card.md) |
| what to build next, what each idea costs, what was turned down | [`what-to-build-next.md`](decisions/what-to-build-next.md) · [`picking-up.md`](decisions/picking-up.md) · [`ideas-review.md`](decisions/ideas-review.md) · [`scope.md`](decisions/scope.md) |
| picture, music, jigsaw or steal rounds, **negative points**, and why melody played badly | [`round-types.md`](decisions/round-types.md) · [`melody-round.md`](decisions/melody-round.md) |
| **Name that Tune** clips that give it away; **the volume slider and the two autoplay gates**; **the lobby sound check**; **the Apple Music badge and Apple's terms** | [`tunes-round.md`](decisions/tunes-round.md) · [`tunes-title-gate.md`](decisions/tunes-title-gate.md) · [`audio-stack.md`](decisions/audio-stack.md) · [`sound-check.md`](decisions/sound-check.md) · [`known-limits.md`](decisions/known-limits.md) |
| whether an answer can change and the spam exploit; `firstMs` and the snap guess | [`answer-spam.md`](decisions/answer-spam.md) · [`first-touch.md`](decisions/first-touch.md) |
| what a finished round left behind, and reading it back | [`decisions/game-record.md`](decisions/game-record.md) |
| upgrading `package.json`; the studio set and lighting cues | [`dependencies.md`](decisions/dependencies.md) · [`lighting.md`](decisions/lighting.md) |

## State as of 2 October 2026

> **READ FIRST — a game of up to 30 next week.**
> - The biggest room ever played is 11.
> - #65 (live 2 Oct) folds a crowded lectern into "+N" past 12 chips and keeps
>   the standings' Next on screen. `sync-harness 30`: 30/30.
> - **Play one 30-player round of ≤20 questions, and run nothing against live
>   that day.** Two big rounds go past 50k reads ([`cost.md`](decisions/cost.md)).
> - Untested: 30 people answering at once.
> - **Catchphrase (#64): Greg plays it blind, so keep its answers out of docs
>   and chat.**
> - **Greg to decide:** answering after the music stops; target B's four
>   questions ([`public-scale.md`](decisions/public-scale.md)); the two
>   lead-time cuts ([`ci-deploy.md`](decisions/ci-deploy.md)).

**Live is `index-RzBR8yIZ`** (2 Oct 23:37, gh-pages `a49f801`, `66c4413`/#65,
CI) — *check gh-pages **and** `pages/builds`; this one: `built` in 41s.* Firebase
chunk `firebase-W6iQUl4r`, unchanged since #61.
**17 packs**; **Catchphrase 30**; **Name that Tune 268**; synth **Classical**; **On the box 296**
(hashed TMDB stills, at most 8 titles before 1990); **Flags** 76; **Sleeves 104**
after four candidate batches and 42 refusals by eye; picture is **Fine Art** 49.

**What the office plays** — On the box, Sleeves and Tunes, at 4–11 seats: content binds, not
Firebase, except at thirty ([`cost.md`](decisions/cost.md)). **Check `read-games`, not the prose.**

**Otherwise:** `appcheck-probe` refuses at sign-in; reveal ~0.5s after the clock;
scoring 500 + rank 500/400/300/200/100.

## Outstanding

1. **Two contact sheets want a person**: On the box (109 new) and Sleeves (60
   new), sent 26–27 September. Only a model has looked, and on sleeves a model
   has missed a third of printed titles before. Refuse in `sleeve-refusals.ts`;
   drop a still from `hand-screens-data.ts`. Ratings are judgements.
2. **Ask Bret whether it was one picture or the lot.** `M9YU` has eight questions
   at 6/6, so he was not blind throughout
   ([`picture-loading.md`](decisions/picture-loading.md)).
3. **3 sleeve albums will not resolve** — Melody A.M., Nostalgia, Ultra, Weezer
   (Blue Album). The rest now carry `collectionId`s from the artist's catalogue.
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
9. **Rules are published by hand.** `check-rules` **91/91 both ways, 27
   September**. Read [`security.md`](decisions/security.md) before any paste.
10. **Seed before any new ids ship** — `npm run seed-vault -- --pack <id>` reads
    one pack. All seeded as of 27 September; an unseeded pack breaks at reveal.
11. **`firstMs` and the pack picker are live and unplayed.** It is a deterrent,
    so the only test is whether his behaviour changes next round:
    [`first-touch.md`](decisions/first-touch.md).
12. **Cass could not join `CUC4`**, no join ever written. Candidate, 27 Sep: one
    App Check 403 makes the SDK lock that browser out for **24 hours** ("Cannot
    reach the server"); seen live in the built-in browser. Ask what she saw.
13. **Every round since #52 writes `RevealTiming`; no stall has recurred** — the
    fix is unproved rather than disproved ([`reveal-delays.md`](decisions/reveal-delays.md)).
14. **Loose ends from 26–27 September**: five new tunes transcribed to nothing
    and want an ear (`live-forever`, `golden-touch`, `build-me-up-buttercup`,
    `call-the-shots`, `gangnam-style`); **56 rooms past expiry** —
    `npm run prune-rooms -- --go`; reCAPTCHA's monthly count is unmeasured
    (10k free per organisation); #58 `cleanup-dead-code` is open, unreviewed.
15. **Sleeve songs (#62, #63) have been played** — `XDUF` at half the clock, then
    from the first frame ([`sleeves-song.md`](decisions/sleeves-song.md)). Five songs
    still want an ear; *Reasonable Doubt* and *Future Nostalgia* show a **single's**
    artwork (`titleMatches` takes a prefix). **Stale processes, not this session's:**
    Vite (PID 29183) on 5273; `host-room --pack sleeves` (PID 51747, since 30 Sep).
16. **Catchphrase is too easy** — Greg solo (`H4DS`): 10/10, tapped 1.5 s after the options landed. Play an
    office round, then pick levers: [`catchphrase-difficulty.md`](decisions/catchphrase-difficulty.md).

## Where things are

`src/engine/` pure TS rules, no React or Firebase — all the logic worth testing.
`src/lib/` Firebase wiring, packs, clock, audio, stills, and the name / squad /
sound / volume preferences. `src/screens/` one per phase, plus `Preview`.

Commands: the table in [`AGENTS.md`](../AGENTS.md), plus `fetch-questions`,
`fetch-otqa`, `asked-probe`, `take-stock`, `prune-rooms`, `write-*-pack`,
`check-bundle`, `read-games`, `audit-players`, and two new ones — **`sleeve-audit`** (Mac + `uv`;
reads what is printed on each album cover) and **`still-dimensions`** (sizes
every still in the packs). `npm test` covers `src/` plus the pure parts of
`scripts/`; anything touching the network stays out, so it runs offline — a test
importing `read-games` breaks that, since that module calls `main()` at import.

## If you're picking this up cold

**The token leak is closed and the gate is on `master`**, so a CI deploy is
safe. If rules matter: `npm run check-rules` (91/91, 27 September) and
`npm run sync-harness 30` (30/30, 2 October).

**Seeded 27 September** — screens, sleeves and tunes: 270 added, 1 changed (an
id seeded earlier from an unpublished spec), read back 680/680. The seed only
ever adds, so anything still live keeps working.

Bitten more than once: **the rules are published by hand**, so the repo copy is
not what Firebase runs ([`security.md`](decisions/security.md)); **the answer
window lives in `firestore.rules` as well as the client**
([`answer-window.md`](decisions/answer-window.md)).
