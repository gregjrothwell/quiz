# Host authority: the AC8 stall

> **Owner: Greg Rothwell. Last updated: 22 October 2026. Budget: 250 lines.**

Moved verbatim out of [`host-authority.md`](host-authority.md) on 22 October 2026, when a correction took that file past its 250-line budget. The text is unchanged.

## 15 October evening: the AC8 stall, and the gaps closed

**The stall.** CI showed Ann take the chair at +75 s, then sit on "Revealing…":
`handleReveal` returned at `answersReady` every time, and her answers listener
gave one cached snapshot (`fromCache: true`, her own answer) and never one from
the server, with no error. Cause found by logging every early return (run
38799952009): before the room's first snapshot, `hostUid` read as absent, so a
joiner listed every answer as if the room were pre-W3, and was refused. **Fix:**
no answers listener until the room has been read (`roomKnown`, `useRoom.ts`).
After it, the same claim gets the server's snapshot (2 answers) in 50 ms and
reveals (run 38801025236). Why the SDK never re-confirmed that query is not
established; only that gating cures it.

**Also closed:** AC12 in a browser (never run before; "Correct · +1,000", not
"Correct"); the final's allow cases; 28 W3 cases in `check-rules`; three
harnesses make hosted rooms that beat (`scripts/hostBeat.ts`). **Late 15 Oct,
#90:** all six do; `final-harness` is the live allow case for the final (FAE8);
`rank-`/`final-harness` light lamps (Gus reads 7 of 7, 4NW8); a 429 is named.
An RTDB write keeps Node alive past `deleteApp`, so both now `process.exit`.
