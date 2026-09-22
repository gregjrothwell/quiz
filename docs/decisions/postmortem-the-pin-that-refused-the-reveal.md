# Post-mortem — the pin that refused every reveal

> **Owner: Greg Rothwell. Last updated: 22 September 2026. Budget: 250 lines.**

Written for the next agent to work on this project, whichever one it is. A
security fix shipped on 21 September 2026 and made the game unplayable. Nobody
noticed until Greg tried to play it. The suite was green, the rules check said
80/80, and the round stopped on question one.

This is not a file about Firestore. The bug is a shape, and the shape recurs.

## What happened, in one paragraph

[#56](https://github.com/gregjrothwell/quiz/pull/56) closed a real and serious
hole: any signed-in player could rewrite `questions[0].id` mid-round and pull
every answer out of the vault. The fix pinned the `questions` array so it could
only change in the lobby. But `reveal` writes that array too — it stamps the
resolved answer into `questions[index].correctIndex` so the other clients read
it off the room update instead of each paying for a vault round trip
([`reducer.ts` line 339](../../src/engine/reducer.ts)). Pinned byte for byte,
that write was refused. **Every round, every pack, stopped dead on its first
question.** Greg hit it on a picture round and reasonably assumed pictures were
the problem; they were not.

## The four things that should have caught it, and why none did

### 1. The comment asserted a fact about the client that was never checked

The rule shipped with this justification written above it:

> *The client only ever sets `questions` in `selectPack`, which refuses outside
> the lobby, and clears it in `reset`, which returns to the lobby — so pinning
> it here costs nothing a real round does.*

Every clause is true. The conclusion is false, because there is a third writer
and nobody looked for it. Finding it costs one command:

```bash
grep -rn "questions:" src/engine/reducer.ts
```

`CORE.md` already says **never speculate about code you haven't read**. This is
what that looks like when it happens inside a comment rather than inside a
sentence to Greg — and a comment is worse, because it reads as a finding
somebody made rather than an assumption somebody had. It then survived review,
because it looked like the work had already been done.

> **Rule.** A comment that says *"the client only ever…"*, *"nothing else
> writes…"*, *"this is the only caller…"* is a claim about code. Grep for it,
> and put the command in the commit message so the next person can re-run it.
> If you cannot express the claim as a search, it is not a claim, it is a hope.

### 2. Every new test was a deny case, so the suite was satisfiable by "deny everything"

`npm run check-rules` had eighty cases and #56 added several. Every one of them
was a *deny*: rewrite the question list — refused. Ask about a substituted
question — refused. Join with `joinedAt: 0` — refused. All passed.

They passed because **the new rule refused everything**, including the game. A
suite made only of deny cases is satisfied by `allow read, write: if false;`.
It cannot tell a rule that is correct from a rule that is welded shut.

This project already knew that. `EVIDENCE.md` says it, from this same codebase,
written three weeks earlier:

> *A refusal for the wrong reason is not proof. Before a rule is published,
> every deny case passes because everything is denied — they only start meaning
> something once the rule exists. Read the **allow** direction to know a change
> landed.*

It was written down, loaded into context every turn, and skipped. So the lesson
is not "write it down harder". The lesson is that the rule needs a shape that
is hard to skip, and "remember to also think about the allow direction" is not
one. This is:

> **Rule.** A deny case may not be committed alone. Every change to a rule ships
> **one allow case per rule function it touches**, exercising the path the real
> client takes. If the allow case did not exist before your change and does not
> fail before your fix and pass after it, you have not tested anything — you
> have described your intention twice.

The fix for this incident added two cases. Only one of them matters:

| | before the paste | after |
|---|---|---|
| allow · reveal, stamping the answer into the question in play | **FAIL** | PASS |
| deny · add a question to the list while one is open | PASS | PASS |

The deny case was passing the whole time, and meant nothing until the allow case
passed beside it.

### 3. The offline suite cannot see rules at all, and its greenness is misleading

1,021 tests across 67 files passed throughout — before the bug, during it, and
after the fix. Not one of them touches a published ruleset, because `npm test`
runs offline by design.

> **Rule.** `npm test` green says nothing about a rules, config, or permissions
> change. For those the evidence is `npm run check-rules`, and the sentence "the
> tests pass" must not appear in the report as though it covered them.

### 4. Nobody played a round

`npm run rank-harness` stands up eight live clients and drives a real round from
`start` to `finished` against the live project. It takes about ninety seconds
and it is in the command table in `CLAUDE.md`. Run after the paste, it produced
this on the first try:

```
1000 / 900 / 800 / 700 / 700 / 600 and a zero — room CNSE, reveal written,
read back from the server, re-derived by a second client.
```

Run *before* Greg played, it would have failed on `>>> WRITING reveal` and the
office would never have seen it.

> **Rule.** A change to a gate is not done until the thing behind the gate has
> been through it. Not a probe shaped like the client — the client's own path.
> This project has `rank-harness`, `host-room` and `sync-harness` for exactly
> that, and the cost of all three is under five minutes.

## The generalisation

Four different safeguards existed. All four were satisfied. The game was dead.

That is not bad luck, it is the signature of a particular mistake: **every check
was pointed at the thing being changed, and none at the thing being protected.**
The rules check asked "does the rule refuse what it should?" The test suite
asked "does the engine still compute what it should?" Nothing asked "can a
person still play a round?"

> **The rule that covers all four.** When you tighten something, the next thing
> you do is use the feature it guards, end to end, as a user. Before the commit
> message, before the write-up, before saying it is done. If that is expensive,
> it is the most important thing you will do all session; if it is cheap —
> and here it was ninety seconds — there is no argument at all.

## A note on how it was reported

The bug arrived as *"grok broke the quiz — just got stuck on the first question
of a picture round."* The picture round was a coincidence; the break was
universal. Two habits worth keeping from the diagnosis:

- **Hypotheses were killed with commands, not with reasoning.** Four candidates
  were wrong (changed pack ids, a missing vault entry, the RTDB presence paste,
  a still-loading hang). Each died to a single query rather than to an argument,
  and the cost of being wrong four times was about six minutes.
- **The reproduction came before the fix.** The new allow case was written and
  run against the *published* ruleset first, so the diagnosis was a FAIL on
  screen rather than a claim in a paragraph. See `EVIDENCE.md`, "the instrument
  can lie": a fix that is only ever tested after the change cannot tell you it
  fixed anything.

## What this cost

One round of the office quiz, on a Monday, with everybody watching. It was
caught by the Product Owner trying to use the product, which is the last line of
defence and the most expensive place to find anything.

## See also

- [`security-round-sept-2026.md`](security-round-sept-2026.md) — the finding
  this fix came from, with the correction recorded in place on S1
- [`vault.md`](vault.md) — what the reveal gate does and does not buy
- `~/clawd/context/workflow/EVIDENCE.md` — the rule that was already there
