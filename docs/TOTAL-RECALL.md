# TOTAL-RECALL

> **Owner: Greg Rothwell. Last updated: 21 October 2026. Budget: 300 lines.**

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

## 2026-10-21 — Live: #94 (gh-pages `3b00a0e`): Random Round's last question, the lobby shelves; The Price is Right seeded

Greg: "Go live with #94." CI green on the PR head (Playwright against emulators), merged `565d20e` 08:41 BST → build, e2e, rules, gh-pages green 08:47. Live `index-DLJOhSAP` is byte-identical to a local build of `565d20e`; the finale list and the shelves are in it, and the live gallery shows both shelves. Live check: the next office Random Rounds. Before it, on Greg's word: The Price is Right seeded (81 added, read back 81/81) and `host-room --pack tags` revealed in 149 ms with no payload logged; not deployed (`decisions/price-is-right.md` lands with its PR).

## 2026-10-20 — Random Round's last question, the lobby shelves, The Price is Right begun

Greg: Random Round always ended on an album, "almost like the last question is a random answer". Measured: 9 rounds, all The Ladder; a sleeve last in 7, 18% right; hard prices 6%. Decided: the last is never a sleeve or a price ([`random-round.md`](decisions/random-round.md#20-october-2026--the-last-question-is-never-a-sleeve-or-a-price)). Handover item 18, both lobby grids: show rounds first (45 of the last 60 rounds), Random Round two tiles wide, a sound mark ([`lobby-shelves.md`](decisions/lobby-shelves.md)). Both on `release-20-oct`, not live. **The Price is Right** (`tags`, blind): a picture, guess today's price; 81 ONS items, writer and draw script on `price-is-right`, waiting on Greg's pick of drawing style (`decisions/price-is-right.md` on that branch). Lint is red locally from five stale `.claude/worktrees`, not from the code.

## 2026-10-17 — Live: #91 (gh-pages `f6268e6`): The Price Was Right 154, Catchphrase 233

Ranked by runway (Random Round's six-way deal is most of the burn, and `freshness` files it under Random): Prices
95 → 154 and Catchphrase 178 → 233, both blind, written by subagents in worktrees; drawn on the MacBook (Greg: the Mini
would crash). "go live with #91" → seeded 60 + 55, 0 changed, read back 154/154 and 233/233 → `host-room` on two *new*
ids each (`--pack` plays the first two, which are old) → merged `9017238` 21:27 BST → Pages by 21:34, packs and
`index.html` byte-identical to a local build, 55 stills served. **One Prices question cut before merge**: a loose grep of
host-room's log printed three of its options (the SDK logs refused reveals in clear). Live check: the first office round.

## 2026-10-15 — Live: #88 + #87 (gh-pages `7d42c0e`): W1, W2 and W3 in one deploy

Greg's "go live" on #88 → merged `72791a9` 21:34 BST → e2e → the `rules` job (WIF's first sign-in; the W3 Firestore
ruleset uploaded and released, RTDB released) → Pages 21:40. `index-C__7fXbz` byte-identical to a local build.
Live: `check-rules` 119/119 (91 + 28 W3), `rank-harness -- --browser` all ✓ in a hosted room, `sync-harness 30`
30/30 within 102 ms, `host-room` reveal from `lastPicks`. Found: App Check 429s a burst of debug-token exchanges and
`appCheck.ts` blames safelisting; the `--browser` run banked "Claude 600" on the week board (documented cost).
AC10 is not measurable here: Cloud Monitoring needs billing. [`host-authority.md`](decisions/host-authority.md).

## 2026-10-15 — W3 finished; the release with W2 and W3 built, not live

#87 (W1, W2, #79 record) was merged 20:50 BST on "go live by the end of the session", which was a deadline, not
the words; the master run was cancelled before rules or Pages, so `master` sits ahead of live. Then W3: the AC8
stall found and fixed (a joiner listed answers before the room was read, was refused, and the same query never
confirmed when the chair passed to it); AC12 and the final's allow cases added; `check-rules` 28 W3 cases;
three harnesses make hosted rooms that beat. e2e 15/15. [`host-authority.md`](decisions/host-authority.md#15-october-evening-the-ac8-stall-and-the-gaps-closed).

## 2026-10-15 — Branch `w3-host-authority` (PR #86): W3, host authority, built and not live

The room names its host (`hostUid`); only the host moves it on, members write only about themselves, answers are the
host's and the author's, the reveal publishes the picks (`lastPicks`), lamps are on the RTDB. Leave hands the chair
over; a 15 s beat and a claim at 75 s of silence cover the host whose tab closes (AC8, e2e). Expand half only: rooms
without `hostUid` keep the member rule. **No rule published** — W2 is not live. Harnesses and `check-rules` not yet
moved to hosted rooms; AC10 unmeasured. [`host-authority.md`](decisions/host-authority.md#what-was-built-15-october-2026).

## 2026-10-15 — Branch `rules-from-ci`: W2, CI publishes both rulesets, keyless

A `rules` job after e2e and before the site, master only, through one impersonated service account (no key). The
third role, Service Usage Consumer, was found by a 403 in a dry run, not in any doc. Live rules equal the repo, so the
first publish is a no-op. Probe PRs #82/#83: a broken file of either kind turns e2e red. Not live: Greg's Cloud Shell step, then W1, then "go live".
[`rules-from-ci.md`](decisions/rules-from-ci.md).

## 2026-10-15 — Branch `tmdb-credit`: W1, TMDB's logo and notice; D6 added

Greg took the plan's five decisions as recommended, then added D6: league owners sign in (Google, linked to their
anonymous account), players stay anonymous; W4 is now 3–5 sessions. W1: TMDB's own logo (its sha256 is its filename)
under every On the box still, Random Round included, and logo plus notice in the lobby. Not live. Found for W5: a rebuild
re-fetches no still (`existingBySlug`). [`public-scale.md`](decisions/public-scale.md#the-plan-15-october-2026).

## 2026-10-15 — Productionisation plan: five work items, five decisions for Greg, a TMDB gap

Nothing on the public-scale list had moved since 2 Oct. Sequenced it: TMDB credit → rules from CI → host authority →
tenancy → a TMDB still refresh before 9 Mar 2027; rules from CI now goes *before* host authority. TMDB's terms (fetched
today) need a logo and notice in the app for every user, and the live site has neither. [`public-scale.md`](decisions/public-scale.md#the-plan-15-october-2026).

## 2026-10-15 — Live: #79 (gh-pages `54fb8d8`): long names cut on the reveal chips

Greg merged #79 (it carried #78) at 16:04; live 16:11 BST. `index-BUTUL1rQ`, byte-identical to a local build; the
live gallery's "Reveal · long names" measures as the preview did. Office check: the first round with a long name.

## 2026-10-15 — Branch `reveal-name-truncate`: long names cut on the reveal chips

A long name on a reveal chip squeezed the option text on a laptop and drew over it on a phone. The name now ellipsises
at 7rem (~16 letters) or less where the lectern is tighter; the time is never cut. The option text wraps first, so
short names stayed whole at every width measured, 320–1440. Gallery "Reveal · long names" (`#/preview/53`). Not live.

## 2026-10-15 — Live: #77 (gh-pages `3b63b5a`): a reload no longer resets the vote lock

Greg merged #77 (it carried #76) at 10:56; live 11:01 BST. `index-BWSiBKMq`, byte-identical to a local build.
Office-lobby check still to come ([`lobby-vote.md`](decisions/lobby-vote.md)).

## 2026-10-15 — Branch `vote-taps-on-room`: a reload no longer resets the vote lock

Somebody refreshed past #75's two taps — the gap it had accepted. The count moves to the room (`voteTaps.{uid}`,
`increment(1)` in the vote's own write): no extra write or read, no paste. Not live ([`lobby-vote.md`](decisions/lobby-vote.md)).

## 2026-10-14 — Live: #75 (gh-pages `21ccbd5`): the lobby vote locks after two taps

Players were clicking round the vote cards for fun. Built at three taps; Greg: "1 vote per player — we can
relax later", then "actually — 2". Client-side, no paste ([`lobby-vote.md`](decisions/lobby-vote.md)). First real
question-vote data: ~1 verdict per 100 answers, 49/54 bad, and the one over the line is a prompt cut off at a colon —
88 such ([`question-votes.md`](decisions/question-votes.md)). One PR with #74; Greg merged. Live `index-DV3kGh-I`, byte-identical.

## 2026-10-12 — Live: #73 + #58 (gh-pages `ed0bac5`): the lobby vote, dead code out

`lobby-vote` (local-only since 8 Oct) merged with `live-after-72`; no paste (room `update` has no key whitelist; `check-rules` live 91/91).
#58 would have broken typecheck: master's `catchphrase-draw.ts` imports `readCovers`; kept it (`fd725c0`). Greg merged both 33s
apart: two deploys, #58 alone live 09:07–09:09 UTC. Hence AGENTS.md: one PR per release. Live `index-D-g9FXdU`, byte-identical.

## 2026-10-12 — Live: #72 (gh-pages `70535a6`): Catchphrase 178, Random Round, Name the Artist

Greg: "we have multiple changes to go live with". He chose all five branches, merged into one
`release-12-oct`: Catchphrase batches 4+5 (88 in, 2 dropped), Cursor's Random Round and Name the
Artist (259), and two docs branches. The two features clashed only on adding a pack id; kept both.
Artist answers rebuilt here (`artists.json` byte-identical), seeded 259, read back 259/259.
Played live from a local build: a Random Round of 15, all revealed, bonus squares on Q15; one Artist
reveal. Not seen live: the Catchphrase hold inside Random. Local e2e has no Java; CI ran it.
Greg merged `d4ab6dc` 05:37; live `index-NiEMPDcb` 05:41, byte-identical to a local build.

## 2026-10-08 — Lobby vote built on `lobby-vote`, not deployed, held past Friday's 30

Every player sees the packs and votes; the quizmaster still picks. No ruleset paste; e2e proves a
second browser's vote counts, and red when the write is refused. [`lobby-vote.md`](decisions/lobby-vote.md).

## 2026-10-07 — Live: #71 (gh-pages `f89a603`): Lite reveal, podium ties, price decoys

Greg: "build everything and we can go live to have a demo tomorrow." The first price fix made any
option over today's price mean "it got cheaper", so 8 rising questions now carry a decoy over it
(`c3ec3c6`, 0 answers changed). Podium: one riser per person, height by place (`71fcfac`).
`draw-overnight` (`dd04bbd`). Reveal over Firestore Lite, all four at once (`0d6e964`): median 71ms
v #70's 167ms, interleaved in a browser; both directions 6/6. `gh pr merge` was refused by the
session's permission check, so Greg merged `8bba4fd`; CI green, live `index-DxSLpmmr` 11:25 BST,
markers checked in the served bundle. Depth: [`decisions/office-feedback-7-oct.md`](decisions/office-feedback-7-oct.md).

## 2026-10-07 — Office feedback from `XRUE`: Price Was Right options rebuilt, four planned

Greg, after `XRUE`: some Price Was Right questions had one option under today's price, and it was
the answer. Measured: 6 of 95 like that, 46 of 95 with an option at or above today's. Rebuilt
(`17946ce`, local): every option under today's when the price rose; 87 of 95 now all-under, the 8
that fell or held straddle it; 0 answers changed, no reseed. Levels now 24/28/43. Planned, with
Greg's calls: podium ties (riser per person, height by place), overnight drawing, reveal over
Firestore Lite **after Friday** (worst `XRUE` reveal 3.2s, two refusals). Greg has a Claude Design
system this session cannot see. Depth: [`decisions/office-feedback-7-oct.md`](decisions/office-feedback-7-oct.md).

## 2026-10-02 to 2026-10-06 — archived, one line each

Moved verbatim to [`recall/2026-10.md`](recall/2026-10.md) on 7 October, at 300 lines; the first two on 12 October, at 294; the three from 5 October on 14 October, at 299; Mr Fries' choice on 15 October, at 303; Sleeves 168 the same day, at 303 again; the two 6 October pack-growth entries the same day again, at 306 with W3's; #68 and Blankety Blank built the same night, at 309 with the W3 release entry; the first office rounds of #67 and #68 the same night again, at 304 with the go-live; The Price Was Right built on 17 October, at 302 with #91's go-live; #70 and #69 on 20 October, at 296, with the Random Round, lobby and Price is Right entry.

- **2026-10-06** — [Live: #70 (gh-pages `d3266ae`): the vault stops at the hit](recall/2026-10.md#2026-10-06--live-70-gh-pages-d3266ae-the-vault-stops-at-the-hit)
- **2026-10-06** — [Live: #69 (gh-pages `51a30de`): The Price Was Right, British Blankety Blank, 19 packs](recall/2026-10.md#2026-10-06--live-69-gh-pages-51a30de-the-price-was-right-british-blankety-blank-19-packs)
- **2026-10-06** — [The Price Was Right built; "nothing American" written down (`office-feedback-6-oct`)](recall/2026-10.md#2026-10-06--the-price-was-right-built-nothing-american-written-down-office-feedback-6-oct)
- **2026-10-06** — [First office rounds of #67 and #68: chair, bonus, Blankety Blank](recall/2026-10.md#2026-10-06--first-office-rounds-of-67-and-68-chair-bonus-blankety-blank-office-feedback-6-oct)
- **2026-10-06** — [Live: #68 (gh-pages `3fbc003`): Blankety Blank, 18 packs](recall/2026-10.md#2026-10-06--live-68-gh-pages-3fbc003-blankety-blank-18-packs)
- **2026-10-06** — [Blankety Blank built and seeded, 140 questions, played blind](recall/2026-10.md#2026-10-06--blankety-blank-built-and-seeded-140-questions-played-blind)
- **2026-10-06** — [Live: #67 (gh-pages `9124fc0`): every played pack grown](recall/2026-10.md#2026-10-06--live-67-gh-pages-9124fc0-every-played-pack-grown)
- **2026-10-06** — [Overnight: every played pack grown, nothing live](recall/2026-10.md#2026-10-06--overnight-every-played-pack-grown-nothing-live)
- **2026-10-05** — [#66 live: Catchphrase 60, Bonus Catchphrase, Sleeves 168](recall/2026-10.md#2026-10-05--66-live-catchphrase-60-bonus-catchphrase-sleeves-168)
- **2026-10-05** — [Catchphrase 60, everything prepped, and the batch named in chat](recall/2026-10.md#2026-10-05--catchphrase-60-everything-prepped-and-the-batch-named-in-chat)
- **2026-10-05** — [Sleeves 168, a freshness check, and the harder batch half drawn](recall/2026-10.md#2026-10-05--sleeves-168-a-freshness-check-and-the-harder-batch-half-drawn)
- **2026-10-05** — [Mr Fries: the bean chosen, and the hook for him built](recall/2026-10.md#2026-10-05--mr-fries-the-bean-chosen-and-the-hook-for-him-built)
- **2026-10-05** — [Mr Fries researched: prompt-only holds, movement is charm](recall/2026-10.md#2026-10-05--mr-fries-researched-prompt-only-holds-movement-is-charm)
- **2026-10-05** — [Bonus Catchphrase built, local only (`106863d`)](recall/2026-10.md#2026-10-05--bonus-catchphrase-built-local-only-106863d)
- **2026-10-05** — [Catchphrase: the office agrees, and a Bonus Catchphrase is next](recall/2026-10.md#2026-10-05--catchphrase-the-office-agrees-and-a-bonus-catchphrase-is-next)
- **2026-10-02** — [Live: `index-RzBR8yIZ` (#65, gh-pages `a49f801`): ready for thirty](recall/2026-10.md#2026-10-02--live-index-rzbr8yiz-65-gh-pages-a49f801-ready-for-thirty)
- **2026-10-02** — [Public scale: target B chosen; PLAN written, not confirmed](recall/2026-10.md#2026-10-02--public-scale-target-b-chosen-plan-written-not-confirmed)
- **2026-10-02** — [Catchphrase's first round: 10 of 10, too easy](recall/2026-10.md#2026-10-02--catchphrases-first-round-10-of-10-too-easy)
- **2026-10-02** — [Live: `index-DPum3N0P` (#64, gh-pages `7a8dc6f`)](recall/2026-10.md#2026-10-02--live-index-dpum3n0p-64-gh-pages-7a8dc6f)
- **2026-10-02** — [Catchphrase: options at halfway, and Greg plays it blind](recall/2026-10.md#2026-10-02--catchphrase-options-at-halfway-and-greg-plays-it-blind)
- **2026-10-02** — [Catchphrase: the pictures come from a free model on Greg's Mac](recall/2026-10.md#2026-10-02--catchphrase-the-pictures-come-from-a-free-model-on-gregs-mac)

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
