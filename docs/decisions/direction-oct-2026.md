# Direction review — 22 October 2026

> **Owner: Greg Rothwell. Last updated: 22 October 2026. Budget: 250 lines.**

**Status: reviewed with Greg 22 October 2026. "All of the ideas look good."** Items 1–2 and the lead-time work are live; progress is under *Sequence*.
Sequence below; nothing in §3–§5 is built yet. Greg's request was a step back:
direction, more from the office as beta testers, a security sweep, architecture,
unused Firebase, and something with real wow.

Sources: three read-only sweeps of the code and the docs, `npm audit`, the
lockfile, `ci.yml`, all three rulesets, and web checks on 22 October 2026 (links
at the foot of this file). File and line references are as of `f2b6482`.

## Trajectory

August built the fair game: vault, App Check, identity, season. September added
mechanics and media. October added TV formats and showmanship. The destination is
target B, "strangers in the room, or monetised" ([`public-scale.md`](public-scale.md)):
seams now, leagues next (W4), no rewrite if it takes off.

**The next phase makes the show about the people in the room.** That is the one
kind of content nobody licenses, so it is the one that can go public. D3 keeps
licensed rounds office-only.

## 1. Security sweep

CONFIRMED means the code path was read; SUSPECTED means it was not proved.

| # | Finding | Status | Fix |
|---|---|---|---|
| S1 | **CI runs every install script while holding the keys.** The `rules` job has `id-token: write`, then `npm ci` runs every postinstall, then auth and `firebase deploy`. The `deploy` job's checkout keeps a write-scoped token in `.git/config` before `npm ci`. This is the shape of the 2026 Mini Shai-Hulud waves (TanStack 11 May, AntV 19 May, Red Hat 1 Jun), which steal CI credentials. The lockfile has none of those families, checked 22 Oct. | CONFIRMED path | `npm ci --ignore-scripts` in both jobs. `persist-credentials: false`. SHA-pin `actions/*` (2026 tag hijacks: actions-cool, codfish). Dependabot for security updates only. |
| S2 | **Anyone with a room code can stall a live round.** `selfWrite` checks the key of `packVotes` and `voteTaps` but never the value (`firestore.rules:379-388`). A ~900 kB string, then a leave, bloats the room doc toward 1 MiB. | CONFIRMED gap | Type and size checks, an allow case on `writeOwnVote`, then `check-rules` both ways. |
| S3 | **Live room codes can be harvested.** RTDB `presence/$code` is readable by anyone signed in, for any code, and RTDB bills bytes, so walking all 707k codes is free. | CONFIRMED | Accepted for the office. Close before W4 (6-character codes). |
| S4 | Unlimited RTDB nodes per uid; the 100-connection cap could be used up. | SUSPECTED | Note for W4. |
| S5 | `games/` can be forged with other uids; `q1Traces` is unbounded. | CONFIRMED | Make the evidence scripts flag records not written by the host. |
| S6 | Recovery codes use `Math.random` (`recoveryCode.ts:17`, `identity.ts:94`). Revoking a code does not evict someone who already claimed it. | CONFIRMED | `crypto.getRandomValues`; correct `identity.md`. |
| S7 | `npm audit`: 4 high in production, all `@grpc/grpc-js` via firebase. The advisory is server-side TLS, and the browser uses WebChannel. Dev only: vite 8.2.2 dev-server advisories (bound to localhost), vitest, firebase-tools' express. | SUSPECTED unreachable | Bump vite, vitest, firebase-tools. firebase 11→13 is its own PR. |
| S8 | Node's 21 Oct security release. Local is 24.13.0; CI tracks `.nvmrc` "24". | — | Update local Node. |

**Clean:** no XSS sinks, no secrets in the tree, sealed packs, an unreadable
vault, `list` denied on rooms and recovery, no `pull_request_target`, and the
Google pool bound to `master`.

**Does not apply:** the Next.js/RSC RCE of 14 Oct (no RSC here). The
"misconfigured Firebase" breach class is what `check-rules` (129/129, both
directions) exists for.

