# Your own line on the reveal, and the table at the breaks

> **Owner: Greg Rothwell. Last updated: 26 November 2026. Budget: 250 lines.**
> **Status: built 25 November 2026, not live; in `release-2026-11-26`.** PROJ-182, on top of PROJ-179 ([`question-lead-in.md`](question-lead-in.md)).
> Finding 1 of [`ui-ux-review-the-show.md`](ui-ux-review-the-show.md). Greg, 11 Nov: yes; 25 Nov: criteria ok.

The full table followed every question, fifteen times in a seven-minute round, and the quizmaster
pressed twice to get past it. Measured on 79 kept rounds (9 Sep – 11 Nov): the answer window is 45% of
a round, and a median 11.5s passes between one question closing and the next opening.

## Criteria, as agreed

1. At the reveal each player sees their own line: place, movement and points ("3rd · up one · +800").
2. The full table at the breaks: **every five questions**, **before a stakes question**, half-time, before a final, at the end.
3. Between questions the quizmaster presses once.
4. Nothing needs sound to be understood.
5. Played in one office round, then `games/` read for the gap against 11.5s. **Owed, after go-live.**

Greg, 25 Nov, on the two open questions: every five questions too ("ok"), and the quizmaster sees the
same reveal as everyone, with Next and a "Show the table" button ("ok"). And on the one this doc
asked: the table before the question played for stakes, so nobody stakes blind ("ok").

## How it works

- **`afterReveal()` (`src/engine/afterReveal.ts`) is the one answer** to where a reveal leads: the next
  question, the table, or the results. The reducer, the button, the Space key's label and the line
  everyone else reads all ask it.
- **`next` from a reveal opens the next question.** It was two phases and two writes; it is one. No
  rules change: `opensAQuestion()` (`firestore.rules`) already allowed reveal straight to question, and
  `openedAt` is stamped on the way in as it always was.
- **`showTable`** is a new action, reveal to `scoreboard`, for a room that asks. Refused on the last
  reveal: before a final the table comes anyway, and before the results it gives the podium away.
- **`ownLine()` (`src/engine/ownLine.ts`)** is `boardMoves` and `roomStandings` over the morning's
  totals, so the line and the table cannot disagree, in the second half of a Double included.

## Decided while building — for Greg to overrule

**Greg, 26 Nov 2026: 2–6 "ok"**, each answered on its own on the release calls page. 1 was not put
to him separately; it is what the reveal pictures he approved showed.

1. **The line sits beside the points, not instead of them**: "Correct · +800", then "3rd, up one".
   Nobody's place moves on question one ("3rd", not "3rd, down two"), and a board on nothing has none.
2. **A thrown-out question still stops at the table.** There is no reveal to say it on.
3. **Survey Says has no table after its fifth question**: five tells have scored nobody.
4. **Next is held until the verdict lands** (the replay, or 0.7s with none or with reduced motion).
   Enter also locks an answer in; on the buzzer it would have opened the next question over an answer
   nobody had seen. A table used to be in the way.
5. **The Commentator's "new leader" moves to the reveal** where no table follows and the reveal has
   nothing else to say. Left alone, it would have been said one question in five. Neck and neck, and
   runaway, stay at the table.
6. **The lead-in names the pack** as a chip beside the category, where they differ. The card between
   questions said it ("Question two · On the box"). The card and its sting still play at a break.

## What stays up now, and what that needed

The question screen used to be taken down between questions by the table. It now stays from a reveal
into the next question. Three things depended on it going:

- **Focus.** The Next and Reveal buttons were one element to React. It would have kept the focus and
  been disabled under it, and a disabled button swallows the keys a question is answered with. Keyed apart.
- **Scroll.** A phone scrolled to the lecterns would open the next question with its prompt out of
  sight. A question now opens at the top; a reveal leaves the page alone.
- **Anything kept by question** was already keyed by question or index. Read, each one: the pick, the
  call, the replay, the cues, the vote, the picture.

## Not covered

- **The stakes table in a browser.** Unit tests only, both halves of a double included; no spec plays a
  round with stakes.
- **A slow or old tab in the room.** An old quizmaster tab still stops at the table after every
  question and the rest of the room follows it there; an old player's tab has no line.
