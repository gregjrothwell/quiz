# The question screen — a reveal that holds still, and an entrance in order

> **Owner: Greg Rothwell. Last updated: 13 November 2026. Budget: 250 lines.**

**Status: built 13 November 2026, not live.** PROJ-178, branch
`PROJ-178-question-screen`. Rows 1–3 of the ranked list in the November UI/UX
review (PROJ-177, `ui-ux-review.md`, on PR #203 and not on this branch yet).
Greg, 11 November: yes to the story, and ok to the two criteria that changed.

## The story

> As a player at my desk, I want the question to arrive in order and the reveal
> to tell me what happened where I am looking, so that it reads as a show and
> not a slideshow.

## Acceptance criteria, as approved

1. At the reveal nothing on the question screen moves vertically when the clock
   leaves the header.
2. The points you earned are never drawn over an answer's text; they land where
   the clock was. *(Changed 11 Nov: was "beside its text".)*
3. Wrong answers stay readable at the reveal, about half strength.
4. Your verdict is shown where the clock was, at display size. *(Changed
   11 Nov: was "by the answers".)*
5. The right answer is named in words for a screen reader.
6. A question arrives picture, then prompt, then the four answers in turn, about
   0.9s in all; reduced motion gets no movement.
7. Transform and opacity only; `backwards`, not `both`, on anything that later
   changes state ([`gotchas.md`](gotchas.md)).
8. No change to rules, scoring or the answer window.
9. Filmed before and after from a player's seat.

Players are on a call while they play (Greg, 11 Nov), so nothing here depends on
sound. Out of scope: the lead-in (PROJ-179), the 768-tall overflow, the lobby.

## What was built

**One cell in the header, there for the whole question** (`.qhead__clock`). The
clock used to be the grid item, so when it left at the reveal the header lost
its tallest child. The cell is the grid item now and keeps the clock's height
(`--clock-size`, used by both), so the reveal changes what is in it and nothing
around it. A mid-question joiner's "You joined mid-question" line sits in the
same cell.

**Your verdict in that cell** (`.qhead__verdict`): the points, and the word
under. Held invisible through the replay like the desk's `.verdict`, landing
with it when the last name has arrived.

| Verdict | Word | Points shown |
|---|---|---|
| Right | Correct | `+1,000` |
| Wrong | Not this time | only a lost stake, `−500` |
| No answer | You didn't answer | only if robbed by a steal |
| Not scored (`lost`) | Didn't arrive, in amber | never |
| Survey Says, part one | Noted | never |

The number follows the desk's rule: shown only where the score moved. The desk
line is unchanged and is the one a screen reader gets; the stamp is
`aria-hidden`, so the verdict is not read twice. The desk keeps the long forms
("Not this time — that didn't match", `LOST_LINE`) and the streak stamp.

**The pop over the lectern is gone** (`.tile__pop`, `PodiumTile`'s `pop`). It was
`inset: 0`, centred, so "+1,000" landed on the right answer's own text.

**Also-rans at 0.45, not 0.1** (`.tile--gone`).

**"Right answer: " ahead of the answer's text**, screen-reader only, on the
lectern the reveal lights green. Not a live announcement: a screen reader finds
it on the lectern, it is not told when the reveal lands. Not asked for here, and
the review's "Locked in is not announced" is the same gap.

**The entrance**, all CSS:

| What | Starts | Runs | At rest |
|---|---|---|---|
| Picture (`.still`) | 0ms | 360ms | 360ms |
| Prompt (`.prompt`) | 100ms | 420ms | 520ms |
| Answers A, B, C, D | 300, 390, 480, 570ms | 380ms each | 680–950ms |

It was prompt at 0ms, answers at 0/70/140/210ms, and no entrance for the
picture. The picture's `<figure>` is keyed on the question so its entrance
plays for each one; two picture questions in a row used to share an element.
Under reduced motion the three delays are zeroed as well as the durations. The
blanket rule only collapses durations, and it is left alone: elsewhere a delay
is the order things are told in, and the podium must not name its winner first.

## Measured

Same instrument both sides: the design gallery (`#/preview`) on two dev
servers, this branch and an unchanged checkout whose three files match
`origin/master`. Distances are from the top of the header.

**1366×768, all 29 question and reveal scenes**

| | Header | Prompt | First answer |
|---|---|---|---|
| Before, question | 110.8px | 147.4px | 280.6px |
| Before, reveal | 52.6px | 89.3px | 222.5px |
| After, question | 110.8px | 147.4px | 280.6px |
| After, reveal | 110.8px | 147.4px | 280.6px |

The jump was 58.2px, the review's 146 → 88. It is 0.

**375×812**

| Chips | | Header, question | Header, reveal |
|---|---|---|---|
| Geography + medium, one line | Before | 82px | 80.6px |
| | After | 82px | 82px |
| Higher or Lower + medium, wrapped | Before | 116.8px | 80.6px |
| | After | 116.8px | 116.8px |

The second row is a jump the review did not see: on a phone, chips that wrap
beside the clock unwrapped into its space when it left, and took 36.2px out of
the header. The cell being there either side of the reveal fixes that too.

**A real round**, three questions of On the box on the local emulators, from a
player's seat at 1366×768 (throwaway Playwright spec, three seats). Header
110.8px, prompt 123px, first answer 188.4px, picture 196.4px below the header's
top: the same on all three questions while the clock ran, 250ms into the reveal
and 3.75s into it, in the ordinary seat and the reduced-motion one. The stamp
read "+1,000 Correct", "Not this time" and "You didn't answer" in turn, and in
each case had not landed at 250ms and had at 3.75s. No `.tile__pop`; every
also-ran at opacity 0.45.

**The entrance, sampled every frame** on the second question of that round:

| | First visible | At rest | Before (review, 11 Nov) |
|---|---|---|---|
| Picture | 16ms | 366ms | there from frame one, no entrance |
| Prompt | 116ms | 533ms | 90% visible at 165ms |
| Answer A | 316ms | 683ms | |
| Answer B | 399ms | 783ms | |
| Answer C | 483ms | 866ms | |
| Answer D | 583ms | 966ms | visible at 216ms, at rest by 599ms |

**Reduced motion:** one frame with nothing shown, then the picture, the prompt
and all four answers at full opacity and in place on the next (16ms). Nothing
is ever part-faded or part-moved.

The film is `.cache/ux-film/178/after-player-seat-1366x768.mp4` in the main
checkout (60s; not in git), beside its screenshots, `measured.json` and the
spec. The before film is `.cache/ux-film/player-seat-1366x768.mp4`, 10 Nov.

## Two things the measuring changed

**The cell is wider than the clock from 44rem up, on purpose.** The verdict
needs about 9.5rem and the clock 5.4rem. If the cell grew at the reveal the
chips beside it would slide along the row: before this change they moved 86px
sideways at the reveal (right edge 1000.6px → 1087px). The cell is 9.5rem from
the start instead, so the chips sit 65.6px further left than they used to for
the whole question, and do not move.

**On a phone the verdict is set small, a word to a line, in the clock's own
57.6px.** Reserving the verdict's width there was built and measured first: at
375px it wrapped the chips and made the header 34.8px taller for the whole
question (82 → 116.8px), which is answer area a phone does not have. So below
44rem the cell is exactly the clock's size and the stamp is `--text-md` points
over `--text-2xs` words. The tallest case, a robbed leader who did not answer
("−500 / You / didn't / answer"), is 55.6px in a 57.6px cell. **This is criterion
4 met in substance, not to the letter, on a phone**: where the clock was, but
not at display size. No phone appears in 143 question-one traces (PROJ-177).

## Not covered

- **Other things still move at the reveal.** The Apple badge appears between the
  prompt and the answers on tune and sleeve questions, the stake picker leaves
  on a wagered last question, and the desk swaps lamps for the vote. None is
  the clock leaving the header, and none was measured or changed here.
- **Nobody has heard a screen reader say it.** The words are in the tree; no
  screen reader was run, as in the review.
- **Not played by people.** The first office round is the check on whether the
  verdict reads at a glance and the entrance feels unhurried on a 10s clock:
  the last answer is now at rest at 0.97s where it was 0.60s.
- **One picture pack on film.** Text, tune and Catchphrase-hold questions were
  looked at in the gallery only.
- **The film ran on a 10s clock with nobody reading.** It shows the order and
  that nothing moves; it cannot show whether 0.97s is too long to wait for D.
