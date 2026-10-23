# Handover — Vibe Quiz

> **Owner: Greg Rothwell. Last updated: 23 October 2026. Budget: 150 lines.**

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
| repeats and the question history; staking points on the last question; **the Share or Shaft final** (live with #60, 24 Sep); **finals on the seats** (live 21 Oct, #104) | [`repeats.md`](decisions/repeats.md) · [`wager.md`](decisions/wager.md) · [`share-or-shaft.md`](decisions/share-or-shaft.md) · [`finals-history.md`](decisions/finals-history.md) |
| the vault, reveals, answer secrecy, **the answer window**, and **a reveal that stalls** | [`vault.md`](decisions/vault.md) · [`answer-window.md`](decisions/answer-window.md) · [`reveal-delays.md`](decisions/reveal-delays.md) |
| the season table, squads, `recordGame`, anything called `team`; the August board; squads **during** a round | [`season.md`](decisions/season.md) · [`season-shipped.md`](decisions/season-shipped.md) · [`live-squads.md`](decisions/live-squads.md) |
| the opening titles, honours, rosettes | [`form-and-awards.md`](decisions/form-and-awards.md) |
| `playerId`, recovery codes, claiming, the anonymous-account purge | [`identity.md`](decisions/identity.md) |
| the clock and the countdown, and whose clock it runs on | [`clock.md`](decisions/clock.md) · [`shared-clock.md`](decisions/shared-clock.md) |
| joining, room codes, links, presence; **the lobby vote** (live 12 Oct, #73); **the lobby's pack shelves** (20 Oct) | [`decisions/joining.md`](decisions/joining.md) · [`lobby-vote.md`](decisions/lobby-vote.md) · [`lobby-shelves.md`](decisions/lobby-shelves.md) |
| scoring an answer that lands late; the review panel and the replay | [`late-answers.md`](decisions/late-answers.md) · [`review-replay.md`](decisions/review-replay.md) |
| packs, harvesting, classification, **On the box / TMDB stills**; **Blankety Blank** and **The Price Was Right** (both blind); **Name the Artist** (259, seeded 12 Oct) | [`questions.md`](decisions/questions.md) · [`blankety-blank.md`](decisions/blankety-blank.md) · [`price-was-right.md`](decisions/price-was-right.md) · [`name-the-artist.md`](decisions/name-the-artist.md) · **Catchphrase drawing, the Mini:** [`catchphrase-batch-5.md`](decisions/catchphrase-batch-5.md) |
| **a picture that does not turn up**, preloading, the box a still gets | [`decisions/picture-loading.md`](decisions/picture-loading.md) |
| **an album cover that names its own album**, the sleeve audit; **a song from the album at half the clock** (live 29 Sep, #62) | [`decisions/sleeves-gate.md`](decisions/sleeves-gate.md) · [`sleeves-song.md`](decisions/sleeves-song.md) |
| voting on a question, retiring one; **first real data 14 Oct — 88 prompts cut off at a colon** | [`question-votes.md`](decisions/question-votes.md#the-first-real-data--14-october-2026) |
| rules and App Check — Firestore and RTDB, then **auth**, then the debug token and why a deploy must not come off `master` | [`security.md`](decisions/security.md) · [`app-check-auth.md`](decisions/app-check-auth.md) · [`debug-token-leak.md`](decisions/debug-token-leak.md) |
| **the vault oracle, `joinedAt`, the `at` stamp, presence names** | [`security-round-sept-2026.md`](decisions/security-round-sept-2026.md) |
| **tightening any rule, gate or permission** — read this one *first*, it is why #56 broke the game | [`postmortem-the-pin-that-refused-the-reveal.md`](decisions/postmortem-the-pin-that-refused-the-reveal.md) |
| **the CI deploy, the secret check, Playwright, the emulator**; anything that adds reads or writes | [`lead-time.md`](decisions/lead-time.md) (**go-live: Plan job, PR build reused, What's new gate**) · [`ci-deploy.md`](decisions/ci-deploy.md) · [`rules-from-ci.md`](decisions/rules-from-ci.md) · [`emulators.md`](decisions/emulators.md) · [`cost.md`](decisions/cost.md) · [`audit-backlog.md`](decisions/audit-backlog.md) |
| — before assuming a style choice, a bug, or a claim in here | [`gotchas.md`](decisions/gotchas.md) · [`known-limits.md`](decisions/known-limits.md) · [`state-of-play.md`](decisions/state-of-play.md) |
| what a question is worth, and why it is not a speed curve; **calling a Catchphrase** before the options (live 21 Oct, #104) | [`decisions/scoring.md`](decisions/scoring.md) · [`typed-answers.md`](decisions/typed-answers.md) |
| the shareable result card, and how it gets to the player; **the What's new page** (live 22 Oct, #107; lobby link, New stickers, and the Beat the Chaser intro, 23 Oct) | [`decisions/final-card.md`](decisions/final-card.md) · [`updates-page.md`](decisions/updates-page.md) |
| what to build next, what each idea costs, what was turned down; **the 22 Oct direction review** (security sweep, the Lab, five wow ideas) | [`direction-oct-2026.md`](decisions/direction-oct-2026.md) · [`what-to-build-next.md`](decisions/what-to-build-next.md) · [`picking-up.md`](decisions/picking-up.md) · [`ideas-review.md`](decisions/ideas-review.md) · [`scope.md`](decisions/scope.md) |
| picture, music, jigsaw or steal rounds, **negative points**, why melody played badly; **a random round**; **Survey Says** (live 22 Oct, #131 — [`survey-says.md`](decisions/survey-says.md)); **Beat the Chaser**, **the Commentator**, **Quiz Wrapped** (live 22 Oct, #136 — [`beat-the-chaser.md`](decisions/beat-the-chaser.md), [`commentator.md`](decisions/commentator.md), [`quiz-wrapped.md`](decisions/quiz-wrapped.md)) | [`round-types.md`](decisions/round-types.md) · [`melody-round.md`](decisions/melody-round.md) · [`random-round.md`](decisions/random-round.md) |
| **Name that Tune** clips that give it away; **the volume slider and the two autoplay gates**; **the lobby sound check**; **the Apple Music badge and Apple's terms**; **Name the Artist** | [`tunes-round.md`](decisions/tunes-round.md) · [`tunes-title-gate.md`](decisions/tunes-title-gate.md) · [`audio-stack.md`](decisions/audio-stack.md) · [`sound-check.md`](decisions/sound-check.md) · [`known-limits.md`](decisions/known-limits.md) · [`name-the-artist.md`](decisions/name-the-artist.md) |
| whether an answer can change and the spam exploit; `firstMs` and the snap guess | [`answer-spam.md`](decisions/answer-spam.md) · [`first-touch.md`](decisions/first-touch.md) |
| what a finished round left behind, and reading it back | [`decisions/game-record.md`](decisions/game-record.md) |
| upgrading `package.json`; the studio set and lighting cues; **the game-show moments** (reveal, podium, wipe — live 21 Oct, #100) | [`dependencies.md`](decisions/dependencies.md) · [`lighting.md`](decisions/lighting.md) · [`game-show-moments.md`](decisions/game-show-moments.md) |

## State as of 14 October 2026

> **READ FIRST — the Friday 9 October game of 30 did not happen.**
> - The biggest room ever played is still 11. Thirty answering at once is untested.
> - #65 (live 2 Oct) folds a crowded lectern into "+N" past 12 chips and keeps
>   the standings' Next on screen. `sync-harness 30`: 30/30.
> - A future 30-player round is still one of ≤20 questions (14.6k–32.7k reads,
>   [`cost.md`](decisions/cost.md)). Two such rounds go past 50k. The 9 October blackout is lifted.
> - **Catchphrase: Greg plays it blind, so keep its answers out of docs and chat.**
>   **#72 live 12 Oct: Catchphrase 90 → 178, Random Round, Name the Artist 259.** The first office round of each is the live check (`read-games`); the Catchphrase hold inside Random was never seen live. Parked: an automated growth loop for all popular packs — [`catchphrase-batch-5.md`](decisions/catchphrase-batch-5.md).
>   **9 Oct:** two 5-seat rounds that morning cost ~1.2k reads, so one 30-player round of ≤20 still fits ([`office-feedback-9-oct.md`](decisions/office-feedback-9-oct.md)).
> - **Greg to decide:** answering after the music stops; the two lead-time cuts ([`ci-deploy.md`](decisions/ci-deploy.md)).
>   **Productionisation plan decided 15 Oct** (all six as recommended; D6: league owners sign in, players stay anonymous); W1, **a TMDB credit the live site
>   lacked**; **W2, rules from CI** ([`rules-from-ci.md`](decisions/rules-from-ci.md)); **W3, host authority, expand half** ([`host-authority.md`](decisions/host-authority.md)). **All three live 15 Oct.** Next: W3's contract half after 14 Nov; W4; W5 by 1 Mar 2027 — [`public-scale.md`](decisions/public-scale.md#the-plan-15-october-2026).

**#91 live 17 Oct 21:34 BST** (merge `9017238`, gh-pages `f6268e6`): packs only, so the bundle is unchanged; live check is the first office round of each.
**Live is `index-gzyAYqlA`** (#138, 22 Oct 22:49 BST, merge `a410e22`, gh-pages `4ef3623`, 16 files byte-identical, `check-rules` 136/0): **the Commentator's voice off** (captions stay), **the drum roll rebuilt** — it was the "staccato" sound ([`game-show-moments.md`](decisions/game-show-moments.md#the-drum-roll-rebuilt--22-october-2026)), **the podium caption on the frozen table**. Before it `index-BK-1i2u1` (release #136, 22 Oct 21:03 BST, merge `d8771be`, gh-pages `79633da`, 13 files byte-identical, `check-rules` 136/0, `rig/` RTDB rules 2 allow + 3 deny live, `rank-harness` K859): **the host in `src/host/`** ([`host-loop.md`](decisions/host-loop.md)), **the rig check** (Friday phone run still to do — [`rig-in-your-hand.md`](decisions/rig-in-your-hand.md)), **Beat the Chaser**, **the Commentator** (lines are drafts for Greg to cut), **Quiz Wrapped** (hidden until 5 Dec). Before it `index-CgiLmoB3` (release #131, 22 Oct 16:33 BST, merge `8ca1cba`, gh-pages `f3c478b`, 12 assets byte-identical, `check-rules` 136/136): **rounds bank again** (#121, the season rule was over Firestore's 1,000-expression limit — [`finals-history.md`](decisions/finals-history.md#22-october-2026-nobodys-round-banked)), **Survey Says** (#130, [`survey-says.md`](decisions/survey-says.md)), audit fixes #124–#127, drifted docs #123. Before it `index-CYR8cluB` (#111: **the security sweep**, [`security-sweep-oct-2026.md`](decisions/security-sweep-oct-2026.md); #114: What's new lines; 22 Oct 08:46 BST, merges `8fe1628` and `0556d32`, gh-pages `324a6bd`, 14/14 assets byte-identical; `check-rules` 133/133; `rank-harness` EBSW). **#113 live 22 Oct** (`1f5fb8a`, CI only, bundle unchanged): master runs in ~1½ min on the PR's build ([`lead-time.md`](decisions/lead-time.md)). Before it `index-BmjDGoTc` (#110: landing links beside Join, the sound check stops), `index-Blr7sNEQ` (#107: What's new page + #90's W3 scripts), `index-DnncXodV` (#104: finals history on the seats, call it on Catchphrase), #100 (`index-DYv-seCH`, the game-show moments), #98 (the Q1 trace), #96 (`index-BAaZqtS-`, **The Price is Right**, 81, blind).
Before it `index-DLJOhSAP` (#94, 08:47: Random Round never ends on a sleeve or a price; the lobby shelves), then `index-C__7fXbz` (#88 + #87, 15 Oct: W1, W2, W3; `check-rules` 119/119, `sync-harness 30` 30/30). **Live checks: the first office round under W3** (`read-games`), #79's long name, #77's lobby reload, #94's first Random Round (`read-games --pack random`) and **#96's first Price is Right** (`read-games --pack tags`), and **#104's first final and first Catchphrase call**. **Finals backfill written 21 Oct** (12 rows, read back); re-run the dry run in a few days, since an old bundle erases its own tallies. Firebase chunk `firebase-DwYnjfYh` since #111 (Vite 8.3.5), so returning players fetch it once.
**21 packs** + **Random Round** (six played packs dealt into one); **The Price Was Right 154**, **The Price is Right 81** and **Blankety Blank 148** (all blind); **Catchphrase 233** (every 5th a double-scoring bonus); **Name that Tune 424**; **Name the Artist 259**; synth **Classical**; **On the box 445**
(hashed TMDB stills, at most 8 titles before 1990); **Flags** 76; **Sleeves 212**
after seven candidate batches, the last pre-screened; picture is **Fine Art** 49.

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
5. **A quizmaster dropping out mid-round**: W3's expand half has been live since 15 Oct; its scripts (#90) live 22 Oct with #107, harnesses green live — [`host-authority.md`](decisions/host-authority.md#what-was-built-15-october-2026).
6. **No Content-Security-Policy.** Deliberate: a `<meta http-equiv>` CSP breaks
   the live app silently and the stale CDN makes that painful to diagnose.
7. **Three things still want a second person**: the review panel, a quizmaster
   handover, two squads on one board. **Not the rank bonus or the wager** —
   [`round-types.md`](decisions/round-types.md#the-prose-was-wrong-and-that-is-a-finding).
8. **The Ladder stops climbing** once a pack's thin `easy`/`hard` bucket is
   spent — it substitutes medium. **Corrected 22 Oct:** a fold of `games/` does
   not fix it — it rates only questions already played, which never come back
   (65 rounds, 934 questions, 6 repeats; [`beat-the-chaser.md`](decisions/beat-the-chaser.md)). No fix chosen.
9. **Rules are published by hand until W2 is live; then by CI on `master`** ([`rules-from-ci.md`](decisions/rules-from-ci.md)). Live = repo, read 15 Oct.
   `check-rules` **91/91 both ways, 27 September**; run it after any rules merge. Read [`security.md`](decisions/security.md) first.
10. **Seed before any new ids ship** — `seed-vault -- --pack <id>`; unseeded breaks at reveal. **All seeded 17 Oct**, with
    `release-17-oct` (#91): Prices 95→154, Catchphrase 178→233, both blind ([`price-was-right.md`](decisions/price-was-right.md), [`catchphrase-batch-6.md`](decisions/catchphrase-batch-6.md)).
11. **`firstMs` and the pack picker are live and unplayed.** It is a deterrent,
    so the only test is whether his behaviour changes next round:
    [`first-touch.md`](decisions/first-touch.md).
12. **Cass loses question 1 on 10s rounds** (8/24 missed; 0/22 on 15s, 21 Oct): her Q1 answers land
    ~2–5.5s behind her own clock, no later one does, and a 10s fold leaves no room. Why is unknown:
    **#98 live 21 Oct, a Q1 trace from every device**; next office round, `read-traces -- --name cass` ([`cass-q1.md`](decisions/cass-q1.md)).
13. **Reveal over Firestore Lite, live 7 Oct (#71)**: all four at once, median vault step 71ms v #70's 167ms in a
    browser; **the next office round's `read-games` is the live check** ([`office-feedback-7-oct.md`](decisions/office-feedback-7-oct.md#4-the-slow-reveal)).
14. **Loose ends from 26–27 September**: five new tunes transcribed to nothing
    and want an ear (`live-forever`, `golden-touch`, `build-me-up-buttercup`,
    `call-the-shots`, `gangnam-style`); **56 rooms past expiry** —
    `npm run prune-rooms -- --go`; reCAPTCHA's monthly count is unmeasured (10k free per organisation).
15. **Sleeve songs (#62, #63) have been played** — `XDUF` at half the clock, then
    from the first frame ([`sleeves-song.md`](decisions/sleeves-song.md)). Five songs
    still want an ear; *Reasonable Doubt* and *Future Nostalgia* show a **single's**
    artwork (`titleMatches` takes a prefix). **Stopped 6 Oct:** that `host-room` (since 30 Sep),
    two more from 6 Oct, and six Vite servers from 4–9 Sep (5173–5175, 5277, 5288).
16. **#67 live 6 Oct 08:15:** Catchphrase 60→90 (blind), Sleeves 168→212, On the box 296→445, Tunes 268→424; seeded 378, read back 1,171/1,171. **The first rounds played are the live check** (the harder Catchphrase batches, step 9 of [`go-live-oct-2026.md`](decisions/go-live-oct-2026.md)). Plan for Greg's feedback: [`pack-growth-plan.md`](decisions/pack-growth-plan.md). Freshness weekdays 08:12.
17. **#69 live 6 Oct 13:05 BST** (after `RRGM`): Blankety Blank 148 (21 American out, 29 British in); **The Price Was Right**, 95 ONS prices, blind ([`price-was-right.md`](decisions/price-was-right.md)), `ordered` options; the chair seats a tie touching the podium; Bonus Catchphrase options from frame one. Seeded 124, read back 243/243; `host-room --pack prices` (`P3E9`) revealed from the vault in 0.28s. **Played `XRUE` 7 Oct (47%); 6 of 95 gave the answer away. #71 live 7 Oct: all options under today's price, 8 decoys over it, no reseed; podium ties; `npm run draw-overnight` (Greg runs it, never opens the sheets) — [`office-feedback-7-oct.md`](decisions/office-feedback-7-oct.md).** `AGENTS.md`: world-famous American is fine, needing American knowledge is not.
18. **#94 live 21 Oct:** the lobby's two card grids shelved, show rounds first ([`lobby-shelves.md`](decisions/lobby-shelves.md), was "the category page"); Random Round never ends on a sleeve or a price ([`random-round.md`](decisions/random-round.md#20-october-2026--the-last-question-is-never-a-sleeve-or-a-price)). **#96 live 21 Oct: The Price is Right** (`tags`, blind, a picture and today's price; seeded 81/81, `host-room` revealed) — [`price-is-right.md`](decisions/price-is-right.md). **Both checked live 21 Oct:** 3U48 played The Price is Right, 8/8 answering all ten, reveals ≤0.6s, no retries; 79YX's Random Round ended on a tune. Not in Random Round until Greg says. Lint is red locally only from stale `.claude/worktrees`; `eslint . --ignore-pattern '.claude/**'` is clean.

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

Bitten more than once: **the rules were published by hand** (CI from W2), so the repo copy
was not what Firebase ran ([`security.md`](decisions/security.md)); **the answer
window lives in `firestore.rules` as well as the client**
([`answer-window.md`](decisions/answer-window.md)).
