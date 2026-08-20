# The configurable answer window

> **Owner: Greg Rothwell. Last updated: 20 August 2026. Budget: 250 lines.**

Moved verbatim out of `docs/HANDOVER.md` on 20 August 2026, when that file reached
2,422 lines. The text is unchanged; only where it lives is.

## The configurable answer window

**Shipped.** The quizmaster picks 10, 15 or 20 seconds in the lobby, and it is
fixed for the round. It earns its place more than a settings toggle usually
would, because it mostly cancels the vault's real cost: a round everybody
answers in five seconds still burned twenty, and at ten that stops mattering.

**Ten is the default**, and also the shortest on offer — the picker only ever
buys a round *more* time, from a floor that is the new normal. The rules accept
anything from 5 to 120, so another option is a one-line change.

> ### `DEFAULT_DURATION_SECS` and `LEGACY_DURATION_SECS` are not the same number
>
> They were, briefly, and merging them back would be a silent breakage.
>
> - **`DEFAULT_DURATION_SECS` (10)** is what the lobby starts on. Change it
>   freely; it is a UI preference.
> - **`LEGACY_DURATION_SECS` (20)** is what a room carrying *no* `durationSecs`
>   is read as. It has to match the literal in `firestore.rules` —
>   `get('durationSecs', 20)` — exactly.
>
> If the fallback said ten while the rules said twenty, a room created before
> this shipped would count its clients down to zero, auto-reveal, and be refused
> by a vault that stayed shut for another ten seconds. The round would stop dead
> on "the vault would not confirm an answer", and only for rooms that were
> already in flight — the hardest kind of bug to reproduce afterwards.
>
> Three tests in `src/engine/state.test.ts` read `firestore.rules` and fail if
> the two files drift. They cover the fallback, the 5–120 bounds, and that every
> option the lobby offers is one the rules would accept. Unlike
> `npm run check-rules` they need no network, so drift fails in the run that
> caused it rather than at the next preflight.

The window lives on the room as `durationSecs`, and **the security rules read it
from there** — the client and the vault have to agree about when the answer is
due, so there is deliberately no second copy of the number anywhere. The old
`REVEAL_GATE_MS` in `src/lib/vault.ts` was exported and used by nothing; it is
gone rather than parameterised.

### Where it is read

| Place | What it does |
|---|---|
| `src/engine/state.ts` | `durationSecs` on `RoomState`, plus the default and the bounds |
| `src/engine/reducer.ts` | `start` fixes it; `answer` rejects past it; `reveal` scores against it |
| `src/lib/useRoom.ts` | fills the default in at the Firestore boundary, so nothing downstream sees `undefined` |
| `src/lib/useQuestionClock.ts` | counts down from it |
| `src/screens/QuestionScreen.tsx` | `ArcTimer` total |
| `src/screens/Lobby.tsx` | the picker |
| `firestore.rules` | the reveal gate, and the two rules that keep it honest |

**`reveal` passing `durationMs` to `tallyQuestion` was a real fix, not
threading.** `scoreAnswer` and `tallyQuestion` always took the parameter, but
nothing ever passed it — so speed points decayed across a hardcoded twenty
seconds. A ten-second round would have capped everyone at three-quarters of the
speed bonus however fast they answered. There is a test pinning both numbers.

### The hole this opened, and the floor that closes it

Two rules keep the window honest, and the second one is not in the original
design note.

**`timingOk()` pins it while a question is open.** If a member could lower
`durationSecs` mid-question they would open the vault early while every other
screen still showed the time it had promised — silent, which is the exact class
of cheat the vault exists to kill. So `durationSecs` and `openedAt` both move
only on the write that opens a question, which is the pattern `openedAtOk()`
already used for `openedAt` alone.

**The bounds are what stop the restart trick.** Any member can already write the
room out of `question` and back into it, which restamps `openedAt`. That was
harmless while the gate was a fixed twenty seconds, because restarting could
only ever push the vault *further away*. Reading the window from the document
turns that same move into a way to pull the gate closer — so the rules bound
`durationSecs` to **5–120 seconds** regardless of what the lobby offers. The
worst anybody can now do is a five-second question, with the whole room watching
the timer jump. Vandalism, and loud.

Both have a deny check in `npm run check-rules`.

### Three things that will bite

- **`duration.value()` takes an `int`, and this number comes from a client
  SDK.** The gate is written as plain millisecond arithmetic —
  `request.time.toMillis() > room().openedAt.toMillis() + secs * 1000` — rather
  than `duration.value(secs, 's')`, because the SDK decides for itself whether a
  whole number goes on the wire as an integer or a double, and handing a double
  to `duration.value` errors the rule and denies **every reveal in the room**.
  Same lesson as `joinedAt is number` further up the file; this one fails much
  louder.
- **Rooms that predate the field have no `durationSecs`.** Both rule reads are
  `get('durationSecs', 20)` and `toRoomState` fills in `LEGACY_DURATION_SECS`,
  which is the same twenty and deliberately *not* the lobby's default — see the
  box above.
- **Anything that resets the probe room must not set `durationSecs` on the way
  back to the lobby.** `openProbeQuestion` writes the room to `lobby` and then
  into `question`, and only the second write may carry the window — the first is
  not a write that opens a question, so `timingOk()` refuses it. This is not
  hypothetical: it is what the preflight did on the first run after the new
  ruleset went live, and it failed before a single check had run. The rule was
  right and the helper was wrong, which is the good version of that failure.
- **The preflight needs two windows, not one short one.** The obvious speedup —
  give the probe room a three-second window — breaks the *deny* checks: roughly
  a dozen network round-trips separate them from the write that opened the
  question, so the gate would have closed on its own before they ran, and a
  reveal refused for the wrong reason proves nothing. `openProbeQuestion` now
  takes a window: the deny checks get 120 seconds, and the question is re-opened
  on 5 immediately before the allow check. That is where the minute came back.

### Publish the rules first, then deploy

**This is the opposite of what the vault needed, and the opposite of what the
old version of this section said.** The vault's rules required `openedAt ==
request.time`, which the then-deployed client never wrote, so publishing first
broke every question-opening write for about an hour.

Nothing here is like that. Both new reads are defaulted, and an update carries
the existing `durationSecs` through untouched even from a client that has never
heard of it — so **the new rules are fully backwards-compatible with the old
bundle.** The reverse order is the broken one: a new client writing
`durationSecs: 10` against the old fixed gate auto-reveals at ten seconds, gets
refused for another ten, and the round stalls on "the vault would not confirm an
answer".

So: publish `firestore.rules`, run `npm run check-rules`, then `npm run deploy`.

---
