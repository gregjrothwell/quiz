# Public scale — strangers in the room, and money

> **Owner: Greg Rothwell. Last updated: 2 October 2026. Budget: 250 lines.**

**Status: PLAN, not confirmed.** Nothing here is built. The open decisions at the
bottom are Greg's.

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
  - the sources of Flags and Fine Art;
  - whether round names borrowed from TV formats ("Name that Tune",
    "Catchphrase") matter commercially;
  - TMDB's attribution requirement for non-commercial use.

## Open decisions — all Greg's

1. **Is B "seams now, the rest on a trigger"?** Or build all of B now?
2. **Host authority: give up the automatic quizmaster handover?** For the office
   as well, or public rooms only? Two modes means two sets of rules; the
   recommendation is one.
3. **The iTunes and TMDB rounds: office-only, or ask TMDB for an agreement?**
4. **Order.** Recommended: host authority first. It is the riskier seam, and it
   deletes the RTDB item.
