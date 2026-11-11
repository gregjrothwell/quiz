# UI/UX review — November 2026

> **Owner: Greg Rothwell. Last updated: 11 November 2026. Budget: 250 lines.**
> **Status: four sessions. Greg answered the open questions on 11 Nov — the answers are under "Open
> questions for Greg". Building is on PROJ-178 and PROJ-179; the level above is session 4.**

Greg's lead architect said the UI/UX "isn't very good". Nothing more specific was passed on, so
this is a full pass rather than a response to a named complaint. No code was changed.

**Greg's answers, 10 Nov (same evening):** players are on **desktop**, no shared screen, and they
join by **link**. The architect "was thinking of a cool way to show the questions". So the subject
is **the question screen on a laptop**, and the phone findings below drop to the bottom.

**More from the architect, via Greg, later the same evening** (Greg's words): "his other idea was
improving answers also to bring it closer to the TV world we envisioned … It's simple thing like
fade in of the question and answer or having animations that take you between rounds. I think you
went with a whole wants to be a millionaire style. Might be with seeing how uses small game like
polish." *My reading, not his words:* the complaint is **motion and transitions**, not layout —
how a question and its answers arrive, and how one round hands over to the next — and the last
sentence asks for a look at how games use small touches of polish. **This review has not seen the
app move at all**, and the repo already has entry animations, an options hold and the 21 Oct
game-show moments (#100), so what exists must be watched before anything is proposed: he may be
describing something missing, or something there but too quiet to notice. That makes step 2 of
"Next session starts here" the main subject, with a short look at game polish added to it.

**Read so far, in one line (session 2):** the foundations are sound. **Picture questions do lose
their last answer under the desk in a real room** at ordinary laptop sizes, Sleeves worst. **Motion
exists at every step but is short, small and surrounded by hard cuts**, so on film the game reads as
a slideshow with a flicker; the final is the one properly staged screen. No code was changed.

**Session 3 adds:** the lead-in the architect is describing costs **2–3 days and no rules change**
([`question-lead-in.md`](question-lead-in.md)); a question arrives with no sound and an entrance
nine-tenths over in a third of a second; joining by link takes nine key presses where one would do;
and the reveal never tells a screen reader which answer was right. Still no code changed.

## Picture questions in a real room — session 2

A throwaway e2e spec played real rooms on the local emulators (headless Chrome, two seats) and read
the bottom of the last answer tile against the top of the sticky desk (`.transport`), question open,
page not scrolled. Pixels under the desk; a tile is 99px.

| Viewport | Seat | On the box | Flags | Sleeves | Text |
|---|---|---|---|---|---|
| 1280×600 | quizmaster | **172** | **155** | **269** | — |
| 1280×720 | player | **43** | 4 | **141** | — |
| 1280×720 | quizmaster | **35–53** (ten questions) | **35** | **140–149** | fits |
| 1366×768 | player | fits (22–40 clear) | fits | **67–76** | fits |
| 1366×768 | quizmaster | **30** | fits | **126** | — |
| 1536×730 | player | 17 | fits (by 1) | **115** | — |
| 1440×900 | quizmaster | fits | fits | fits (by 14) | — |
| 1536×864 | player | fits | fits | fits (by 8) | — |

- **Sleeves is the bad one**: option D is wholly hidden for everyone at 768 tall or less, and the
  sleeve itself runs under the desk. Its "Hear it again" row and iTunes credit sit above the picture
  and push the answers down 97px (first tile at 305 against 208).
- **The quizmaster has it worse than the players.** Their desk is 111px (On air, Reveal); a player's
  is 82px while the question is open and 114px at the reveal.
- **Viewport is not screen.** 1536×730 is my estimate of maximised Chrome on a 1080p laptop at 125%
  scaling; 1280×600 of one at 150%. **Neither was measured on a real machine**, and nobody knows
  what the office has (open question 3).
- The page scrolls and A–D answer by key, so this costs reading time on a 10-second clock rather
  than the ability to answer. **Not known to have cost anyone an answer.**
- **Correction to session 1:** its gallery figures (126–165 under at 1280×720) were right for
  Sleeves and about 90px too high for On the box and Flags. The gallery's own label was the excess.

## How the game moves — filmed, session 2

Playwright `recordVideo`, one whole On the box round, from a player's seat (1366×768) and the
quizmaster's (1280×720); the player's film cut into contact sheets at 6–8 frames a second and read
frame by frame. Durations below are from the stylesheet and the engine, checked against the film.

| Moment | What the film shows |
|---|---|
| Lobby → opening titles | Hard cut. One line fades in top-left; four-fifths of the stage is empty and stays still until the quizmaster presses |
| Titles → question one | Hard cut. Header, picture, ladder and desk are there in the first frame; the prompt lifts 14px over 420ms and the four tiles rise 28px over 380ms, 70ms apart. All over in 0.6s |
| Locking in | The tile turns amber, your lamp fills, "Locked in" in 16px capitals in the desk. The option text re-wraps as the key hint leaves, nudging the tiles below it (seen once, not measured) |
| The last three seconds | The 80px ring turns red and pulses 7%. Nothing else on screen changes |
| The reveal | The clock leaves the header and **everything jumps up 58px in one frame** (prompt 146 → 88, measured). Names land on the tiles in the order they answered (0.7–1.8s), then the right tile goes green and the wrong ones fade until they cannot be read. "+1,000" pops **on top of the right answer's text**. Your verdict is 16px capitals, bottom-left, the width of the screen from the answer (session 1 called the desk line 11.5px; `.tally` is `--text-md`) |
| Reveal → standings | Hard cut. A title card ("Question two · On the box") fades in, scores count up, ▲▼ and "New leader" stamp. A 700ms band of light crosses at 14–30% — on film, one or two frames in twelve |
| Standings → next question | Hard cut, then the same 0.6s entrance |
| The final | 4.4s build: risers, drum roll, winner, confetti, then the table. **The one staged screen** |
| Final → lobby | Hard cut and the light band; name plates drop in |

**Against what the architect asked for:**

1. *"Fade in of the question and answer"* — **it exists and is too quiet to see.** Two elements move
   a few pixels for under half a second while everything else, the picture included, cuts in.
2. *"Animations that take you between rounds"* — **mostly missing.** Every screen change is a cut.
   The title card between questions is real but lives on the standings screen, and the light band
   is faint by design.
3. *"A whole Millionaire style"* — **accurate.** Four lettered lecterns, a ladder down the right,
   a dark blue studio with beams. The look was built; the small movements a game adds were not.

**Why it is like this — decided earlier, and each one binds a fix:**

- **A question's thinking time starts when it opens**, stamped by the server, so anything laid over
  the question is taken out of the answer window (`ColdOpen.tsx`; hence titles in the lobby and the
  round card on the standings).
- **"Nothing over the question or the reveal"** — the wipe skips both
  ([`game-show-moments.md`](game-show-moments.md#the-rules-it-kept)).
- **Transform and opacity only**; `backwards` not `both` on anything that later changes state
  ([`lighting.md`](lighting.md), [`gotchas.md`](gotchas.md)).
- **Turned down 28 Aug:** a verdict wash at the reveal, and the rig tightening in the last seconds
  ("one cue too many"). Proposals 5 and 6 below reopen those, so they are Greg's call.

**How games do it** — a thin look, two searches on 10 Nov (Kahoot, Jackbox, "Juice it or lose it"),
none of the pages opened: moved verbatim to [the evidence file](ui-ux-review-evidence.md#how-games-do-it).

**Proposals — none chosen, none built. S is hours, M a day or two, L touches the rules.**

1. **Fix the overflow (S–M).** Cap the picture by the window's height, and on Sleeves move "Hear it
   again" beside the picture. Or go to session 1's idea 1: picture as hero, four options in a row.
2. **Stop the 58px jump (S).** Keep the header's height when the clock leaves, or put the verdict
   where the clock was. The most visible fault on the film and the cheapest.
3. **An entrance you can see (S).** Picture first, then prompt, then tiles 120ms apart, about 0.9s
   in all. Costs each player about 0.3s of reading against today.
4. **A real lead-in (L) — the keystone.** "Question two" → picture → prompt → options, 1.5–2s, and
   *then* the clock starts. It is the fade-in and the between-questions transition in one. It moves
   when the window opens, so it touches `openedAt`, the reveal gate and the `elapsedMs` bound
   ([`shared-clock.md`](shared-clock.md), [`answer-window.md`](answer-window.md) — **not read this
   session**). The Catchphrase options hold (`optionsHold.ts`) is a precedent.
   **Correction, 11 Nov: M, not L.** Read in session 3: built as that same kind of hold it touches
   none of the three. [`question-lead-in.md`](question-lead-in.md).
5. **A reveal you can read (S).** Points beside the tile, not over its text; wrong options to about
   half strength; the verdict large and near the answers.
6. **A clock you feel (S).** The header's lower edge drains as a bar (`scaleX`, compositor only) and
   turns red with the ring.

Session 1's four ideas map onto these: picture as hero → 1; question centre stage → 3 and 4; a clock
you feel → 6; a held reveal → 5.

## Session 4 — the level above the screens (11 November)

Greg wanted more than a screen audit. [`ui-ux-review-the-show.md`](ui-ux-review-the-show.md) reads
79 real rounds from `games/`: under half a round is play, one person hosts three-quarters of them,
one regular wins 60% of theirs, and nobody plays on a phone. Eight findings, eight questions.

## Session 3 — flows, keyboard, a big screen, sound (11 November)

A second throwaway spec played a three-seat On the box round on the local emulators at 1920×1080,
by keyboard where it says so. Method and its mistakes: [`ui-ux-review-evidence.md`](ui-ux-review-evidence.md#session-3--11-november).

**Proposal 4 is M, not L.** A lead-in can be a hold on the shared clock, as Catchphrase's options
already are: no rules change, 2–3 days. Costed in [`question-lead-in.md`](question-lead-in.md).

### The flows

| Flow | What it takes | What gets in the way |
|---|---|---|
| Join link → seated, a browser that has never played | Mouse: click the name box, type, click Join. Keyboard: 3 Tabs, the name, 5 Tabs, Enter | **Nothing is focused on arrival**, though the page says "Now put your name in the box above". **Enter in the name box does nothing** (`Landing.tsx` has no `<form`, `onSubmit` or `autoFocus`; grep). "Run the show" stays on screen, left of Join, for somebody who came to join |
| Landing → question one, the quizmaster | Name, Start a new room, a pack, Start the show, Start the round: four clicks | The lobby is 3,639px tall at 1080p (3.4 screens) and 56 Tab stops. "Choose a set" starts about 845px down, under the code, the link, What's new, squad and sound check. Start is sticky |
| Seated → first answer | A–D then Enter, or two clicks | **If focus is on a button, Enter presses that button, not the lock.** In the first run it muted the sound and the pick stood "not locked" (it still scored, as on the buzzer) |
| Final → next round | Another round, a pack, Start the show, Start the round: four clicks | Settings are kept and the pack is not, by design (`Lobby.tsx:168`). "Another round" is the last of five Tab stops, after Leave. The final is 1,575px at 1080p |

### On a 1920×1080 screen

- **The stage is a fixed 1,120px column, 58% of the width, and nothing in it grows.** The picture is
  614×345, a tenth of the screen. The prompt is 48px, the answers 20px, and 43 of the 63 pieces of
  text on the question are 12.8px or smaller.
- **About 200px is empty between the last answer and the desk.** The layout that loses answer D on a
  768-tall laptop has room to spare here: it is sized for neither.
- The standings card reads **"Question Two" above "After 1 of 10"** — the next question's title over
  the last one's result. After question one, both players on nought are marked "▼1".

### Keyboard and screen reader — the tree read, nothing listened to

- Focus is visible on every stop measured: a 2px outline on buttons, a ring on fields.
- **The reveal never says which answer was right.** The tiles read "Home Alone Picked by Ann",
  "Mrs. Doubtfire Picked by Host"; the right one is marked by colour (`tile--correct`,
  `PodiumTile.tsx:152`). The only words are your own verdict.
- **"Locked in" is not announced**: the desk line is not a live region (`QuestionScreen.tsx` has
  four, at 703, 813, 964 and 1026; none is `.tally`). Only the timer is live while a question is open.
- A tile's name leaves out its letter, so nothing tells a screen-reader user the A–D keys exist.
- Sound and volume are the first two Tab stops on every screen.

### Also measured — the detail is in the evidence file

- **The entrance is nine-tenths done in a third of a second.** Prompt 90% visible at 165ms; the last
  answer hidden until 216ms and at rest by 566ms; the picture has no entrance at all. Reduced motion
  works. [Frame by frame](ui-ux-review-evidence.md#the-entrance-frame-by-frame).
- **A question arrives in silence.** Titles and screen changes are silent too; every other beat has
  a cue. [The cue map](ui-ux-review-evidence.md#sound--read-in-the-code-not-heard).
- **Fastest finger can name one player five times** (`awards.ts:79`). Reported, not fixed.
  [Errors and the bug](ui-ux-review-evidence.md#errors-and-a-bug-found-in-passing).
- **A height tier and an unlinked design system already exist.**
  [What the design docs bind](ui-ux-review-evidence.md#what-the-design-docs-bind).

## Everything, ranked, with a cost

S is hours, M a day or more. First by what answers the architect, then by what a player meets.

| # | What | Cost | Answers |
|---|---|---|---|
| 1 | Stop the 58px jump at the reveal (proposal 2) | S | The most visible fault on film |
| 2 | A reveal you can read: points beside the tile, wrong answers at half strength, the verdict by the answers, and the right answer in words (proposal 5) | S | Reveal; screen reader |
| 3 | An entrance you can see: picture, prompt, answers in turn (proposal 3) | S | "Fade in of the question and answer" |
| 4 | The lead-in, with one cue as the question arrives (proposal 4) | M, 2–3 days | "Animations that take you between rounds" |
| 5 | A height tier so answer D is on screen at 768 and below (proposal 1) | S–M | The overflow table above |
| 6 | Join by link: focus the name, Enter joins, no "Run the show" | S | Every player's first ten seconds |
| 7 | Standings card wording; no ▼ after question one; fastest-finger names | S | Small wrong notes |
| 8 | Let the stage grow on a wide screen | M | 1080p; needs open question 3 first |
| 9 | Lobby: packs before preamble, settings folded | M | The quizmaster only |
| 10 | Type floor and colour tokens | M | Waits on the design system |
| 11 | Phone findings 1, 4, 6, 7 ([evidence](ui-ux-review-evidence.md#findings-ranked)) | S–M | Nobody plays on a phone today |

**Recommended first PR: 1, 2 and 3 together** — one screen, about a day, no rules, filmed before and
after. Then 4.

## Measurement, the phone pass and what is sound

Moved verbatim to [`ui-ux-review-evidence.md`](ui-ux-review-evidence.md) on 11 Nov: how sessions 1
and 2 were measured and where the instrument lied; the session-1 findings table; what was verified
sound (contrast, names, live regions, tokens); and three directions for the phone and lobby.

## Open questions for Greg

**Answered 11 Nov** (Greg): 1 yes → PROJ-178. 2 "add in and build" → PROJ-179; length, Catchphrase
and tunes taken from the doc's recommendations. 3 → the worry is right and the carrier was wrong:
the question-one trace, not the error beacon, PROJ-180. 4 "go blind": build without showing him
first. 5 → branch `PROJ-177-ui-ux-review`, PROJ-177. 6 and 7 not answered. Fastest finger → PROJ-181.

1. **Build the first PR (rows 1–3)?** It needs a PROJ ticket and a branch off `master`.
2. **The lead-in**: five decisions in [`question-lead-in.md`](question-lead-in.md#decisions--all-gregs).
3. What window do players really have? Nobody has measured it; the error beacon could report it.
4. Does the architect see the films and this ranking before anything is built?
5. These three files are still untracked on `release-2026-11-10`. Which branch and ticket?
6. Proposal 6 (a clock you feel) and the verdict wash reopen 28 Aug decisions. Reopen them?
7. The design system: `/design-login`, or the project's link.

## Next session starts here

The review is done as a review. **Nothing was built, no ticket raised, nothing committed.** Do not
re-run the measurements: films and sheets are in `.cache/ux-film/`, session 3 in `.cache/ux-film/s3/`.

1. Greg's answers above decide everything below.
2. If row 1–3 go ahead: story and acceptance criteria first, gallery fixtures, then film before and
   after with the camera and put the sheets side by side.
3. If the lead-in goes ahead: the draft story in `question-lead-in.md` needs Greg's approval first.

**Still not done:** nothing was listened to (sound is read from code); no screen reader was run;
Sleeves, tunes, Catchphrase and Share or Shaft were not walked in session 3; no real office machine
was measured; no phone; the copy pass covered error messages only; `QuestionScreen.tsx` is read in
parts (lines 360–470 and 700–1155).
