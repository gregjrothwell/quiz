# PROJ-119 — Claude review handover (PR #200 + PR #201)

**Status:** branches and PRs only. Neither is merged. Merging either to `master` runs the deploy (rules publish then gh-pages). Do not merge or deploy without Greg's explicit yes.

**Repo:** [gregjrothwell/quiz](https://github.com/gregjrothwell/quiz)  
**Ticket:** [PROJ-119](https://gmancodwarrior.atlassian.net/browse/PROJ-119) (In Progress; follow-ups stay open)  
**Reviewer:** Claude Code on Greg's Macs  
**Author of this handover:** Forge (executor), 9 Nov 2026 Europe/London

---

## Goal and context

PROJ-119 asked for a review of implicit state machines and unenforced invariants in Quiz. The first shipping slice (#199, already live) drops answers whose server `at` is before the current question's `openedAt`, so a seated player who sat a round out no longer scores their old pick when indices repeat.

Two unpublished follow-ups are ready for review before go-live:

| PR | Branch | What |
|---|---|---|
| [#200](https://github.com/gregjrothwell/quiz/pull/200) | `claude/rank-harness-at` | Harness stamps `at`; HANDOVER note; **vault reveal soft-handles emulator `aborted`** |
| [#201](https://github.com/gregjrothwell/quiz/pull/201) | `PROJ-119-answer-open-question` | **Rules:** answers may only name the open question (`questionIndex == room.index`) |

#200 is stacked on master after #199. #201 is **off master independently** (not stacked on #200). They touch different files; either can merge first. Merging both is the intended go-live set for this slice of follow-up 1 + the harness/docs/vault flake fix.

Ticket follow-up list (from the 7 Nov Claude review comment on PROJ-119): this handover covers **follow-up 1** (write-boundary bind) plus the CI flake that blocked #200. Follow-ups 2–7 (measure missing `at`, replayed-question stall, host succession, phase graph, unread areas, emulator port) are **out of scope** for these PRs.

---

## PR #200 — commits (`origin/master..claude/rank-harness-at`)

HEAD at review time: `abea2f0`.

| Hash | Subject | What and why |
|---|---|---|
| `1dd1f86` | rank-harness stamps `at` as the app does | `scripts/rank-harness.ts` writes `at: serverTimestamp()` with each answer. Without it the live check after #199 waved through unstamped answers and proved nothing about the stale-answer filter. |
| `3885339` | PROJ-119: record the stale-answer fix as live | `docs/HANDOVER.md` note for #199 / gh-pages `cdad107`. Ticket stays In Progress. |
| `3dedd51` | PROJ-119: retry vault reveals that the emulator locks out | **Superseded approach.** In-place loop of the four-way ask on `aborted`. Rejected because it burned `REVEAL_TIMEOUT_MS` (4s in `src/engine/revealGate.ts:129`) and turned lock timeouts into `TimeoutError`, which `e2e/double.spec.ts:169` and `e2e/node-round.spec.ts:150` do **not** filter (they only allow `reveal failed: .*Transaction lock timeout`). |
| `197ecf1` | PROJ-119: do not burn the reveal timeout on emulator locks | **Current vault behaviour.** Soft-handle `aborted`: fall through to `getDoc` on the reveal; if a write landed, return its option index; else rethrow `aborted` so the host backoff ladder (`MAX_REVEAL_RETRIES = 8` in `src/host/due.ts:35`) asks again. Keeps the failure shape the e2e filters already allow. |
| `6ac20f3` | PROJ-119: re-trigger CI after vault contention fix | Empty commit. No code change. |
| `abea2f0` | PROJ-119: bump HANDOVER header date to 9 November | Header date only in `docs/HANDOVER.md`. |

### Files to scrutinise on #200

**Primary — `src/lib/vault.ts`**

- `errorCode` / `isPermissionDenied` / `isEmulatorContention` — lines 43–59. Note: the block comment on `isEmulatorContention` (lines 52–56) still says contention "is retried here rather than bubbling out"; that wording matches the superseded `3dedd51` approach. The `resolveAnswer` doc comment (lines 85–89) and the body (91–136) are the source of truth for `197ecf1`.
- `resolveAnswer` — lines 91–136:
  - Four parallel `setDoc` via `Promise.any` (unchanged shape from #70 / Lite).
  - On `AggregateError`: hard errors (not permission-denied, not aborted) still throw immediately (lines 109–113).
  - Soft path: `getDoc` reveal read-back (124–129); if missing and contention was seen, `throw contention` (131); else the existing vault-refused `Error` (133–136).

**Tests — `src/lib/vault.test.ts`**

- Lines 120–135: contention + stored reveal recovers; contention + nothing stored rethrows `{ code: 'aborted' }`.
- Lines 103–108: `unavailable` still surfaces and does **not** call `getDoc`.
- Lines 110–118: hit beside a hard failure on another candidate still returns the hit (`Promise.any`).

**Filters that define "allowed flake" vs real failure**

- `e2e/double.spec.ts:169` — `!/^reveal failed: .*Transaction lock timeout/`
- `e2e/node-round.spec.ts:148–150` — same regex; comment says the retry ladder recovers emulator locks.
- `docs/decisions/host-loop.md:172–174` — documents emulator lock timeouts as expected, recovered by the ladder.

**Not behaviour changes (but on the branch)**

- `scripts/rank-harness.ts` (`1dd1f86`) — live harness only.
- `docs/HANDOVER.md` — live note + date.

### Risks / edge cases to challenge on #200

1. **Reveal read-back race.** Under contention, one of the four `setDoc`s may have committed while `Promise.any` rejected. The `getDoc` path assumes that if a reveal exists, its `answer` string is in `question.options` (`indexOf`). Challenge: wrong option string / empty doc / reveal for a different question id (path is keyed by `question.id`). Also: can a **wrong** option's write ever be accepted by rules? (Rules require `answer == vault.a`; only the correct string should create. Confirm against `firestore.rules` reveal `allow create`.)
2. **Can a genuine failure get swallowed?** Hard codes still throw before read-back. Soft path only treats `permission-denied` and `aborted`. Challenge: are there emulator or production codes that should be hard but look soft, or soft but are currently hard? Does rethrowing the raw `aborted` error preserve `message` containing `Transaction lock timeout` so the e2e filters still match when the host logs `reveal failed: …`?
3. **Interaction with `REVEAL_TIMEOUT_MS` (4s).** `197ecf1` avoids looping inside `resolveAnswer`. Challenge: is one `Promise.any` + one `getDoc` always inside 4s when the emulator is slow? If not, `TimeoutError` still fails the e2e unexpected-failure assert.
4. **Stale comment on `isEmulatorContention`.** Lines 52–56 disagree with the function body / `197ecf1` doc. Challenge whether to fix the comment in this PR or leave it.

---

## PR #201 — commits (`origin/master..PROJ-119-answer-open-question`)

HEAD at review time: `96966c9`.

| Hash | Subject | What and why |
|---|---|---|
| `bb77ace` | PROJ-119: answers may only name the open question | Rules + emulator test. Closes write-boundary gap called out in PROJ-119 follow-up 1: `questionIndex` was shape-checked but not bound to the open question. |
| `96966c9` | PROJ-119: re-trigger CI after abandoned checks | Empty commit. No code change. |

### Files to scrutinise on #201

**`firestore.rules` (answers match)**

- Comment at lines 602–606 (on the #201 branch): explains the bind and that `arrivalOk` already paid for the room `get()`.
- Allow create/update — critical new line:

```text
&& request.resource.data.questionIndex == answerRoom().data.index
```

  immediately after the existing `questionIndex is int` / bounds checks (branch lines 622–625). Full allow chain still ends with `arrivalOk()` (line 637).

**`e2e/host-authority-rules.spec.ts`**

- `answer()` helper — optional `questionIndex` defaulting to `0` (lines 139–148 on the branch).
- New test `PROJ-119: answers may only name the open question` (lines 475–501): allow on index 0; advance reveal → next → next to index 1; deny past (0) and future (2); allow current (1). Ages `openedAt` via Admin SDK so the vault gate opens without a sleep.

**Client write path (unchanged, but the bind assumes it)**

- `src/lib/useRoom.ts` — `submitAnswer` sets `questionIndex: room.index` (around lines 1146–1156 on master / #200 HEAD). Challenge: every answer writer (browser, node harnesses, e2e helpers, `check-rules`) sends an int matching the room's `index`.

### Risks / edge cases to challenge on #201

1. **Late answers after Next.** Once `index` advances, a write with the previous `questionIndex` is refused. The stale-answer **filter** (#199) already ignored those for scoring; the rule now refuses the write. Challenge: any honest path that still submits with a stale local `room.index` (stalled listener) — player sees a silent refusal. Is that acceptable? Is it visible?
2. **Early / future `questionIndex`.** Custom client prewriting `index+1` is the gap this closes. Challenge: host or admin tooling that seeds answers — any break?
3. **Type: int vs string / double.** Rule requires `questionIndex is int` and `== answerRoom().data.index`. Challenge: how is `index` stored on the room document (always int)? Could a client SDK send a double and fail `is int`? (Rules comments elsewhere warn that doubles break `duration.value`; this compare is `==` between ints.)
4. **Phase when answering.** Bind is to `index`, not `phase == 'question'`. During reveal/scoreboard, `index` still names the question just asked until `next` advances it. Challenge: intentional or hole?
5. **Host / W3.** Answers remain author-only writes (`request.auth.uid == uid`). Host does not write other players' answers. Challenge: confirm no host path writes `answers/{uid}` with a mismatched index.
6. **`check-rules` live probe.** Live project still has the **old** rules until #201 merges (CI publishes rules on master). Emulator tests use repo rules. Challenge: any `scripts/check-rules.ts` case that writes `questionIndex: 0` while LIVE_ROOM is not at index 0 after other probes?

---

## Interaction and merge order

- **Files:** #200 changes `src/lib/vault.ts`, `src/lib/vault.test.ts`, harness, HANDOVER. #201 changes `firestore.rules` and `e2e/host-authority-rules.spec.ts`. No file overlap.
- **Behaviour:** Independent. Vault contention handling does not depend on the answers index bind, and vice versa.
- **Merge order:** Either first. Both merge to `master` → CI publishes rules (from whatever `firestore.rules` is on master after the merge) then deploys the site. If only #200 merges, rules unchanged. If only #201 merges, vault stays as on master (no soft-aborted handling) but answers bind goes live.
- **Recommended for go-live:** merge both (Greg's call on order); one feature each can ship alone per AGENTS.md, but they are one PROJ-119 slice in practice.

---

## How to verify

### Unit (no emulators)

```bash
npm test -- --run src/lib/vault.test.ts
npm run typecheck && npm run lint
```

### Emulator rules / e2e (Java required; MBP has Homebrew OpenJDK 21)

Port 8080 is often held by llama-server locally. CI uses 8080. Locally, either free 8080 or temporarily point `firebase.json` + `src/lib/emulators.ts` at 8085 (do not commit that).

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21
export PATH="$JAVA_HOME/bin:$PATH"

# #201 branch — the new rules test + full host-authority-rules file
git checkout PROJ-119-answer-open-question
npx firebase emulators:exec --only auth,firestore,database --project quiz-d686e \
  "npx playwright test e2e/host-authority-rules.spec.ts -g 'PROJ-119: answers may only'"
npx firebase emulators:exec --only auth,firestore,database --project quiz-d686e \
  "npx playwright test e2e/host-authority-rules.spec.ts"

# #200 branch — shards that previously failed on lock timeout / TimeoutError
git checkout claude/rank-harness-at
npx firebase emulators:exec --only auth,firestore,database --project quiz-d686e \
  "npx playwright test e2e/double.spec.ts e2e/survey-says.spec.ts e2e/node-round.spec.ts"
```

Shard map (`e2e/shards.json`): shard 3 = `double` + `survey-says`; shard 4 = `test-run` + `node-round`.

### CI (green at handover time)

- #200: https://github.com/gregjrothwell/quiz/actions/runs/42676727019 (HEAD `abea2f0`)
- #201: https://github.com/gregjrothwell/quiz/actions/runs/42674332404 (HEAD `96966c9`)

### Known flake evidence

- Original red: [run 42392873752](https://github.com/gregjrothwell/quiz/actions/runs/42392873752) — shard 3 `double.spec.ts`, room stayed `question`, host log showed repeated `Transaction lock timeout` on reveal candidates.
- `gh run rerun --failed` of that run → shard 3 **green** (flake).
- After `3dedd51`, CI went red again with `reveal failed: The reveal did not finish within 4000ms` (TimeoutError), which the e2e unexpected filter does not allow — that is why `197ecf1` replaced the in-place retry loop.
- `docs/decisions/host-loop.md:172–174` already treats emulator lock timeouts as expected and recovered by the host ladder.

---

## Open questions for Greg

1. Merge both #200 and #201 before the next office round, or stage them?
2. Is refusing late answers at the rules boundary (honest stalled client) acceptable UX, or should the client surface the refusal?
3. Fix the stale `isEmulatorContention` comment in #200 as part of approval, or a tiny follow-up?
4. Follow-ups 2–7 on the ticket — still In Progress; any to prioritise next?

---

## What "approved" looks like

Claude's review finds no blocking defects (or Greg accepts residual risk in writing). Then Greg says go live / merge.

### Go-live steps (Greg only — merging deploys)

1. Merge PR #200 and/or #201 with a normal merge commit (no squash/rebase/force per house rules). Prefer merge commits so each can be reverted alone if needed.
2. CI on `master`: after e2e, **Publish rules to Firebase**, then **Publish to gh-pages**.
3. Verify: live site hash / gh-pages; for #201, `npm run check-rules` both directions once rules are live; optional `rank-harness` if #200's harness note matters for the next live check.
4. Wrap-up Jira comment on PROJ-119 with live hashes; leave ticket In Progress unless Greg closes follow-ups.

**Do not** paste `firestore.rules` in the console — CI publishes them (AGENTS.md / W2).

---

## Quick links

- PR #200: https://github.com/gregjrothwell/quiz/pull/200  
- PR #201: https://github.com/gregjrothwell/quiz/pull/201  
- Ticket: https://gmancodwarrior.atlassian.net/browse/PROJ-119  
- This file on the #200 branch: https://github.com/gregjrothwell/quiz/blob/claude/rank-harness-at/docs/reviews/PROJ-119-claude-review.md
