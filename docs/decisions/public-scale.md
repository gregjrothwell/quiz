# Public scale — strangers in the room, and money

> **Owner: Greg Rothwell. Last updated: 15 October 2026. Budget: 250 lines.**

**Status: PLAN, not confirmed.** Nothing here is built. **The work, in order, and
Greg's five decisions are at the bottom** ([15 October](#the-plan-15-october-2026)).

**Where this came from.** The 15 August 2026 audit ended with a costed appendix,
*"scaling, tiers and monetisation"*, written into a Claude Code plan file. That
file was later deleted. Only the quadratic-read model and the RTDB connection cap
ever reached the repo ([`cost.md`](cost.md)). The rest — what public use would
need, and the monetisation costing — existed nowhere. It was recovered from the
session transcript on 2 October 2026 and revisited against the code that day.

On 2 October Greg chose **target B: strangers in the room, or monetised**. Target
A (other offices run their own private quiz, free) was about 6–9 sessions.

## The requirement, challenged

The requirement has a name and a date. Greg, 15 August: avoid things going
*"unexpectedly well but then scaling requires large re-writes"*. **So the
requirement is "no rewrite if it takes off", not "ship B now".** Those are
different jobs, so B splits in two:

- **Seams that get dearer with every feature.** Each new round type, phase or
  dispatch makes them more expensive to change later. Do these now.
- **Additive work.** Costs the same next year as today. Do it when something
  triggers it.

## The August list, as of 2 October 2026

| # | Item | August said | Now |
|---|---|---|---|
| 1 | App Check | cheap | **Done** — Firestore, RTDB and auth enforcing ([`app-check-auth.md`](app-check-auth.md)) |
| 2 | 6-character room codes | cheap | Not done, still cheap. `ROOM_CODE_LENGTH` in `src/engine/roomCode.ts`; rules do not check length (grep of `firestore.rules`, 2 Oct) |
| 3 | Answers onto RTDB | "one file" | **No longer one file.** The answer write rule now carries the arrival floor against the room's `openedAt`, plus `wager`, `firstMs` and the `at` stamp. RTDB rules cannot read a Firestore room. Seven scripts touch the answers path |
| 4 | Server authority (Cloud Functions) | the rewrite | Not done. `questionsPinned` and the vault gate cover parts; any member can still update the room (`allow update` uses `isMember()`) |
| 5 | Moderating names on the public board | real work | Not done |

**New since August:**

- **Tenancy.** Everything is global. `SEASON = 'season-2'` in
  `src/lib/season.ts`; `seasons/{season}/asked`, `questionVotes` and `games` are
  top-level. A second group would share the board, the repeat history and the
  votes.
