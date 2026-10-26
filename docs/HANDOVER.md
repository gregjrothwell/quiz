# Handover — Vibe Quiz

> **Owner: Greg Rothwell. Last updated: 26 October 2026. Budget: 150 lines.**

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
| **the CI deploy, the secret check, Playwright, the emulator**; anything that adds reads or writes | [`lead-time.md`](decisions/lead-time.md) (**go-live: Plan job, PR build reused, What's new gate**) · [`ci-deploy.md`](decisions/ci-deploy.md) · [`rules-from-ci.md`](decisions/rules-from-ci.md) · [`emulators.md`](decisions/emulators.md) (each e2e spec wipes first, 23 Oct, live with #140) · [`cost.md`](decisions/cost.md) · [`audit-backlog.md`](decisions/audit-backlog.md) |
| — before assuming a style choice, a bug, or a claim in here | [`gotchas.md`](decisions/gotchas.md) · [`known-limits.md`](decisions/known-limits.md) · [`state-of-play.md`](decisions/state-of-play.md) |
| what a question is worth, and why it is not a speed curve; **calling a Catchphrase** before the options (live 21 Oct, #104) | [`decisions/scoring.md`](decisions/scoring.md) · [`typed-answers.md`](decisions/typed-answers.md) |
| the shareable result card, and how it gets to the player; **the What's new page** (live 22 Oct, #107; lobby link, New stickers, and the Beat the Chaser intro that opens question one after a few seconds — players see “Get ready — question one is coming up”, 23 Oct; live 23 Oct, #140) | [`decisions/final-card.md`](decisions/final-card.md) · [`updates-page.md`](decisions/updates-page.md) |
| what to build next, what each idea costs, what was turned down; **the 22 Oct direction review** (security sweep, the Lab, five wow ideas); **the Slop Cannon and the error beacon** (live 26 Oct, #154) | [`slop-cannon.md`](decisions/slop-cannon.md) · [`direction-oct-2026.md`](decisions/direction-oct-2026.md) · [`what-to-build-next.md`](decisions/what-to-build-next.md) · [`picking-up.md`](decisions/picking-up.md) · [`ideas-review.md`](decisions/ideas-review.md) · [`scope.md`](decisions/scope.md) |
| picture, music, jigsaw or steal rounds, **negative points**, why melody played badly; **a random round**; **Survey Says** (live 22 Oct, #131 — [`survey-says.md`](decisions/survey-says.md)); **Beat the Chaser**, **the Commentator**, **Quiz Wrapped** (live 22 Oct, #136 — [`beat-the-chaser.md`](decisions/beat-the-chaser.md), [`commentator.md`](decisions/commentator.md), [`quiz-wrapped.md`](decisions/quiz-wrapped.md)) | [`round-types.md`](decisions/round-types.md) · [`melody-round.md`](decisions/melody-round.md) · [`random-round.md`](decisions/random-round.md) |
| **Name that Tune** clips that give it away; **the volume slider and the two autoplay gates**; **the lobby sound check**; **the Apple Music badge and Apple's terms**; **Name the Artist**; **Theme Tunes** (blind, 65, branch `tv-themes`, not live) | [`tunes-round.md`](decisions/tunes-round.md) · [`tv-themes.md`](decisions/tv-themes.md) · [`tunes-title-gate.md`](decisions/tunes-title-gate.md) · [`audio-stack.md`](decisions/audio-stack.md) · [`sound-check.md`](decisions/sound-check.md) · [`known-limits.md`](decisions/known-limits.md) · [`name-the-artist.md`](decisions/name-the-artist.md) |
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

**Live is `index-B-mCNyGu`** (#154, 26 Oct 20:48 GMT, merge `e2fab8c`, gh-pages `4ea6796`; master 1m50s, rules from CI; live bundle byte-identical; `check-rules` **147/0**): **the Slop Cannon and the error beacon** ([`slop-cannon.md`](decisions/slop-cannon.md)) — no shots loaded, Keep/Bin on Final for Mr Fries (to 5 Nov) and the Double (end of the morning, to 8 Nov), the cannon fires after the fanfare; `clientErrors/` from every page. CI back to 7m58s on six shards, no apt ([`emulators.md`](decisions/emulators.md)).
Before it `index-t7PF9llL` (#152, 25 Oct 23:02 GMT, merge `b52330d`): host-room `--pack themes|higher`, CI e2e in four shards, Dependabot dev bumps.
Before it `index-DoX2y2L_` (release #147, 25 Oct 01:10 BST, merge `9d70a5c`, gh-pages `5c999e2`; 9/9 files byte-identical, `check-rules` 139/0) — **The Double** ([`morning-double.md`](decisions/morning-double.md)), **Theme Tunes 65** ([`tv-themes.md`](decisions/tv-themes.md)) and **Higher or Lower 90** ([`higher-or-lower.md`](decisions/higher-or-lower.md)), both blind; standings rank members only. Before it `index-C2KxhalW` (#146, 24 Oct 10:27 BST, merge `43f14ee`, gh-pages `81a85de`): **Geekend keep their own question history** — `seasons/season-2-geekend/asked/{pack}`, and a lobby "Who's playing" switch. Before it #145 (24 Oct, `d26ca41`, `index-CoblXX9Z`): **Geekend is a squad**. Before it #140 (`release-23-oct`, 23 Oct 13:43, `a0ce60a`): the lit-lamp reveal hold (3s cap), What's new in the lobby, the Ladder notice, Beat the Chaser's title card, Dependabot #115–#118. Every bundle before these, with hashes: [`live-history.md`](decisions/live-history.md).
**Owed for #154:** the first round with Mr Fries or the Double → `npm run read-cannon` shows its Keep/Bin; `npm run read-errors` after the next office round (no player row yet — a live client's beacon is unproved, the built-in browser fails App Check).
**Live checks still owed:** the first Double, Theme Tunes and Higher or Lower rounds (`read-games`; Higher or Lower: 55–85% right, or re-band); the first Geekend round makes `season-2-geekend/asked/{pack}` and leaves `season-2`'s doc for that pack unchanged; the first office round under W3 (`read-games`); #79's long name; #77's lobby reload; **#104's first final and first Catchphrase call**. **Finals backfill written 21 Oct** (12 rows, read back); re-run the dry run in a few days, since an old bundle erases its own tallies. Firebase chunk `firebase-DwYnjfYh` since #111 (Vite 8.3.5), so returning players fetch it once.
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
   spent — it still substitutes, and says so (live 23 Oct, #140; [`repeats.md`](decisions/repeats.md)).
   A fold of `games/` does not fix it ([`beat-the-chaser.md`](decisions/beat-the-chaser.md)).
   Re-rating plan, not chosen: [`ladder-rerating.md`](decisions/ladder-rerating.md).
9. **Rules are published by hand until W2 is live; then by CI on `master`** ([`rules-from-ci.md`](decisions/rules-from-ci.md)). Live = repo, read 15 Oct.
   `check-rules` **91/91 both ways, 27 September**; run it after any rules merge. Read [`security.md`](decisions/security.md) first.
10. **Seed before any new ids ship** — `seed-vault -- --pack <id>`; unseeded breaks at reveal. **All seeded 17 Oct**, with
    `release-17-oct` (#91): Prices 95→154, Catchphrase 178→233, both blind ([`price-was-right.md`](decisions/price-was-right.md), [`catchphrase-batch-6.md`](decisions/catchphrase-batch-6.md)).
11. **`firstMs` and the pack picker are live and unplayed.** It is a deterrent,
    so the only test is whether his behaviour changes next round:
    [`first-touch.md`](decisions/first-touch.md).
12. **Cass's question-one write is slow; she sees the question on time** (23 Oct, 24 traces): ack 4.8s and
    2.4s, both counted. Same 4g room otherwise 0.1–0.3s (Rach 1.4s). The host holds the reveal up to 3s
    for a lit lamp (Greg, 23 Oct: covers the 2.4s write; 15s rounds largely avoid it; 4.8–5.5s not covered). Live 23 Oct, #140 ([`cass-q1.md`](decisions/cass-q1.md)).
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
