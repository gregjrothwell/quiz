# Security

> **Owner: Greg Rothwell. Last updated: 20 August 2026. Budget: 250 lines.**

Moved verbatim out of `docs/HANDOVER.md` on 20 August 2026, when that file reached
2,422 lines. The text is unchanged; only where it lives is.

## App Check on the Realtime Database — enforced, 20 August 2026

**Done, and proved in three directions on the day.** `npm run appcheck-probe`
signs in with no App Check token at all and reports what each product does:

| Product | Before | After |
|---|---|---|
| Authentication | not enforced | **still not enforced** — signs in fine |
| Cloud Firestore | enforced | enforced |
| Realtime Database | **not enforced** — write *and* read succeeded | **enforced** — both refused |

Then the two that catch it breaking real play:

- `npm run check-rules` — **36/36**, every Realtime Database check included.
- `npm run sync-harness 10` — **10/10 joined, 0 dropped**, all ten saw the
  question within 109 ms.

The before column is what makes the after column mean anything. Without it, "the
site still works" is all anyone could have said.

**How a refused Realtime Database call presents, because it is not obvious.** It
does not reject. The SDK treats a refusal as a dropped connection and retries, so
the request simply never settles — the probe reports it via an 8-second timeout,
not an error. Anything that waits on an RTDB call without a timeout will hang
rather than fail, which is why `appcheck-probe` races every call, cleanup
included.

### The client side needs no change

