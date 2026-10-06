# TOTAL-RECALL

> **Owner: Greg Rothwell. Last updated: 6 October 2026. Budget: 300 lines.**

The dated spine. Newest first, a few lines per entry. When one needs more room
than that it moves to `decisions/<topic>.md` and the entry here keeps a pointer —
depth goes outward, chronology stays central.

Append; do not rewrite an earlier entry to make it look as if we always knew. A
correction is a new dated note that says what changed, and the wrong claim stays
visible.

**Split eight times, 28 August to 29 September 2026** — every time this file hit
300. Entries move *verbatim* to [`recall/2026-08.md`](recall/2026-08.md) or
[`recall/2026-09.md`](recall/2026-09.md) and leave a dated pointer here, so the
chronology still reads end to end. Shortening an old entry to make the number go
down is the thing the paragraph above forbids.

Two lessons the next split will meet again. **A split's numbers go stale if it
sits unmerged** — the 4 September one was cut at 350, landed on the 8th at 360,
and described the wrong file until re-checked. And **an entry moved a directory
down breaks every relative link in it**: fourteen were, repaired 21 September.

*Six paragraphs of split history condensed to this on 21 September — process
notes, not chronology; every entry they described is still listed below by date.*

## 2026-10-06 — The Price Was Right built; "nothing American" written down (`office-feedback-6-oct`)

Greg believed "no American questions" was already a principle; it was only `classify.ts`'s
harvest filter, which hand packs never pass through. Now in `AGENTS.md`. Parked idea #2 built
blind: 95 ONS prices, given now, guess 5/10/20/30 years back — shop-quote medians for 5 and
10, RPI average prices for 20 and 30 (the quotes have nothing 1996–2009). AC "no engine
change" broke: the client shuffles options, so `ordered` (`1de868b`). Unseeded
([`price-was-right.md`](decisions/price-was-right.md)).

## 2026-10-06 — First office rounds of #67 and #68: chair, bonus, Blankety Blank (`office-feedback-6-oct`)

Room `RRGM`, 6 seats: Blankety Blank then Catchphrase. **No chair on the first:** the wager
left four on 0 and third place was one of them; `seatedLast` refused a tie touching the podium
by design. Reversed ([`final-card.md`](decisions/final-card.md)). **Cass, Catchphrase Q1:** no
answer of hers reached the room, nor Roberto's; the other four came in at 7.6–9.7 s of 10.
Unresolved until she says whether her screen read *You didn't answer* or *didn't reach the
room in time*. **Bonus options now from the first frame**; Catchphrase 93% → 78%, Greg wants
harder still ([`catchphrase-difficulty.md`](decisions/catchphrase-difficulty.md)). **Blankety
Blank:** 21 American out, 29 British in, 148, not seeded ([`blankety-blank.md`](decisions/blankety-blank.md)).

## 2026-10-06 — Live: #68 (gh-pages `3fbc003`): Blankety Blank, 18 packs

Greg's "let's go live" 08:56 → merged `28263ec` 08:59:25 (Greg; the harness's classifier
refused `gh pr merge`) → master CI green 09:03:26 → Pages `built` 09:04:32: **about 8 minutes**.
Live `index.json` lists 18 packs; `blanks.json` serves 140, no answer field. The bundle hash is
unchanged and that is correct: no client code imports `PACK_IDS`, and the local build that
played `N9AS` produced the same `index-DdEoFaVD`.

## 2026-10-06 — Blankety Blank built and seeded, 140 questions, played blind

Greg's parked idea #1, as a four-option pack: no engine change, no paste. Every phrase and
every distractor checked against its source both ways (`blanks-check`, 140/140); the first
run caught three distractors that were real variants. Seeded 140, read back 140/140; a
`host-room` reveal proved it end to end. Branch `blankety-blank`, **not deployed**.
[`blankety-blank.md`](decisions/blankety-blank.md).

## 2026-10-06 — Live: #67 (gh-pages `9124fc0`): every played pack grown

Word go 08:04 → live 08:15:54, about 12 minutes. The packs read 90 / 212 / 445 / 424 on the live site. The bundle
is unchanged (`index-DdEoFaVD`), so the pack sizes were the check. Seeded 378, read back 1,171/1,171 by Greg.
Freshness after: Catchphrase 4.6 fresh rounds (was 2.3), Sleeves 8.0 (5.0), On the box 19.7, Tunes 19.9.
Claude's `gh pr merge` went through this time.

