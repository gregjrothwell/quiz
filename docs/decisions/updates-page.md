# The What's new page

> **Owner: Greg Rothwell. Last updated: 23 October 2026. Budget: 250 lines.**

**Status: LIVE 22 October 2026** (#107, merge `9bab66d`, gh-pages `08594c7`, live `Updates-xf0SqJkg.js` byte-identical to a local build).
Asked for 21 Oct ("note down an updates page so users can see"); Greg said build it 22 Oct.

## Story

> As a player, I want to see what changed in the quiz since I last played, so a
> new round, a new rule or a new button is not a surprise mid-question.

## Acceptance criteria

1. The landing page has a **What's new** button beside **Season table**. — `Landing.tsx`
2. It opens a page listing each release, newest first, dated, in plain words. — `Updates.tsx`, `lib/updates.ts`
3. The button carries a dot until this browser has opened the newest entry; a
   private window that cannot store shows it every visit. — `hasUnseen`, `updates.test.ts`
4. No Firebase reads: the list is bundled, and the page is its own lazy chunk.
5. Nothing blind and nothing internal: blind packs get a name and a count only;
   no player names, costs or behind-the-scenes work. The repo and site are public.
6. Readable at 375px with no sideways scroll.

## Decisions taken without Greg (22 Oct), change any of them

| Open question (21 Oct log) | Taken | Why |
|---|---|---|
| Where the link sits | Landing, and the lobby | A join link auto-joins and never shows the landing page. The lobby button opens the same page; Back does not leave the room |
| Hand-written or from PR titles | Hand-written | PR titles are written for the repo, not the office |
| How far back | 21 Oct | The four releases that day are the ones nobody has been told about |
| Shown to the room by the quizmaster | No | Needs a shared state and a write; a link does the job for now |
| `public/updates.json` or bundled | Bundled (`src/lib/updates.ts`) | Cannot fail to load, and is typed and tested |

## Process

**Every PR that changes what players see adds its entry, and CI enforces it**
(22 Oct, [`lead-time.md`](lead-time.md)). Written as a rule, it was missed the
same day: #110 went live without its lines, and #114 added them. A PR touching
`src/` or `public/` without `src/lib/updates.ts` fails verify unless a line in
its description or a commit message starts `What's new: none — <why>`. Behind-the-scenes releases (scripts, docs,
traces) add nothing. Wording for call it: a right call beats any tap, a wrong one
scores nothing — **there is no call bonus** ([`typed-answers.md`](typed-answers.md)).

## Evidence, 22 Oct

- `npm run typecheck`, `eslint src`, `npm test` 1,707 passed (5 new).
- Dev server, desktop: dot present with storage cleared; opening the page wrote
  `vibequiz.updatesSeen = 2026-10-22`; back on the landing, the dot was gone.
  Screen readers hear "What's new (new)" while it shows.
- 375px: `scrollWidth` 375 = `innerWidth`.
- Gallery: last entry, `#/preview/<last>`, so no existing index moved.

**Not covered:** at 375px the Back button sits close under the sound control.
Season uses the same header markup; not checked whether it does the same there.

## Lobby, 23 October 2026

A remembered name on a join link skips the landing page (`shouldAutoJoin`),
which was the only place the button lived. The 22 Oct row above assumed every
player passed it. They don't.

The lobby header has the same button, dot included, for whoever is waiting and
for the quizmaster. Under the room code, while the dot is showing, one line:
**New since you last played**, then the first line of the newest entry
(`updatesNotice`). "Last played" is this browser's `vibequiz.updatesSeen`, not
a round they sat in — that isn't stored. Opening the page and pressing Back
flips a flag in `App`. The room listener keeps running, so the room is the one
they left. The lobby does remount, which clears the dot and also the
quizmaster's unsent picker choices.

## New stickers, 23 October 2026

A round type wears a **New** sticker through a `newUntil` date in
`src/questions/newRounds.ts`: fourteen days after the day it went live, last
day included, on the London calendar. No date, no sticker.

| Round | Went live | Sticker through |
|---|---|---|
| Random Round, Name the Artist | 12 Oct 2026 | 26 Oct 2026 |
| The Price is Right | 21 Oct 2026 | 4 Nov 2026 |
| Survey Says | 22 Oct 2026 | 5 Nov 2026 |

It sits on the pack card (the quizmaster's picker and the lobby vote share
`PackFace`), on question 1, and on the round title card between questions.
Pull a date forward to retire one early.

## Mode stickers, 23 October 2026

Same window, `MODE_NEW_UNTIL` in `src/questions/newRounds.ts`. A mode wears it
on the quizmaster's picker button. Share or Shaft wears it on its title
card. Beat the Chaser wears it on the intro the whole room sees for the first
few seconds of question one. Players vote for a pack, not a mode, so the vote
has nothing to sticker.
House defaults (As it comes, Played straight, Just us, and the rest) are not
modes.

| Mode | Went live | Sticker through |
|---|---|---|
| The Ladder | 1 Aug 2026 | 15 Aug 2026 |
| Played for stakes | 2 Sep 2026 | 16 Sep 2026 |
| First right answer steals, the 3×3 jigsaw | 4 Sep 2026 | 18 Sep 2026 |
| Share or Shaft | 24 Sep 2026 | 8 Oct 2026 |
| Beat the Chaser | 22 Oct 2026 | 5 Nov 2026 |

Only Beat the Chaser is still inside the window. The Ladder's date is the
commit that named it in the lobby; there is no separate deploy line. The
office season started 3 Aug, which would end the sticker on 17 Aug.