Verified against [the App Check reCAPTCHA
docs](https://firebase.google.com/docs/app-check/web/recaptcha-provider), not
from memory: App Check covers the Realtime Database on web, and once
`initializeAppCheck` has run the client "will begin sending App Check tokens
along with every request it makes to Firebase" — no per-product code. The
requirement is ordering: initialise **before you access any Firebase services**.

`src/firebase.ts` already does. `initializeAppCheck` runs inside `connect()`
ahead of the `getFirestore` / `getAuth` / `getDatabase` calls that build the
services object, and `scripts/appCheck.ts` attaches the debug token to the same
`FirebaseApp` that every live script takes its `getDatabase` from. **There is
nothing to write.**

### The console step, which is Greg's

From [Enable App Check
enforcement](https://firebase.google.com/docs/app-check/enable-enforcement):

1. Firebase console → **Security** → **App Check**
2. **Expand the metrics view for Realtime Database**
3. **Enforce**, and confirm

Two things the documentation states plainly: **it can take up to 15 minutes to
take effect**, and once on, *"all unverified requests to that product will be
rejected"*. Enforcement is per-product, so this does not touch Firestore.

**What the documentation does not say**, and so neither will this file: whether
the product must accumulate metrics before its row appears. A previous session
asserted it did, lost a day to it, and was wrong — the row was on screen the
whole time, below the fold. If the row is not visible, scroll before theorising.

### After the switch, prove it in both directions

```bash
npm run appcheck-probe    # Realtime Database must flip to ENFORCED
npm run check-rules       # must still pass 36/36 with the debug token
npm run sync-harness 10   # ten real clients must still join and stay in sync
```

The first is the proof; the second and third are what catch it breaking real
play. A run of only the last two would show that nothing broke, which is not the
same as showing that anything is enforced.

**Still not enforced afterwards, and worth saying out loud:** authentication.
Anonymous accounts can still be minted by anybody; what they can no longer do is
read or write. That was always the exposure, but it is not the same as being
closed.

## The security review

Done. The brief was to go over the app the way a lead developer would before it
gets played at work, and fix what a review would fairly call a problem.

**Both rulesets are published and verified.** `npm run check-rules` reports 13 of
13, including the six denials that are new. Re-run it after any rules change —
the repo copy is still only a copy, and the console is still the source of truth.

Verified after publishing, against the live project:

- **The game still works.** `npm run sync-harness 10` — ten clients, all ten
  joined, all ten saw the round start within 63 ms, none dropped. This was the
  real risk of the change: `wellFormed` now gates every single write, so a wrong
  bound would have broken joining rather than anything security-shaped.
- **The attack is dead.** The same script that joined a stranger's room and
  blanked it in one write, given nothing but the code, now gets
  `PERMISSION_DENIED`. Reading the room is still allowed and always will be —
  joining reads the document first.

The rules were never syntax-checked locally; that needs the emulator, which needs
a Java runtime this machine does not have. The console validated them on paste
and `check-rules` confirmed the semantics, which between them cover it.

### Verified clean, independently

- `npm audit` — 0 vulnerabilities, production and dev. **This drifted and was
  put back on 15 August 2026**: two high-severity advisories had appeared in
  dev-only transitives (`nanoid` under `vite`, `brace-expansion` under `eslint`),
  cleared by `npm audit fix`. The production tree was never affected. Re-run it
  before a review rather than reading this line — that is the whole lesson.
- No `.env` has ever been committed; only `.env.example` is in the history, and
  no `AIza`-shaped literal appears in any commit.
- No `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function` or
  `document.write` anywhere in `src/` or `scripts/`. Every player-supplied string
  — names, and nothing else — goes through React's escaping.
- No `any`, no `@ts-ignore`, no `@ts-expect-error`.
- The Firebase Web API key in the bundle is public by design and the scanner
  flag is a false positive. **But do not count referrer restrictions as a
  mitigation**: they apply to the Identity Toolkit endpoints, not to Firestore or
  the Realtime Database, which are governed only by the rules below. The key
  being public is fine; believing it is restricted is not.

### Fixed

| Fix | Why it mattered |
|---|---|
| **`list` dropped from `/rooms`** | Was the whole ballgame. Any anonymous visitor could pull every live room in one query — players, scores, questions, every `correctIndex` — and then write to all of them. Nothing in the app ever queries the collection, so this cost nothing. |
| **Room writes are shape-checked** (`wellFormed`) | `code` is pinned, `phase` must be one of the five real phases, `players`/`scores` cap at 60, `questions` at 50, and the writer's own player entry must be `{name, joinedAt}` with a 1–40 character name. Previously a member could write any shape at any size into a document every client re-reads on every transition. |
| **`create` requires exactly one player** | `keys().hasOnly([uid])` is satisfied by the *empty* map, so a room could be minted with no members and therefore no derivable quizmaster. |
| **Unknown phase renders an escape hatch** (`App.tsx`) | The phase match was exhaustive with no fallback, so `phase: 'anything-else'` rendered a blank stage with no way out for the whole room. Demonstrated live before the fix, against the rules as published: a fresh anonymous client, given only the code, joined and blanked the room in a single write. Now both ends are covered — the rules reject the phase, and a client that meets one anyway offers Reload and Leave. |
| **Season rows are bounded** | `wins <= played`, `best <= points`, and absolute caps. Still self-reported — the rules cannot know your real score — but one edited row can no longer put a number on the board that makes the table meaningless. |
| **Season rows are deletable by their owner** | Was `if false`. There was no way for anyone to take their own display name back off a shared board, and the name is free text on a leaderboard the whole office sees. Somebody *else's* row still needs the console; the app has no moderator, which is worth knowing before the board is projected in a meeting. |
| **Presence entries cannot carry extra children** (`$other: false`) | `.validate` required `name` and `at` but did not forbid anything else, so a presence node could hold an arbitrary payload. |
| **`check-rules` tests denials, not just permissions** | The rules are pasted by hand, and a paste can fail in two directions. The permissive direction was completely silent: the game works perfectly with `list` wide open. Thirteen checks now, each tightening above paired with one that fails loudly if the console is still serving the old ruleset. It also exercises the season write path end to end — the thing the last handover called the least-proven code in the repo. |
| **`rtdb-probe.tmp.ts` deleted** | A leftover debug script committed to the repo root of a public repo. Its negative checks are better off inside `check-rules`, which is where they now are. |

### Accepted, deliberately

- **The room code is the capability.** Anyone holding a code can read the room and
  join it. This is not fixable: joining reads the document first, so `get` cannot
  require membership. 707,281 codes is a sane guess-space now that they cannot be
  harvested in one query — that was the entire value of dropping `list`.
- **`elapsedMs` is measured on the answering device**, and still is. Correct
  answers no longer ship anywhere — that half was fixed by the vault, without a
  Cloud Function and without leaving the free tier, which the review had
  assumed impossible. Bounding `elapsedMs` against the question's open time in
  the rules was considered again and rejected for the same reason as before: it
  costs a document read per answer and would silently reject honest answers
  from anyone on a slow connection, which is worse than the cheat.
- **Any member can still rewrite the phase, scores, questions and other players.**
  It follows directly from the quizmaster being derived rather than stored, and
  the reasoning for that is in the table near the top. `wellFormed` now keeps the
  worst case to mischief rather than an unplayable or expensive room.
- **Answers are readable before the reveal.** Restricting the subcollection to
  room members was considered and rejected: it costs a document read per rule
  evaluation — per snapshot on a listener, so roughly 1,500 extra reads a game —
  and buys nothing, because reaching the path needs the code and anyone with the
  code can just join. Members seeing each other's picks mid-question is inherent
  without server-side logic.
- **The season table is readable by any signed-in visitor**, which anonymous auth
  makes effectively public. It is display names and scores; a shared leaderboard
  has to be shared. Worth saying out loud because those are colleagues' names on
  a public URL.

### Not done, and what it would take

1. ~~**No App Check, no rate limiting.**~~ **App Check is enforcing on Cloud
   Firestore as of 16 August 2026**, verified by a negative test: the same
   script that passes 36/36 with its debug token is refused outright without
   one. Anonymous accounts can still be minted, but they can no longer *read*
   anything without attesting, which was the exposure — the free tier is 50k
   reads a day and a game is ~800, so a script pointed at one room code could
   take the quiz down for the office for a day.

   Still open around it:
   - **The Realtime Database is not enforced**, only Firestore. It holds
     presence only, so the blast radius is ghosts in a lobby rather than the
     read budget, but it is not covered.
   - **Authentication is not enforced.** The negative test still signed in.
   - **No rate limiting**, and no budget: **on Spark there is no bill to run up
     and no budget to set** — budgets live in Cloud Billing, which a free
     project has no account for. The substitute is the console's usage alerts.
     **If this project is ever moved to Blaze, set a budget that day** — the
     same exhaustion stops being an outage and starts being an invoice.
2. ~~**Rooms are never deleted**~~ **Solved, 15 August 2026 — but not the way
   it was planned.** Rooms carry `expiresAt` and `npm run prune-rooms` removes
   the expired ones along with their subcollections. The intended fix was a
   Firestore TTL policy; **TTL requires billing enabled and this is a Spark
   project**, which is not stated on either documentation page and is discovered
   at the Create Policy button. The item is closed once somebody actually runs
   the script with `--go`; 79 rooms are still there. See [the two slow
   leaks](cost.md#the-two-slow-leaks).
3. **No Content-Security-Policy.** GitHub Pages cannot set headers, but a `<meta
   http-equiv>` CSP in `index.html` would still be worth having — `default-src
   'self'` with `connect-src` for the Firebase hosts. Left alone deliberately:
   getting it wrong breaks the live app silently, and the deploy has a stale-CDN
   window that makes that painful to diagnose. Do it as its own change with a
   round of testing, not tacked onto a rules fix.
4. **Anonymous accounts accumulate forever** in Firebase Auth. There is a console
   setting to auto-purge unused anonymous accounts after 30 days; it is off.
   Turning it on would also quietly reset anybody's season row, which is the
   trade-off — see the iOS Safari note under Known limits.

`npm run check-rules` must pass after any rules change. It covers the paths the
app needs *and* the denials the review added, so extend both halves if the rules
gain new paths.

---