- **Licensing.**
  - TMDB: *"does not permit any commercial use"* without a written agreement.
    Source: themoviedb.org/api-terms-of-use, **fetched 2 Oct 2026**. That covers
    On the box.
  - Apple iTunes: the quiz already fails two of the six conditions
    ([`known-limits.md`](known-limits.md#apples-terms-against-the-actual-text--22-september-2026),
    fetched 22 Sep). That covers Name that Tune, Sleeves and the sleeve song.
  - Text packs are CC BY-SA, so commercial use is allowed with attribution.
    Catchphrase is self-generated.
- **Hosting.** GitHub Pages is not allowed for a site *"primarily directed at…
  commercial transactions or… SaaS"*. Source:
  docs.github.com/…/github-pages-limits, **fetched 2 Oct 2026**.

## Deleted, and why

1. **Cloud Functions server authority — replaced by host authority in rules.**
   Read on 2 Oct:
   - Only the quizmaster's device ever dispatches phase changes, reveals and
     scores (`App.tsx`: the reveal is gated on `isQuizmaster`; `handleReveal`
     comment: *"the only one that reveals"*).
   - Every other client writes only these (`useRoom.ts`):
     - its own `players.{uid}`: join, squad, leave;
     - its own answer;
     - **its own `scores.{uid}` on joining.** That is either a zero or a
       *restored* score, which is a self-written score. Under host authority it
       has to become zero-only, or a write the host makes.
   - So the client is almost host-authoritative already; the rules just do not
     enforce it.
   - Storing a `hostUid` and limiting room-state writes to it is a rules change.
     It needs no Blaze.
2. **Answers onto RTDB — deleted if only the host reads answers.**
   - Today every client listens to every answer: Q·N² reads.
   - If answers are readable by the host only, and the host publishes the revealed
     answers in the reveal write it already makes, reads become roughly linear in
     N.
   - It also ends a player seeing others' picks before the reveal, which is
     accepted for colleagues and not for strangers.
   - **Estimate, not measured.**
3. **Payments in the first version — deferred.**
   - The 15 August costing put a 50-player game at about 2p on Blaze.
   - That costing rests on Firestore rates which were never verified (it said so
     itself).
   - Funding comes from a budget alert until a bill says otherwise.
4. **Moderation — mostly deleted by tenancy.** With no shared public board, a
   name is only seen by the group that typed it.

## The first version — three seams

**1. Host authority in rules.** Store `hostUid` on create:

- Phase, index, questions and scores become writable by the host only.
- Everyone else may only write their own `players.{uid}`.
- Answers become readable by the host only.

The cost is the derived quizmaster's automatic handover. **This undoes a
documented decision** — `CLAUDE.md` says not to without reading the handover
table ([`joining.md`](joining.md), [`identity.md`](identity.md)). A host who
drops out would pause the room. Today a quizmaster dropping out mid-round
already needs `host-room` (handover, Outstanding 5), so the loss is smaller than
it sounds, but it is a loss.

Unverified until the BUILD story checks them:

- that every dispatch type fits: standoff, squads, votes, wager, the reaper's
  removals;
- how the "who has answered" lamps survive, since showing every answer to every
  player is the N² term.

The postmortem's rules apply in full: **one allow case per rule function
touched** ([`postmortem-the-pin-that-refused-the-reveal.md`](postmortem-the-pin-that-refused-the-reveal.md)).

**2. Tenancy.**

- Add a `league` on the room.
- Move season, asked, votes and games under it.
- Migrate `season-2` into a league for the office.

The `seasons/{season}` wildcard already takes arbitrary ids (see
[`scope.md`](scope.md), the Daily Five). How far the rules change is unread.

**3. A content rule, not a build.** New media rounds use licence-clean sources:
self-generated (Catchphrase is the precedent), public domain, or CC BY-SA. The
iTunes and TMDB rounds stay office-only unless an agreement exists. **Zero
sessions; it is a decision.**

## Additive, on a trigger

| Item | Trigger | Size |
|---|---|---|
| 6-character codes | first public URL | small |
| Rules deployed from CI by `firebase-tools` instead of pasted | first public deploy — arguably sooner | small; removes the most repeated failure in this repo |
| Blaze plus a budget alert | near ~16 concurrent six-player rooms (100 RTDB connections, [`cost.md`](cost.md)) | console |
| Scheduled pruning, anonymous-account purge | Blaze | small |
| Privacy notice and deletion route | first stranger | small, mostly not code |
| Hosting off GitHub Pages | first payment | small |
| Host accounts and payments | the bill passes what Greg will fund | medium–large; a webhook needs a server, so Blaze plus one function |
| Licensed music and TV, or a TMDB agreement | monetising with those rounds | not engineering |

The August pricing idea was free rooms up to about 8 players, and a paid host at
about £4 a month for bigger rooms, private leagues and custom packs. One payer
per room, because the room is the unit of cost. It is unvalidated and recorded
only so it is not re-derived.

## Sizing (estimates, 2 October 2026)

| | Sessions |
|---|---|
| Host authority (seam 1) | 3–5. The riskiest: every phase, every harness, `check-rules` both ways |
| Tenancy (seam 2) | 2–3, including the `season-2` migration |
| Content rule (seam 3) | 0 |
| **Seams now** | **about 5–8** |
| Everything additive, later | about 3–4 weeks, plus licensing, which code does not solve |

Against **6–10 weeks** for all of B at once.

## Not covered

- Blaze unit prices are **not verified**. Check the calculator before quoting
  any figure.
- reCAPTCHA past 10,000 assessments a month is unstated ([`cost.md`](cost.md)).
- Not checked:
  - the sources of Flags and Fine Art; **checked 15 Oct:** public-domain flags
    from Flagcdn / Wikimedia (`write-flags-pack.ts`), PD-Art paintings from
    Commons (`hand-picture-data.ts`). Clean for commercial use;
  - whether round names borrowed from TV formats ("Name that Tune",
    "Catchphrase") matter commercially;
  - TMDB's attribution requirement for non-commercial use. **Checked 15 Oct:
    it applies to everyone, and the live site does not meet it** — below.

## Open decisions — all Greg's

*Restated 15 October as D1–D3 of the plan below. Item 4 changed: rules from CI
now go before host authority.*

1. **Is B "seams now, the rest on a trigger"?** Or build all of B now?
2. **Host authority: give up the automatic quizmaster handover?** For the office
   as well, or public rooms only? Two modes means two sets of rules; the
   recommendation is one.
3. **The iTunes and TMDB rounds: office-only, or ask TMDB for an agreement?**
4. **Order.** Recommended: host authority first. It is the riskier seam, and it
   deletes the RTDB item.

## The plan, 15 October 2026

Nothing above had moved since 2 October (`roomCode.ts`, `firestore.rules`,
`ci.yml`, read 15 Oct). One finding is new, and it does not wait for B.

**TMDB, fetched 15 Oct 2026** (themoviedb.org/api-terms-of-use):

- **The licence is conditional on attribution, for every user.** The TMDB logo,
  less prominent than the quiz's own marks, and a notice prominently in the app:
  *"This website uses TMDB and the TMDB APIs but is not endorsed, certified, or
  otherwise approved by TMDB."* The quiz has a notice only in
  `public/packs/ATTRIBUTION.md`, which nothing links to, in older wording.
- **Nothing from TMDB may be cached for more than six months.** The first stills
  were committed 9 September (`a07eb85`), so they reach six months on
  **9 March 2027**. That hashed copies count as a cache is a reading, not legal
  advice; the terms define TMDB content to include images.

### The work, in order

| # | Work | Size | Waits on | Done means |
|---|---|---|---|---|
| W1 | TMDB logo and notice on each On the box question and in the lobby; `ATTRIBUTION.md` reworded | under 1 session | "go live" only | Both on the live site; seal test green |
| W2 | CI publishes both rulesets on `master`, after e2e passes | 1 session, plus Greg's console step | D5 | A rules-only merge appears in the console's history; a broken rules file stops the deploy before it publishes; `check-rules` both ways after |
| W3 | Host authority (seam 1) | 3–5 sessions | D1, D2 | One allow case per rule function touched; `check-rules` both ways; `sync-harness 30`, `rank-harness`, `host-room`; an office round |
| W4 | Tenancy (seam 2); licensed packs flagged office-only | 2–3 sessions | D1, D3 | The office board reads back identical after the `season-2` migration; a second league sees none of it |
| W5 | Re-fetch every TMDB still | under 1 session | D4 | Done by 1 March 2027, and on a cycle under six months |

About 7–11 sessions. The additive table above is unchanged and stays on its triggers.

**W2 before W3.** Host authority is the largest rules change this repo will make,
and a hand paste is its most repeated failure (`CLAUDE.md`, What bites 2; the
postmortem). After W2, rules and the client they match ship in one deploy.

- e2e already runs the repo's own `firestore.rules` and `database.rules.json` in
  the emulator (`package.json` `e2e`), so CI would publish what it just exercised.
- `check-rules` stays a local step after publishing. CI never holds the debug
  token, by design (`ci.yml` header).
- Merging to `master` already publishes the site; after W2 it publishes rules
  too. The same "go live" words cover both.
- Unverified: how `firebase-tools` signs in on a runner under each D5 option.
  Read Google's docs before the console step, not memory.

**W3, expand then contract.** A rule that requires `hostUid` refuses every tab
still running the old client. Publish rules that accept both, then tighten after
the client is live: one extra deploy, not an extra session. Host-only answers
would also make a 30-player round's reads roughly linear in N rather than Q·N²
(estimate, not measured: [`cost.md`](cost.md)).

**W4's product cost.** The packs the office plays most (On the box, Sleeves,
Tunes) are the licensed ones. A public league under D3 (a) has none of them.

