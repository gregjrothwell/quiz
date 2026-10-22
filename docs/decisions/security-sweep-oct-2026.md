# Security sweep — 22 October 2026

> **Owner: Greg Rothwell. Last updated: 22 October 2026. Budget: 250 lines.**

Prompted by the 2026 Mini Shai-Hulud npm worm waves (TanStack 11 May, AntV 19
May, Red Hat 1 June), which run from install scripts and harvest CI
credentials. Seven findings: four fixed in one PR, shipped alone as an urgent
fix (AGENTS.md); three recorded as known, below.

**Clean on the day, and not re-checked here:** the lockfile against those worm
families, no XSS sinks, no secrets in the tree, sealed packs, an unreadable
vault. Those came from the sweep itself, before this PR.

## Fixed in this PR

| | Finding | Fix |
|---|---|---|
| S1 | `rules` (Google OIDC) and `deploy` (write-scoped `GITHUB_TOKEN`) ran `npm ci` with install scripts, and checkout left the token in `.git/config` | `npm ci --ignore-scripts` in both; `persist-credentials: false` on the deploy checkout; every action SHA-pinned; `.github/dependabot.yml`, security PRs only |
| S2 | `packVotes` / `voteTaps` values unchecked: a member could park ~900 kB under their own key and leave | `ownVoteOk()` in `wellFormed`: vote absent or a string ≤ 64, taps absent or an int ≤ 1000 |
| S6 | Recovery codes drawn with `Math.random` | `crypto.getRandomValues`; and `identity.md`'s revocation claim corrected |
| S7 | Dev advisories in vite, vitest, firebase-tools | Bumped within their majors; `firebase` itself not touched |

### S1 — what was proved, and what was not

From a clean `npm ci --ignore-scripts` in a scratch copy, on 15.30.0 and again
on 15.34.1 after S7 (**verified**, 22 Oct):

- `firebase --version`, `tsx`, `gh-pages` all run. `re2`, the one native module
  under firebase-tools, is not built; superstatic `require`s it inside a
  `try`, for hosting's regex rewrites, which this project does not deploy.
- `npm run check-bundle` against a fresh `dist/`: exit 0.
- gh-pages published `dist/` to a local bare repo through `--repo` alone, from
  a directory that was not a git checkout. So the persisted token was never
  what it pushed with.
- `firebase deploy --only firestore:rules,database --dry-run` with the admin
  key in `GOOGLE_APPLICATION_CREDENTIALS`: the RTDB file "is valid" against
  the live database; Firestore stopped at the key's `serviceusage` 403, as on
  15 October ([`rules-from-ci.md`](rules-from-ci.md)).
- `firebase emulators:exec --only firestore,database`: both up, both rulesets
  loaded.

**Not proved before the merge:** the Firestore half of the real publish under
`--ignore-scripts`. The CI account holds the role the admin key lacks, and
only `master` can mint it. The first CI run after the merge is that proof —
read the `rules` job, not just the badge.

**Dependabot opens nothing yet.** Alerts and security updates are both off
(`gh api` vulnerability-alerts: 404; automated-security-fixes: enabled false,
22 Oct). Settings → Advanced Security, two switches. **Owner: Greg.**

The pins are what each floating major resolved to on the day (`git ls-remote
--tags`; each confirmed a commit declaring `node24`), so nothing that runs
changed. How Dependabot rewrites a pin and its comment is not in GitHub's
docs: read its first PR.

### S2 — both directions, and a welded rule between

`e2e/host-authority-rules.spec.ts -g 'S2|canary'`, emulator, repo rules:

| | unfixed | welded\* | fixed |
|---|---|---|---|
| allow: a member and the host vote, take back, move; the host drives on | PASS | **FAIL** | PASS |
| deny: 65-char vote, 900 kB vote, string taps, 1.5 taps, 1001 taps, host's 65-char vote | FAIL ×6 | PASS ×6 | PASS ×6 |

\* `ownVoteOk` written to refuse any vote of the writer's own. The six denies
passed against it, which is why they are not the proof; the allow column is
([postmortem](postmortem-the-pin-that-refused-the-reveal.md)).

**A refusal for the wrong reason, caught.** The first unfixed run refused the
string tap count anyway: the document already held the 900 kB vote, and the
rules engine hit its memory ceiling ("maximum memory usage of 1000"). The
cases were isolated so each meets only the rule, and re-run both ways.

