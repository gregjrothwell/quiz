# The window the office plays in

> **Owner: Greg Rothwell. Last updated: 25 November 2026. Budget: 250 lines.**
> **Status: built 25 November 2026, not live.** PROJ-180, in the release with PROJ-179, 182 and 181. Rides the question-one
> trace ([`cass-q1.md`](cass-q1.md)). Greg, 11 Nov: "yes, measure it"; 25 Nov: "start now".

> As Greg, I want to know the real window sizes the office plays in, so that the layout fixes the review asked for (answer D
> under the desk on picture questions at 768px tall and below, a stage that does not grow at 1080p) are made for sizes people
> have. [`ui-ux-review.md`](ui-ux-review.md), open question 3: the sizes tested there were estimates.

## What was added

Three optional fields on `q1Traces/{gameId}_{uid}`, read as question one arrives on the device:

| Field | What it is | Bounds, client and rules |
|---|---|---|
| `innerWidth`, `innerHeight` | The browser window's inside, in CSS pixels | whole number, 0–20,000 |
| `pixelRatioPct` | `devicePixelRatio` × 100, rounded: 1.25 is 125 | whole number, 0–2,000 |

- **The ratio is stored × 100** because it is fractional and `intIn` holds whole numbers. Page zoom is inside it: 110% zoom on a
  125% screen is 1.375, kept as 138 and printed `@1.38`.
- **Absent is not zero.** Absent is an old bundle, or a browser that would not give a finite number. Zero is what the browser said.
- **Nothing else changed.** No listener, no read, no extra write; the rules require none of the three, so a tab on an old bundle
  still files its trace. Out-of-bound readings are clamped on the device, so a strange screen cannot cost the trace.
- `npm run read-traces` prints `1536 × 730 @1.25` after the network, a dash on a trace from before this. `read-owed` is unchanged.

## The rule was one field from its limit

**Firestore refuses a request over 1,000 expressions**, the failure that stopped rounds banking on 22 October
([`finals-history.md`](finals-history.md#22-october-2026-nobodys-round-banked)). `intIn` read the document four times for
each field, and three more fields took the fullest trace over. **Seen, on the first rules change here:** the trace a device writes
when it both started the round and answered was refused, *maximum of 1000 expressions to evaluate has been reached*, while
the two devices in the browser test filed theirs happily. Nobody would have been told: a refused trace is swallowed.

So `intIn` now reads its field **once, into a `let`**, the 22 October cure. Same answers: a missing key takes the lower bound as
its default, which passes; a present `null`, string, float or out-of-range value is refused as before.

Headroom on the fullest trace (every key), measured on the emulator by padding the rule until it refused:

| Rule | More number fields | More `1 <= 2` conditions |
|---|---|---|
| Published today, without the window | 1 | 10 |
| The window added, `intIn` as it was | **over** | **over** |
| The window added, `intIn` reading once | 7 | 38 |

The new rule costs less on its heaviest document than the published one does on its own, and that one passes live
(`check-rules` 167/0, 13 Nov). **The next fields still have to be paid for**; the fullest-trace case says so.

## Verified, 25 November 2026, locally

- **Both directions on the rule** (`e2e/q1-trace.spec.ts`, emulators, Firestore on 8085 for the run only). On the old rules the
  allow cases fail and the deny cases pass, for the wrong reason; on the first new rules the fullest trace still failed (above);
  on these, all 7 pass. Allowed: the trace as the client builds it, an old bundle's, each figure alone at
  zero, the upper ends, the fullest, the barest. Refused: 23 single faults, each in its own round, **and each lands under the same
  id once put right**, so the fault is what was refused.
- **Through the app:** two browsers in a real round, 1366 × 657 @1.25 (resized in the lobby, so it is the window question one
  was seen in) and 1440 × 900 @2, each kept as its own browser reports it, and `read-traces`' own printer prints them.
- **A refused trace does not break the round:** on the old rules the same round played on through question one's reveal.
- **Old traces still print:** the new `read-traces` against the live project, read-only, 60 of 60, none malformed, a dash each.
- **Deliberate breaks:** 33 of 33 caught by unit tests (writer 17, printer 8, rules text 8) and 11 of 11 on the rule caught on the
  emulators, each command passing on unbroken code first. In the app: reading the size at load instead of at question one is caught
  by the browser test; handing over nothing is caught by the typecheck, so the browser test never ran on it.
- `typecheck`, `lint`, `npm test` 2,518 of 2,518. (`npm test` says nothing about the published rules.)

## Not covered

- **The published rules.** CI publishes them at the release, before the site. Then `npm run check-rules`: its trace probe now
  carries every key, and there are four new cases (an old bundle's trace allowed; three faults refused). Until
  the publish, that allow fails and the denies mean nothing.
- **The numbers.** The first office round after the release: `npm run read-traces`. **PROJ-180 stays open until then**, so the
  release PR does not list it on a `Closes` line.
- **A phone**, where the toolbar changes `innerHeight` as it hides. None has ever left a trace.
- **A window resized after question one arrives**, and anyone who never reaches it. One reading per device per round.
- **Screen size.** This is the window; nothing records the monitor.
