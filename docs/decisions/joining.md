# Joining a room

> **Owner: Greg Rothwell. Last updated: 20 August 2026. Budget: 250 lines.**

Moved verbatim out of `docs/HANDOVER.md` on 20 August 2026, when that file reached
2,422 lines. The text is unchanged; only where it lives is.

## Ways into the room

Three routes to the same place, in the order they are worth reaching for:

1. **The link**, copied from the lobby and pasted into the Teams chat. One tap
   and the joiner lands on the landing screen with the code already filled, so
   all they supply is a name.
2. **The code read aloud**, four characters from an alphabet that omits every
   pair people confuse — I/1/L, O/0, Z/2. This is the route that always works.
3. **The QR**, for a player on their phone with the call on their laptop. It
   carries the same link, and always did — the QR was never a picture of the
   four characters, which is worth saying because it is the natural assumption
   and it made the QR look far less useful than it was.

All three go through `codeFromHash` in `src/engine/roomCode.ts`, which is
strict on purpose: an invalid code returns null rather than half-filling the
field, because a partly-populated box someone then types into is how you join a
room nobody meant to be in.

### The link goes straight in — 28 August 2026

A regular following the link was being shown a screen that already knew both
answers: the code came from the link and the name has been in `localStorage`
since `rememberedName` shipped. So it asked for a press and nothing else.

`shouldAutoJoin` in `src/engine/autoJoin.ts` decides when that press can be
skipped. **It is written as a list of refusals**, because that is the half worth
testing — no linked code, no remembered name, a name that is only whitespace,
not signed in yet, not connected, the link already used, or already in a room.
Every one of them falls back to exactly the screen that was there before, with
the code filled in. Nothing here lets the app do anything it could not do
before; it removes a press and nothing else.

**The one refusal that is about the game rather than about readiness is the
Lurker.** A Lurker belongs to no side for the season and picks one for the
night, and that pick lives in *session* storage on purpose — sitting with Hermes
this week is not a standing arrangement. So a Lurker opening a link in a fresh
session has a squad and no side, and auto-joining would bank their week to
Lurkers instead of to whoever they actually sat with. Nobody would see it
happen. They get the landing screen, which asks.

An empty squad is deliberately **not** the same case: it banks as "keep whatever
the record says" and changes nothing, so those players go straight in.

Two details that are load-bearing rather than tidy:

- **`linkConsumed` is module scope, and is set before the join is attempted.**
  Component state would be reset by the unmount that leaving a room causes, and
  the link would fire again the instant somebody pressed Leave. Setting it first
  is what stops a failed join — a room that has gone — retrying for ever.
- **The effect calls `join`, not `handleJoin`.** `handleJoin` sets `busy` and
  clears the error synchronously, which is a `setState` inside an effect; the
  lint rule catches it and `App.tsx` avoids the pattern everywhere else. Neither
  is wanted here anyway, since `busy` exists to disable a button and this path
  has no button.

Because somebody who comes straight in never sees the landing screen's *"change
it if you aren't Greg"* line — which exists for the borrowed laptop — the lobby
says it instead, naming the squad as well as the name, and offers **Not you?
Start again**. That leaves and returns to the landing screen without re-joining,
because the link is already consumed.

The copy button degrades rather than lying. `navigator.clipboard` needs a
secure context and a permission the browser can refuse, and on an insecure
origin it is absent outright — which throws where the others reject. All of it
lands in one fallback: select the text, say so, and let the reader use their own
copy shortcut. A copy button that silently fails is worse than no button,
because the next paste is whatever was on the clipboard already.

**Nothing here needs rules or a re-seed** — it is client-side routing over a
room code that already existed.

---

## Joining a round that has already started

Room **6JA5**, 17 August 2026, Geography, twenty questions, six people. Two
people arrived after it began, and the post-mortem on that room found three
faults. All three were already in the code before that night; the round exposed
them rather than caused them.

### The stale seat, and how it was proved

`resolveQuizmaster` picks whoever has been in the room longest, so `joinedAt`
decides who drives the round. `joinedAtRef` in `useRoom` remembers this device's
place so that coming back from a reap does not cost a quizmaster their chair —
but it was never cleared, and it outlives a room.

Double D's entry in 6JA5 reads `joinedAt: 1786963245823` — 10:40:45.823. Room
**6WP6** has `expiresAt` exactly thirty days after that same millisecond, an
empty `players` map and a single score of zero under Double D's uid. That is the
signature of `createAndJoin` followed by `leave`. They made a room by accident,
left it, joined the real one, and were stamped in 6JA5 with the moment they
created the *other* room.

It cost nothing that night only because 10:40 happens to be later than the
host's 10:36. Nothing made it so. Had that stray room been created a few minutes
earlier — or had the tab simply still been in the previous game, where Double D's
stamp was **08:43** — the arrival would have resolved as quizmaster of a round
already under way. The transport moves to a device that has just walked in,
whose answer clock starts from zero, so the round stops until the newcomer's own
timer runs out.

Two fixes, because either alone leaves the other half open:

- the ref is stamped with its room and restored only into that same room;
- a genuinely new entry is seated with `seatBehind`, which is `max(now, latest
  joinedAt + 1)`. A slow laptop clock cannot get ahead of the room either.

A reap-and-return still restores the original seat, which is the case the ref
exists for.

### The fresh clock

`useQuestionClock` counts from the moment *this* device saw a question open. That
is deliberate and stays — comparing against the quizmaster's `questionOpenedAt`
folds their clock offset into everyone's speed score, and office laptops
disagree by more than the bonus is worth. It is sound for anybody present when
the question opened, because a local clock can only start late.

It is not sound for somebody who joins halfway through. They get a full fresh
window on a question that is already nine seconds old, and an answer given on the
buzzer is stamped as though it were instant — up to 990 points for arriving late
and guessing.

Fixed without consulting any clock at all. The first snapshot after joining is
the room's current state, so a question already open in it is one this device did
not see open. `engine/arrival.ts` holds the rule; that question is submitted at
the full window, so it scores its points and no speed bonus, and the arc timer is
replaced by a line saying why rather than counting down a window the room does
not have left.

### The phantom game

Boss Man joined at 10:47:26.911 — thirty-three seconds after the last question
opened, eight seconds before the results went up. He answered nothing. Two
things happened anyway:

- `writeSelfIntoRoom` wrote him a score of zero, and `standings` is built from
  `scores`. He went onto the final board, and `seatedLast` put him in the
  loser's chair for a game he never saw.
- The banking effect fired on the finished screen and took his season record from
  eight games to nine, on a score of zero.

Now: a join into a `finished` room opens no score at all — absent from `scores`
is absent from the standings, and `reset` gives everybody a score again when the
next round starts. And a device banks only if its game log holds at least one
question of that game. One is enough: joining late and playing three of twenty is
still playing, and the log is mirrored into session storage so a reload does not
read as never having been here.

### Still open

**The board cannot tell the room who was actually playing.** The fixes above are
all per-device or per-arrival, because `playerOk` in `firestore.rules` validates
a player entry with `hasOnly(['name', 'joinedAt', 'playerId'])` — recording the
question somebody joined at would need a rules change, and this project has had
two broken by a hand-paste. So a player who joins at question eighteen is still
ranked against people who played all twenty, on every screen. Worth doing, and
worth doing at the same time as the next rules change rather than on its own.

Nothing here needs a rules change, so all of it shipped.

---
