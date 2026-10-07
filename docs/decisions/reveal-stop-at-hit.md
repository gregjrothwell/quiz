# Stopping at the hit: where the reveal's time goes

> **Owner: Greg Rothwell. Last updated: 7 October 2026. Budget: 250 lines.**

Moved verbatim out of [`reveal-delays.md`](reveal-delays.md) the day it was
written, when that file reached 265 of its 250 lines. That file is why a
reveal *stalls*; this one is what a healthy reveal *costs*, and the change
that cut it.

## 6 October 2026 — ahead of a game of thirty

> "I've noticed the question reveal taking a little longer than it should." — Greg

**Read back, not guessed:** `read-games --game` on `RRGM` ×2 and `K3EN`, 45
reveals. Typical **0.7–1.0s** (gate ~100 + resolve 350–700 + dispatch ~240);
tail **1.7–3.1s**, always a slow resolve (1.4–2.7s) or dispatch (1.3–1.6s).
**No `x2` anywhere** — the 11 September stall has not come back.

**The resolve is three refusals, and each one reopens the write stream.**
Read in the SDK (`@firebase/firestore` 11.10, `index.esm2017.js`,
`__PRIVATE_onWriteStreamClose`): a permanent write error closes the stream, the
batch is dropped, and the stream restarts and resends the pipeline. So the four
candidates are served one stream at a time, and the room update queued behind
them pays a reopen too unless the hit was last. Seen live 6 Oct from Node: the
gRPC stream id goes up by one per refusal.

**A/B from Node, 18 reveals each way** (`.cache/reveal-ab.ts`, rooms `FSC9`,
`HK9N`, not committed): today's parallel resolve is ~180–270ms wherever the
hit is; stopping at the first hit is **~40ms + ~80ms per refusal before it**
(hit@0 41ms, hit@3 238–325ms), with dispatch ~15ms quicker. Medians came out
level only because that arm drew the last option 4 times in 10. **Node's
reopen is cheap; the browser's is not** — the live resolve (~450ms for three
refusals against ~50ms for a clean write) puts it at well over 100ms. So the
browser saving is an *estimate*, not a measurement: roughly halve the refusals
on average, and the dispatch stops paying a reopen. Worst case unchanged.

**What does not grow with thirty:** the vault rule does two `get()`s and the
room update rule only `keys().size()`, whatever the seat count; a reveal is
four candidate writes and one room update at any size. The replay hold caps at
1820ms once the answers span 2.5s, which a room of thirty will almost always do.

**Blind spot in `RevealTiming`:** it starts at `expiredAt`, the moment the
quizmaster's tab *noticed* the clock ran out. The clock is a 100ms
`setInterval`, and Chrome fires a hidden tab's timers once a second, or once
a minute after five minutes hidden and thirty seconds silent
([Chrome, checked 6 Oct 2026](https://developer.chrome.com/blog/timer-throttling-in-chrome-88)).
A host whose quiz tab is behind another tab would reveal late, and nothing
kept would show it. Unmeasured here.

### Built the same day: stop at the hit (`reveal-stop-at-first-hit`, not live)

`resolveAnswer` asks one option at a time and stops at the first accepted.
No rules change. **Measured in a browser** (dev server, debug token, live
project, Science, 10s), as a non-member sees it — window end to the reveal
snapshot arriving — with `vault.ts` hot-swapped between old and new, each swap
checked against the module the page actually fetched:

| | n | range | median |
|---|---|---|---|
| old, all four at once | 7 | 491–567ms | **516ms** |
| new, stop at the hit | 13 | 211–592ms, one 1191ms | **346ms** |
| interleaved in one room (`NP6B`), old v new | 5 v 5 | 491–567 v 216–489 | **512 v 309** |

The old arm is tight because it always pays three refusals; the new one spreads
by where the hit falls, and a hit on the last option costs what the old code
did. One 1191ms on the new code is unexplained; n is too small to say
anything about tails, so the office's `RevealTiming` is the next reading.
**Both directions, live, new code** (Node, room `J9HV`): asked 1.3–1.4s into a
5s window, refused with the vault error in 311–419ms; asked after it, found in
86–303ms. Rooms `4V6E` and `NP6B` stopped short of the whistle, so no game
record and no season row — `read-games --last 2` still shows `RRGM`. Twenty
Science questions joined that pack's asked history, which nobody plays.

**The 1191ms, chased the same afternoon** — Greg: *"a big hang without
explanation is concerning."* Twenty more on the new code (room `U3WV`) with
Firestore's debug log captured in the page and a watcher stamping absolute
times. **None slow: 206–691ms, every millisecond accounted for** — about
100ms gate, then ~110ms per refused option (write ~70ms, new stream ~45ms),
then the accepted write and the room update at ~65ms each:

| refusals before the hit | n | seen by others |
|---|---|---|
| 0 | 5 | 206–268ms |
| 1 | 5 | 347–437ms |
| 2 | 2 | 436–445ms |
| 3 | 8 | 534–691ms |

No backoff, no retry, no error but the 403s, 33 refusals in 20 reveals (1.65
against the old code's fixed 3). The slowest, 691ms, was the room update
taking 178ms at the server. **Corrections to the table above:** with all 33,
the new median is **388ms**, not 346; and the worst case is not "what the old
code cost" but a little over it — 570ms median against 516, n=8 v 7, taken
at different times. **The 1191ms itself was in the untraced run and stays
unexplained.** What the trace rules out is a stall in the new path; hangs of
that size already happen on the old code — 13 of the 45 office reveals read
back above were over 1.2s, up to 3.1s, split between the vault step and the
room update — and the new code makes fewer of the round trips they live in.
**Instrument note:** the page's long-task observer recorded nothing even for
a forced 120ms busy loop, so it proved nothing and nothing here leans on it.

## 7 October 2026 — superseded by Firestore Lite

`XRUE` showed the office paying ~200ms a refusal and once 2.8s for two. The candidates now go
over Firestore Lite, all four at once — a refusal there is a request's 403, not a stream reopen:
median vault step 71ms against this code's 167ms, measured side by side. Depth:
[`office-feedback-7-oct.md`](office-feedback-7-oct.md#built--0d6e964).