### Greg's decisions

| | Decision | Options | Recommended | Unblocks | By |
|---|---|---|---|---|---|
| D1 | Do B, and how much | (a) seams now, the rest on a trigger · (b) all of B now, 6–10 weeks · (c) stay office-only; this file is the record | (a): W3 pays off in the office too | W3, W4 | before W3 |
| D2 | When the host drops out | (a) the room pauses; `host-room` rescues it (the 2 Oct proposal) · (b) the host beats a heartbeat doc nobody listens to; once it is stale, any member may claim host, checked in rules with `get()`. Keeps the automatic handover for about one write per beat | (b), if W3's story proves it. One mode for office and public either way | W3 | before W3 |
| D3 | Licensed rounds for strangers | (a) office-only, a flag on the pack · (b) ask TMDB for an agreement; Apple's terms fail regardless | (a), plus the content rule: new media rounds use licence-clean sources | W4 | before W4 |
| D4 | TMDB's six-month cap | (a) re-fetch before 9 March 2027, then on a cycle · (b) read hashed copies as outside "cache" and carry the risk | (a) | W5 | 1 Mar 2027 |
| D5 | How CI may publish rules | (a) keyless (Workload Identity Federation), scoped to this repo's `master`; Google's auth action joins a deploy path that is GitHub-only today · (b) a service-account key in a GitHub secret, rules role only; no new action, but a long-lived key that opens the vault if it leaks | (a) | W2 | before W2 |