**Fixes for S1, S2, S6 and S7 ship alone, as an urgent PR.** They were offered as
their own session on 22 October.

## 2. Architecture

**Strong:** a pure engine with ~1,500 test sites; rules tested live in both
directions and published by CI with keyless auth; host authority; the sealed
vault; doc discipline.

**Weak, by cost:**

1. **The de facto server is two untested React files.** The host's duties
   (dispatch, auto-reveal, beat, reaper, claim, season recording) live in
   `useRoom.ts` (1,177 lines, no test file) and `App.tsx` (1,176 lines).
   - Extract a non-React `hostLoop`, tested against the emulator.
   - This is also the W4 blocker.
2. **Failures are invisible until someone complains.** There is no error
   reporting. Cass's Q1 took weeks. Reads are estimated, never counted.
3. **Open audit items:**
   - #1, the steal robs a player who left (`reducer.ts:367`).
   - #2, anyone can delete `asked`.
   - #7, prune skips `lamps` and `q1Traces`.
   - #8, the answer listeners have no error callback.
4. **Cost:** Q·N² until W3's contract half (after 14 Nov); Q·N after is
   unmeasured. RTDB's 100 connections is the first hard wall.
5. **Drift:** four docs contradict the code. They are `vault.md:131` (says the
   vault stops at the first hit), the first bullet of `known-limits.md`,
   `host-authority.md` on season rows, and the comment at `App.tsx:771`.
6. **Age:** firebase 11.10 (latest 13.1), motion 11 (14), React 18 (19). Not
   urgent. Firebase goes first, alone.

## 3. Beta testing — more from the office

The office is already the beta. There are no flags and no structured feedback;
`read-games` reads rounds back afterwards. The gap is more experiments per round,
with a verdict from each.

1. **The Lab.** Features ship dark in a normal release. The quizmaster turns
   them on per room, the same pattern as the wager, steals and jigsaw. The
   `games/` record keeps which Lab items were on.
2. **A kill switch with no deploy.** `config/lab`, one Firestore read per load.
   Remote Config was considered: free, real-time, but a new SDK whose targeting
   needs Analytics, and percentage rollouts mean nothing at 11 players.
3. **A one-tap Keep / Bin verdict** on Final for each Lab item, shaped like
   question votes, plus a `read-lab` script.
4. **A round-health beacon.** Generalise `q1Trace` to every question: about N
   writes a round.
5. **An error beacon**, `clientErrors/`, size-bounded in the rules.
6. **The Lab Friday run sheet:** quizmaster handover at Q5, two squads on one
   board, the review panel, and the 30-player round. None has been tried with
   people.
7. *Not taken:* a same-origin `/quiz/beta/` build. It needs a standing rule from
   Greg that beta deploys don't need the words.

## 4. Firebase left on the table

| Capability | Verdict |
|---|---|
| RTDB as a cue bus | **Use.** It carries "the rig in your hand". |
| Firebase AI Logic | **Use, behind Lab.** The Gemini Developer API free tier works on Spark. Live API and media models on Spark are unconfirmed, and free-tier prompts may be used by Google, so send placeholders, never names. |
| Firebase Hosting | **Later.** Real headers (CSP Report-Only, `frame-ancestors`, HSTS). But a new origin loses every anonymous identity, and 0 recovery codes are saved. |
| Remote Config | Covered by `config/lab`. |
| Analytics / Performance | Skip. Consent under PECR plus SDK weight, and the beacons do the job. |
| FCM | Skip. Sending needs a server credential; Spark has no Functions. |
| TTL, Functions, Storage, App Hosting | Blaze only ("403 billing disabled", [`cost.md`](cost.md)). |

## 5. Wow — all five accepted

None repeats a turned-down idea; [`ideas-review.md`](ideas-review.md) and
[`parked-ideas.md`](parked-ideas.md) were checked.

1. **Survey Says — "We asked the office…".** Family Fortunes from a lobby
   survey: taps only, then guess the room's top answers.
   - It generalises the parked Blankety Blank "match the room".
   - Needs no licence, so it is the first round type that can go public.