Full `npm run e2e` on the fixed rules: 20/20, `lobby-vote.spec.ts` (the
client's own UI path) included. `check-rules` gains four live twins, 129 →
133; they use 65 characters, never 900 kB, so a run before the publish cannot
leave that on a live room.

**Not covered:** somebody else's key. Rules cannot walk a map. In a hosted
room only the host may write a member's key; in a room from before W3 any
member could, which was already accepted ([`security.md`](security.md)).

### S6

Both tests seen failing first (0 calls to `getRandomValues`; `FJHVX5PH` where
`AAAAAAAA` was expected). Mapping 2³² words onto 29 symbols leaves a bias
below one part in 10⁸. The correction: deleting a recovery code stops new
claims and evicts nobody — [`identity.md`](identity.md#what-it-does-not-do).

### S7 — `npm audit`, before and after (**verified**, 22 Oct)

| | all | production |
|---|---|---|
| before | 34 — 1 critical, 20 high, 13 moderate | 4 high |
| after | 24 — 1 critical, 14 high, 9 moderate | 4 high |

Cleared: `@vitest/mocker`, `basic-ftp`, `csv-parse`, `get-uri`,
`pac-proxy-agent`, `proxy-agent`, `source-map-js`, `stream-json`, `vite`,
`vitest`. **Left:**

- **Production, 4 high:** `firebase` → `@firebase/firestore` →
  `@grpc/grpc-js` (GHSA-m9gg-hp2v-232j, GHSA-f596-whhp-79r4). Needs the
  `firebase` upgrade: its own PR.
- **Dev, 20:** 11 that npm marks fixable in range with `npm audit fix` (no
  `--force`), `proxy-addr` (the critical, under the emulator's express) among
  them; the rest only by the `--force` downgrades npm proposes (firebase-tools
  14, gh-pages 6.1.1), which are not fixes. Not done: out of S7's scope.
- `security.md` still says "0 vulnerabilities" under *Verified clean*, dated 15
  August. It has not been true since at least today.

No package with an install script was added or removed by the bump.

## Known, not fixed — recorded 22 October 2026

**S3 — the room-code oracle.** `database.rules.json` grants `.read` on
`presence/$code` to anyone signed in, with `$code` unconstrained. Since 21
September the entries carry no names, but a non-empty read still says a code
is live, so 707,281 codes can be walked for live rooms — and a live code is
the capability to join ([`security.md`](security.md#accepted-deliberately)).
App Check must be passed for each read. Closing it means presence readable only
by members, which RTDB rules cannot ask of Firestore.

**S4 — the RTDB is unbounded, and Spark caps it at 100 connections.** Anyone
signed in can write `presence/{anyCode}/{ownUid}` and
`lamps/{anyCode}/{anyQuestion}/{ownUid}`: one node per code per account, no
ceiling on codes. Separately, "The Spark plan limit on simultaneous
connections is 100" ([Firebase limits](https://firebase.google.com/docs/database/usage/limits),
read 22 Oct); the docs do not say what a client sees past it. Thirty
players use thirty; 100 held open by a script would keep the office out.

**S5 — `games/` is forgeable and `q1Traces` is unbounded.** A `games/`
create is checked for shape and for the writer being in `players`, not
against any room, so anyone signed in can file a round that never happened,
with any scores, under any id, as often as they like. `read-games`,
`freshness`, `backfill-finals` and `player-audit` all read it, so a forgery
reaches question freshness and the finals tallies. `q1Traces/{gameId}_{uid}`
takes any `gameId` up to 64 characters, so one account can file one trace per
made-up game, without limit. Both are small per document; it is the count.

All three need a server-side writer or a membership check the rules cannot
make cheaply. Ranked in [`audit-backlog.md`](audit-backlog.md).

## After the merge (Greg's, and only once he has said "go live")

1. Read the CI run's `rules` and `deploy` jobs: they are the first real
   `--ignore-scripts` publish.
2. `npm run check-rules`: 133, both directions.
3. `npm run rank-harness`: a real round through the new `wellFormed`.
4. A real lobby vote on the live site: cast, move, see it counted.
5. Switch on Dependabot alerts and security updates.