## 2026-10-06 — Overnight: every played pack grown, nothing live

Greg: "beef up the packs", then "we need more catchphrases". Two background agents and two Whisper audits ran,
with a pause at the 5-hour limit, 23:15–03:10. Catchphrase 60 → 90, built blind. Sleeves 168 → 212 (pre-screened,
44 of 759). On the box 296 → 445. Tunes 268 → 424. All local, unseeded:
[`pack-growth-plan.md`](decisions/pack-growth-plan.md#done-overnight--6-october-2026).

## 2026-10-05 — #66 live: Catchphrase 60, Bonus Catchphrase, Sleeves 168

Live at 22:13 (`index-DdEoFaVD`, gh-pages `f8a3552`). The batch was **kept** for the office.
Seeded 94, read back 228/228. Word go → live took about 1h46m, roughly 70 minutes of it GitHub
Actions runner queues, during an incident. The first office Catchphrase round is the live check,
before Fri 9 Oct. [`go-live-oct-2026.md`](decisions/go-live-oct-2026.md#done--5-october-2026).

## 2026-10-05 — Catchphrase 60, everything prepped, and the batch named in chat

The harder batch was drawn (one redraw) and picked; it is 30 → 60, with Mr Fries in 21 (`08d09e9`).
Nothing is seeded, pushed or deployed: [`go-live-oct-2026.md`](decisions/go-live-oct-2026.md).
**Claude named all 30 new answers in chat while picking**, so Greg decides keep or replace.

## 2026-10-05 — Sleeves 168, a freshness check, and the harder batch half drawn

Catchphrase (30 of 30) and Sleeves (105 of 104) were both spent. Sleeves 104 → 168
(`9095987`, about 1 in 7 candidates ships). `npm run freshness` plus a weekday scheduled
task, because launchd cannot read ~/Documents. Harder batch: 8 of 30 drawn, paused at 7%
battery. [`sleeves-growth.md`](decisions/sleeves-growth.md) · [`pack-freshness.md`](decisions/pack-freshness.md).

## 2026-10-05 — Mr Fries: the bean chosen, and the hook for him built

Greg chose A, the bean, from four bodies. D drew SpongeBob, so look-alikes
are now part of the by-eye check. A spec opts in with `fries`; the 30 shipped
prompts are pinned by hash. No new pictures yet. [`decisions/mr-fries.md`](decisions/mr-fries.md#chosen--5-october-2026).

## 2026-10-05 — Mr Fries researched: prompt-only holds, movement is charm

Six drawings, one fixed description: the same chap in all six, but the bow tie
held in only 3. A Vision cut-out plus a stretch makes an 81–94 KB breathing WebP,
but only where he stands clear of things. Nothing built; Greg decides.
[`decisions/mr-fries.md`](decisions/mr-fries.md).

## 2026-10-05 — Bonus Catchphrase built, local only (`106863d`)

Every 5th question: nine squares lift one per tenth of the clock, five up at
the options, and it pays double base and rank (Greg's pick; not the stake or
steal). No rule, field or paste. Gallery + 1,245 tests; **no live room** —
Greg: the next office round is the check. [`decisions/catchphrase-difficulty.md`](decisions/catchphrase-difficulty.md#built--5-october-2026).

## 2026-10-05 — Catchphrase: the office agrees, and a Bonus Catchphrase is next

Office round `K3EN`, 7 seats, 15 s clock: 93% right, median 1.7 s after the
options landed, "hard" the best-answered label. A longer hold would not help.
Greg chose the show's Bonus Catchphrase as every fifth question, scoring more;
story approved, not built. Then harder puzzles, and maybe a house character,
"Mr Fries". [`decisions/catchphrase-difficulty.md`](decisions/catchphrase-difficulty.md).

## 2026-10-02 — Live: `index-RzBR8yIZ` (#65, gh-pages `a49f801`): ready for thirty

[#65](https://github.com/gregjrothwell/quiz/pull/65) merged as `66c4413` at
23:33:07. Live at 23:37:16, byte-identical to a local build (`8ab702612ad7`).
Contents:
- A crowded lectern counts past 12 chips instead of growing.
- The standings' Next is sticky.
- 30-player preview screens.
- `sync-harness 30`: 30/30.
- A 30-player round costs 14.6k–32.7k reads ([`decisions/cost.md`](decisions/cost.md)).

Word go → live took 43 minutes, "push" → live 12; where it went and how to
cut it: [`decisions/ci-deploy.md`](decisions/ci-deploy.md#lead-time-measured-2-october-2026--word-go-to-live-in-43-minutes).

## 2026-10-02 — Public scale: target B chosen; PLAN written, not confirmed

The lost 15 Aug appendix recovered; seams now (host authority, tenancy, content rule), the rest on a trigger. [`decisions/public-scale.md`](decisions/public-scale.md).

## 2026-10-02 — Catchphrase's first round: 10 of 10, too easy

Greg alone, `H4DS`, 10 s clock: every answer 0.8–3.1 s after the options
landed, "hard" no slower than "easy". Solved from the picture; the hold works,
the puzzles are easy. One player, and 17 of the 30 were in a list he skimmed.
Levers: [`decisions/catchphrase-difficulty.md`](decisions/catchphrase-difficulty.md).

## 2026-10-02 — Live: `index-DPum3N0P` (#64, gh-pages `7a8dc6f`)

Greg said merge and deploy. [#64](https://github.com/gregjrothwell/quiz/pull/64)
merged `6d1e3a7` 15:57:05Z, PR e2e still running; master verify, e2e, publish
green; gh-pages `7a8dc6f` (Actions) 16:00:08, Pages `built` 46s. **Live bundle
byte-identical to a local build** (`94ef589f8400`). 17 packs. **Unplayed.**

## 2026-10-02 — Catchphrase: options at halfway, and Greg plays it blind

Greg chose the 1980s look and, worried four options make the answer obvious,
the picture alone for half the clock (`src/engine/optionsHold.ts`, client only,
no paste). He plays the round, so Claude checks the drawings, twelve named
phrases were swapped out, and no doc names an answer.

## 2026-10-02 — Catchphrase: the pictures come from a free model on Greg's Mac

Greg turned down emoji-and-words and a paid image API. Z-Image-Turbo through
`mflux` (Apache 2.0, not gated, 32.9 GB) drew 5 phrases three times each: 14 of
15 readable after one prompt rewrite, lettering only where asked, no prompt in
the files. **Quantising at load swapped a 24 GB Mac to 70 s a step; a saved
8-bit copy runs at 11–13 s.** Nothing built; story and 30 phrases await Greg.
[`decisions/catchphrase.md`](decisions/catchphrase.md).

## 2026-09-22 to 2026-09-30 — archived, one line each

Moved verbatim to [`recall/2026-09.md`](recall/2026-09.md) on 6 October, at 300 lines.

- **2026-09-30** — [Live: `index-frzpKPeW` (#63, gh-pages `9cf24c8`)](recall/2026-09.md#2026-09-30--live-index-frzpkpew-63-gh-pages-9cf24c8)
- **2026-09-30** — [Joe's missing points were not missing; the music rounds start at once](recall/2026-09.md#2026-09-30--joes-missing-points-were-not-missing-the-music-rounds-start-at-once)
- **2026-09-29** — [Live: `index-BJxsEAQd` (#62, gh-pages `f5a273b`)](recall/2026-09.md#2026-09-29--live-index-bjxseaqd-62-gh-pages-f5a273b)
- **2026-09-27** — [Live: `index-BJIHPrGR` (#61, gh-pages `6b06c51`)](recall/2026-09.md#2026-09-27--live-index-bjihprgr-61-gh-pages-6b06c51)
- **2026-09-22** — [Live: `index-BE_5Hyg5` (#59, gh-pages `7b72a40`)](recall/2026-09.md#2026-09-22--live-index-be_5hyg5-59-gh-pages-7b72a40)

## 2026-09-04 to 2026-09-24 — archived, one line each

*Collapsed from four-line stubs on 30 September 2026 to make room, and the
21 September stubs the same way on 5 October; every entry is verbatim in the
archive, and nothing was shortened. Four more (21–22 September) collapsed the
same way on the afternoon of 5 October, and the three of 24 September archived whole
that evening.*

- **2026-09-24** — [Live: `index-fy6Fyqpa` (#60, gh-pages `5bf6290`)](recall/2026-09.md#2026-09-24--live-index-fy6fyqpa-60-gh-pages-5bf6290)
- **2026-09-24** — [On the box: 54 to 187, stacked on Share or Shaft](recall/2026-09.md#2026-09-24--on-the-box-54-to-187-stacked-on-share-or-shaft)
- **2026-09-24** — [Split or Steal: a final after the last question, not a mode](recall/2026-09.md#2026-09-24--split-or-steal-a-final-after-the-last-question-not-a-mode)
- **2026-09-22** — [The store badge was handing out the answer, on both packs](recall/2026-09.md#2026-09-22--the-store-badge-was-handing-out-the-answer-on-both-packs)
- **2026-09-22** — [The pin refused the reveal: every round stuck on question one](recall/2026-09.md#2026-09-22--the-pin-refused-the-reveal-every-round-stuck-on-question-one) · depth: [`decisions/postmortem-the-pin-that-refused-the-reveal.md`](decisions/postmortem-the-pin-that-refused-the-reveal.md)
- **2026-09-21** — [Live: `index-OfECpKrx` (#56, gh-pages `f78379e`)](recall/2026-09.md#2026-09-21--live-index-ofecpkrx-56-gh-pages-f78379e)
- **2026-09-21** — [Vault oracle, joinedAt, and the `at` stamp](recall/2026-09.md#2026-09-21--vault-oracle-joinedat-and-the-at-stamp) · depth: [`decisions/security-round-sept-2026.md`](decisions/security-round-sept-2026.md)
- **2026-09-21** — [Live: `index-BHcNzJzP` (#54, gh-pages `026d7cd`)](recall/2026-09.md#2026-09-21--live-index-bhcnzjzp-54-gh-pages-026d7cd)
- **2026-09-21** — [Correction: the sleeve audit missed a third of them, and a person found the rest](recall/2026-09.md#2026-09-21--correction-the-sleeve-audit-missed-a-third-of-them-and-a-person-found-the-rest)
- **2026-09-21** — [The picture sits beside the answers now](recall/2026-09.md#2026-09-21--the-picture-sits-beside-the-answers-now)
- **2026-09-21** — [Sleeves: the cover was the answer key on 11 of 15](recall/2026-09.md#2026-09-21--sleeves-the-cover-was-the-answer-key-on-11-of-15)
- **2026-09-21** — [The pictures did not turn up, and it was never the files](recall/2026-09.md#2026-09-21--the-pictures-did-not-turn-up-and-it-was-never-the-files)

- **2026-09-11** — [#52 live: `index-n26s0ofl`](recall/2026-09.md#2026-09-11--52-live-index-n26s0ofl)
- **2026-09-11** — [The round was the best yet, and three things came out of it](recall/2026-09.md#2026-09-11--the-round-was-the-best-yet-and-three-things-came-out-of-it)
- **2026-09-10** — [Playwright prerequisites: jsdom, emulators, e2e job](recall/2026-09.md#2026-09-10--playwright-prerequisites-jsdom-emulators-e2e-job)
- **2026-09-10** — [Node 20 deprecation: the four actions clear it at three different majors](recall/2026-09.md#2026-09-10--node-20-deprecation-the-four-actions-clear-it-at-three-different-majors)
- **2026-09-10** — [Season form seeded on old rows, and they are estimates](recall/2026-09.md#2026-09-10--season-form-seeded-on-old-rows-and-they-are-estimates)
- **2026-09-10** — [Deploys come from CI now (`index-qJCbuGrA`)](recall/2026-09.md#2026-09-10--deploys-come-from-ci-now-index-qjcbugra)
- **2026-09-10** — [Three corrections the live project made to the docs](recall/2026-09.md#2026-09-10--three-corrections-the-live-project-made-to-the-docs)
- **2026-09-10** — [The season form ranking was live, then silently reverted](recall/2026-09.md#2026-09-10--the-season-form-ranking-was-live-then-silently-reverted)
- **2026-09-10** — [Deploy guard added; CI outlined for later](recall/2026-09.md#2026-09-10--deploy-guard-added-ci-outlined-for-later)
- **2026-09-10** — [Token revoked and reissued; leak closed](recall/2026-09.md#2026-09-10--token-revoked-and-reissued-leak-closed)
- **2026-09-10** — [Live: the debug-token gate (`index-V9wVdhyu`), and #40 for the rules](recall/2026-09.md#2026-09-10--live-the-debug-token-gate-index-v9wvdhyu-and-40-for-the-rules)
- **2026-09-10** — [Correction: the console was ahead of the repo, not behind](recall/2026-09.md#2026-09-10--correction-the-console-was-ahead-of-the-repo-not-behind)
- **2026-09-10** — [Live: volume, clip cuts, 177 songs (`index-C3jZR3XU`)](recall/2026-09.md#2026-09-10--live-volume-clip-cuts-177-songs-index-c3jzr3xu)
- **2026-09-10** — Name that Tune worked; volume, giveaways, 177 songs — [`recall/2026-09.md`](recall/2026-09.md) · depth: [`decisions/tunes-round.md`](decisions/tunes-round.md)
- **2026-09-09** — The whole day, archived — [`recall/2026-09.md`](recall/2026-09.md)
- **2026-09-08** — The whole day, archived — [`recall/2026-09.md`](recall/2026-09.md)
- **2026-09-04** — Three more entries archived — [`recall/2026-09.md`](recall/2026-09.md)
- **2026-09-04** — Three entries archived — [`recall/2026-09.md`](recall/2026-09.md)

## Earlier — the full chronology, archived

Forty-two entries, moved on 28 August, 2 September, 8 September 2026 (twice) and
9 September, unchanged. Newest first, as above.

- **2026-09-04** — [The hand-built answers are in the public repo](recall/2026-09.md#2026-09-04--the-hand-built-answers-are-in-the-public-repo)
- **2026-09-04** — [Live, and the CDN lied for a minute](recall/2026-09.md#2026-09-04--live-and-the-cdn-lied-for-a-minute)
- **2026-09-04** — [The mute button, and a squad nobody could pick](recall/2026-09.md#2026-09-04--the-mute-button-and-a-squad-nobody-could-pick)
- **2026-09-04** — [The first right answer steals from the leader](recall/2026-09.md#2026-09-04--the-first-right-answer-steals-from-the-leader)
- **2026-09-04** — [The chair seats everybody, and the prose was wrong](recall/2026-09.md#2026-09-04--the-chair-seats-everybody-and-the-prose-was-wrong)
- **2026-09-02** — [Both went live the same afternoon](recall/2026-09.md#2026-09-02--both-went-live-the-same-afternoon)
- **2026-09-02** — [The repeats, and a wager that had never existed](recall/2026-09.md#2026-09-02--the-repeats-and-a-wager-that-had-never-existed)
- **2026-08-29** — [A design review lands, and four of its six get built](recall/2026-08.md#2026-08-29--a-design-review-lands-and-four-of-its-six-get-built)
- **2026-08-28** — [The rig gets operated](recall/2026-08.md#2026-08-28--the-rig-gets-operated)
- **2026-08-28** — [A UI audit, and the verdict pills get a thumb](recall/2026-08.md#2026-08-28--a-ui-audit-and-the-verdict-pills-get-a-thumb)
- **2026-08-28** — [A dependency pass, and four majors held back](recall/2026-08.md#2026-08-28--a-dependency-pass-and-four-majors-held-back)
- **2026-08-28** — [Squads score during the round](recall/2026-08.md#2026-08-28--squads-score-during-the-round)
- **2026-08-28** — [A reload keeps your seat](recall/2026-08.md#2026-08-28--a-reload-keeps-your-seat)
- **2026-08-28** — [The ideas list re-sorted around what shipped](recall/2026-08.md#2026-08-28--the-ideas-list-re-sorted-around-what-shipped)
- **2026-08-28** — [Voting and auto-join are live, and proved on the deployed site](recall/2026-08.md#2026-08-28--voting-and-auto-join-are-live-and-proved-on-the-deployed-site)
- **2026-08-28** — [The office can vote a question out](recall/2026-08.md#2026-08-28--the-office-can-vote-a-question-out)
- **2026-08-28** — [The join link goes straight into the room](recall/2026-08.md#2026-08-28--the-join-link-goes-straight-into-the-room)
- **2026-08-28** — [The shared clock is live, and has been played](recall/2026-08.md#2026-08-28--the-shared-clock-is-live-and-has-been-played)
- **2026-08-20** — [host-room reads the answers, and scores them](recall/2026-08.md#2026-08-20--host-room-reads-the-answers-and-scores-them)
- **2026-08-20** — [The shared clock, and a harness that scores nothing](recall/2026-08.md#2026-08-20--the-shared-clock-and-a-harness-that-scores-nothing)
- **2026-08-20** — ["The Ladder" was already taken](recall/2026-08.md#2026-08-20--the-ladder-was-already-taken)
- **2026-08-20** — [The final screen makes a shareable card](recall/2026-08.md#2026-08-20--the-final-screen-makes-a-shareable-card)
- **2026-08-20** — [Scoring is a rank bonus, not a speed curve](recall/2026-08.md#2026-08-20--scoring-is-a-rank-bonus-not-a-speed-curve)
- **2026-08-20** — [Three directional decisions, and an ideas review](recall/2026-08.md#2026-08-20--three-directional-decisions-and-an-ideas-review)
- **2026-08-20** — [App Check on auth is enforcing after all, hours late](recall/2026-08.md#2026-08-20--app-check-on-auth-is-enforcing-after-all-hours-late)
- **2026-08-20** — [check-rules was not leaking; the three rows were older than the fix](recall/2026-08.md#2026-08-20--check-rules-was-not-leaking-the-three-rows-were-older-than-the-fix)
- **2026-08-20** — [take-stock had been under-reporting since weekly boards shipped](recall/2026-08.md#2026-08-20--take-stock-had-been-under-reporting-since-weekly-boards-shipped)
- **2026-08-20** — [The squad dropdowns were never styled](recall/2026-08.md#2026-08-20--the-squad-dropdowns-were-never-styled)
- **2026-08-20** — [The reveal was a coin flip, and the host's device always called it](recall/2026-08.md#2026-08-20--the-reveal-was-a-coin-flip-and-the-hosts-device-always-called-it)
- **2026-08-20** — [Anonymous account purge: reviewed, and the answer is don't](recall/2026-08.md#2026-08-20--anonymous-account-purge-reviewed-and-the-answer-is-dont)
- **2026-08-20** — [App Check enforced on the Realtime Database](recall/2026-08.md#2026-08-20--app-check-enforced-on-the-realtime-database)
- **2026-08-20** — [Build-time code moved out of `src/`, and two routes stopped shipping](recall/2026-08.md#2026-08-20--build-time-code-moved-out-of-src-and-two-routes-stopped-shipping)
- **2026-08-20** — [The pack seal was a convention, not a test](recall/2026-08.md#2026-08-20--the-pack-seal-was-a-convention-not-a-test)
- **2026-08-20** — [The handover was split, because it cost more than the code](recall/2026-08.md#2026-08-20--the-handover-was-split-because-it-cost-more-than-the-code)
- **2026-08-20** — [Correction: the room count, settled by measuring](recall/2026-08.md#2026-08-20--correction-the-room-count-settled-by-measuring)
- **2026-08-20** — [`host-room` had been dead for weeks](recall/2026-08.md#2026-08-20--host-room-had-been-dead-for-weeks)
- **2026-08-20** — [Squads, weekly boards and the average table went live](recall/2026-08.md#2026-08-20--squads-weekly-boards-and-the-average-table-went-live)
- **2026-08-19** — [`recordGame` proved against the live project](recall/2026-08.md#2026-08-19--recordgame-proved-against-the-live-project)
- **2026-08-17** — [A `joinedAt` from one room walked into another](recall/2026-08.md#2026-08-17--a-joinedat-from-one-room-walked-into-another)
- **2026-08-16** — [App Check enforcing on Cloud Firestore](recall/2026-08.md#2026-08-16--app-check-enforcing-on-cloud-firestore)
- **2026-08-15** — [Six wrong statements about Google's console in one afternoon](recall/2026-08.md#2026-08-15--six-wrong-statements-about-googles-console-in-one-afternoon)
- **2026-08-15** — [Rooms pruned, and TTL turned out to need billing](recall/2026-08.md#2026-08-15--rooms-pruned-and-ttl-turned-out-to-need-billing)
- **2026-08-15** — [Teams, then squads](recall/2026-08.md#2026-08-15--teams-then-squads)
- **2026-08-15** — [The security review](recall/2026-08.md#2026-08-15--the-security-review)
- **2026-08-14** — [The clock, heard rather than reasoned about](recall/2026-08.md#2026-08-14--the-clock-heard-rather-than-reasoned-about)
- **2026-08-13** — [A refused reveal stalled the round for minutes](recall/2026-08.md#2026-08-13--a-refused-reveal-stalled-the-round-for-minutes)
- **2026-08-13** — [The vault is ahead of the packs, not behind](recall/2026-08.md#2026-08-13--the-vault-is-ahead-of-the-packs-not-behind)
- **2026-08-03** — [`season-2` started with the office](recall/2026-08.md#2026-08-03--season-2-started-with-the-office)