2. **Beat the Chaser.** Mr Fries plays the room, right exactly as often as this
   office is on each question. Co-op, everyone against the house. Needs
   per-question stats.
3. **The Commentator.** Spoken callbacks to the room's own history ("first time
   anyone's got this one"). A pure facts engine, with optional Gemini rewording.
4. **The rig in your hand.** Phones as stage lights, cued over RTDB on the shared
   clock.
   - Slow washes only, which respects the flash rule.
   - Measure device spread first: lights tolerate ±50 ms, audio unison does not
     (the phasing in [`known-limits.md`](known-limits.md)).
5. **Quiz Wrapped.** A personal season recap and a Christmas finale, on the
   final-card pipeline. Due by about 5 December.

## Sequence — progress at 22 October 2026, 09:10 BST

Each item gets its own branch. A release branch is used only when two or more
features go live together (AGENTS.md, from 22 Oct). Going live always needs
Greg's words.

**Done, live 22 Oct:**
1. ✅ Landing links beside Join and the sound-check stop: #110, plus its What's
   new lines in #114.
2. ✅ The security PR, #111: S1, S2, S6, S7. S3–S5 are recorded as known in
   [`security-sweep-oct-2026.md`](security-sweep-oct-2026.md).
- ✅ *Added on the day:* go-live lead time, #113. A Plan job skips docs-only
  changes, master reuses the PR's tested build, and a What's new gate blocks
  player-facing PRs without their line. Master now runs in ~1½ min
  ([`lead-time.md`](lead-time.md)).

**Still to do:**
3. ⬜ The Lab: switches, kill switch, verdict, beacons, `read-lab`, run sheet.
4. ⬜ Wow, one at a time behind Lab, each with a story and ACs first:
   1. Survey Says.
   2. The rig probe.
   3. The per-question stats fold (it also fixes the Ladder).
   4. Beat the Chaser, then The Commentator.
   5. The rig, if the probe holds.
   6. Quiz Wrapped, due ~5 Dec.
5. ⬜ Architecture:
   - Extract `hostLoop`.
   - firebase 13, alone.
   - W3's contract half after 14 Nov.
   - Audit items #1, #2, #7 and #8 (§2).
6. ⬜ Fix the four drifted docs (§2).

**Waiting on Greg, or deferred:**
- A ruleset on `master` requiring **Verify and build** and **Playwright against
  emulators**. Auto-merge is on but unused until the rule exists.
- The CI live check plus the `github-pages` environment. Deferred, "we will do
  it soon"; the pick-up brief is in the 22 Oct log.
- Dependabot #115–#118, dev-tool bumps. Each merge deploys, so each needs the
  words.
- S8: update local Node from 24.13.0 to the latest 24.x.
- The `/quiz/beta/` build. It needs a standing rule from Greg.

## Sources, checked 22 October 2026

- Node.js October 2026 security releases — https://nodejs.org/en/blog/vulnerability/october-2026-security-releases
- Next.js security update, 14 Oct 2026 — https://nextjs.org/blog/nextjs-security-update-october-14-2026
- Mini Shai-Hulud, AntV wave — https://www.microsoft.com/en-us/security/blog/2026/05/20/mini-shai-hulud-compromised-antv-npm-packages-enable-ci-cd-credential-theft/
- Mini Shai-Hulud, TanStack wave — https://www.wiz.io/blog/mini-shai-hulud-strikes-again-tanstack-more-npm-packages-compromised
- Compromised GitHub Actions re-enabled — https://thehackernews.com/2026/09/compromised-github-actions-came-back.html
- Codeway Firebase exposure, Jan 2026 — https://elephas.app/resources/codeway-chat-ask-ai-firebase-exposure
- Firebase AI Logic pricing (Spark free tier) — https://firebase.google.com/docs/ai-logic/pricing
- Firebase pricing (Remote Config, Hosting, Blaze-only products) — https://firebase.google.com/pricing
