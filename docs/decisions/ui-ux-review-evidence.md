# UI/UX review — how it was measured, and the phone pass

> **Owner: Greg Rothwell. Last updated: 11 November 2026. Budget: 250 lines.**
> Moved verbatim out of [`ui-ux-review.md`](ui-ux-review.md) on 11 November 2026, when session 3
> took that file past its 250 lines. The text below is unchanged; only where it lives is. Session
> 3's own method is at the foot.

## How it was measured

**Session 2 — the camera.** `.cache/ux-film/zz-ux-film.spec.ts` (kept out of git; copy it into
`e2e/` and `firebase.uxfilm.json` to the repo root to run, and remove both after) seats a quizmaster and a player, plays On the box to the final and question one of
Sleeves, Flags and General Knowledge, and writes sizes, screenshots and video to `.cache/ux-film/`.
The films are `player-seat-1366x768.webm` and `quizmaster-seat-1280x720.webm`; the contact sheets
are in `sheets/`.

- **Port 8080 is taken on this Mac** by a `llama-server` that had been up seven days, so the
  Firestore emulator cannot start and **`npm run e2e` cannot run locally as it stands**. The camera
  uses `firebase.uxfilm.json` (Firestore on 8085) and re-points the page's calls with
  `context.route`. Run: `npx firebase emulators:exec --config firebase.uxfilm.json --only
  auth,firestore,database --project quiz-d686e "npx playwright test e2e/zz-ux-film.spec.ts"`, with
  Java and the nvm bin on PATH, after `npm run build`.
- **Playwright empties `test-results/` at the start of every run.** The first film was lost that
  way and shot again; the numbers in the two takes agree.
- The emulator's vault marks option A right, so the green tile on film is not the real answer. A
  two-seat room leaves the final's stage empty for about 1.3s, which a real room would not.
- **Not filmed:** sound, the quizmaster's film (measured, not watched), Sleeves and tune rounds in
  motion, the Catchphrase hold, Share or Shaft, reduced motion, a phone.

**Session 1.** `#/preview` (the design gallery, 97 frames, fixed data, no Firebase) on the dev server, in the
desktop app's browser pane at 375×812, with a script over every text node and control. Single
frames at `#/preview/N` for layout positions; two frames at 1280×720.

**Instrument checks.** A probe of `#777` on `#fff` at 16px read back 4.48:1 (correct) and a 20px
button read back 20px, so the contrast and size readings are trusted.

**Where the instrument lied — nothing below rests on these:**

- **The pane did not advance entry animations.** Opacity read 0 on most frames, screenshots show
  half-faded screens, and the Final frame was blank after 3s. So motion, the reveal, the podium and
  how any screen looks at rest are **not judged**. Likely a hidden pane throttling animation frames;
  not confirmed.
- Text running past the right edge on Share or Shaft and the Final seats (398–399px of 375) came
  from that same stalled state and did **not** reproduce in the isolated frame. **Unverified.**
- A section's index in the full gallery is not its `#/preview/N` number (frames nest sections).
- `preview_start` cannot find `npm` (nvm is not on its PATH). Vite was run from the shell with
  `PATH="$HOME/.nvm/versions/node/v24.22.2/bin:$PATH"` and the pane pointed at the URL.

## Findings, ranked

**Ranked after session 2:** first the real-room overflow and the 58px jump at the reveal (both
above), then the quiet entrance and the cuts between screens. Of this table: 2 (the lobby), 3 (small
type) and 5 (colour drift). Findings 1, 4, 6 and 7 are phone or typed-code matters and go last; 1 is
the same sticky-desk fault as the laptop one, so a fix should cover both.

| # | Finding | Evidence | Status |
|---|---|---|---|
| 1 | **On a phone, the last answers can sit under the sticky bar.** `.transport` is sticky at the bottom and 147px tall, 18% of an 812px screen. Four tiles stack in one column (88px each). | Text question, frame 5: tiles end at 694, bar starts at 665. Flags, frame 9: tiles run 496–887, so C and D are below an 812px fold. | Measured in the gallery, which adds its own label above each screen (not measured). A real phone shows less than 812px. **Not checked in a real room.** `global.css:3538` has `scroll-margin-bottom: 45vh`, so some handling exists — read it first. |
| 2 | **The quizmaster's lobby is very long.** Ten settings groups stack under the pack list in one column. | 4,799px at 375 wide (5.9 screens), 2,505px at 1280×720 (3.5 screens), 39 controls. With every pack: 8.6 phone screens. `Lobby.tsx` eyebrows at lines 419–743. | Measured. A sticky Start bar exists on the phone, so Start is reachable. |
| 3 | **Type is small, and the smallest sizes are the most used.** | 740 of 3,527 text elements (21%) render at 11.5px (`--text-2xs`); 636 (18%) at 12.8px. In the CSS, `--text-2xs` is used 30 times and `--text-xs` 25, more than any other step. 45 `uppercase` rules, 17 letter-spacings. Player names on answer tiles, chips, roles, table headers and squad lines are all 11.5px. | Measured. Tracked capitals at 11.5px is the hardest combination to read. |
| 4 | **Two controls are small to tap.** | "Good one / Rubbish" (`lamp--vote`) 40×26px, 30 instances; Season filter chips 30px tall. | Measured. Passes WCAG 2.5.8 (24px); under the 44px guideline. |
| 5 | **Colour has drifted from the tokens.** | 59 distinct hex values and 16 rgba values written outside the `:root` block (72 and 26 uses). | Grep. The type scale was pulled in on 30 Oct (52 sizes to 17); colour was not. |
| 6 | Top chrome (arc, sound button, volume slider) takes the first band of every phone screen. | Screenshots; screen content starts at 133px in the gallery. | Observed, not measured in the app. |
| 7 | Landing order is Your name → Run the show → Join a room, 1.5 phone screens, so Join is below the fold. | `Landing.tsx:92,173,197`. | Observed. Matters only if people join by typed code rather than link — **not measured.** |
| 8 | "What's new" and "Leave" sit side by side at different text sizes; caps labels wrap to two lines ("Shown on the leaderboard — needed either way"). | Screenshots, frames 0 and 1. | Observed. |

## What is sound — verified

- **Contrast: no real AA failures** in 3,348 text elements. Three were flagged and all three are
  dark ink on a lit fill (tile letters, primary buttons), which the script reads against the page.
- No horizontal page scroll at 375px on any frame.
- Every control has an accessible name; 14 of 14 images have `alt`.
- Live regions exist (9 `aria-live="polite"`, 6 `role="status"`, 1 `role="timer"`).
- Reduced motion is handled in CSS (4 blocks) and in TS (`useReducedMotion`).
- Tokens exist: 67 root variables, a 17-step type scale, three named radii.

## Directions, not decisions

Nothing here is chosen; each needs the next session's pictures first.

1. Question on a phone: a 2×2 grid when all four options are short, a shorter bar during the
   question, or a capped picture height.
2. Lobby: last round's settings as the default, with the ten groups behind one "Round options"
   fold; packs as compact rows on a phone.
3. Type: a 12.8px floor, and sentence case for anything that is a sentence.

## Session 3 — 11 November

**Method.** `.cache/ux-film/zz-ux-flows.spec.ts` (kept out of git; run as the session-2 camera is,
above) seats a quizmaster and a player at 1920×1080 and a third seat at 1366×768 with
`reducedMotion: 'reduce'`, and plays On the box on the local emulators. It presses real Tab keys and
reads `document.activeElement`, its outline and its box shadow; reads each screen's accessibility
tree with Playwright's `ariaSnapshot`; measures boxes and counts text by size; and samples
`getComputedStyle` on the prompt, the last answer and the picture on every animation frame. Output:
`.cache/ux-film/s3/` — `flows.json`, `entrance.json`, `aria-*.yml` and 1920×1080 screenshots.
`dist/` was the 10 Nov 21:42 build of `release-2026-11-10`, whose last commit is 10 Nov 08:45.

**Where it went wrong, and what was done.**

- **The first run read the entrance 132ms in**, before it had finished. Re-run for two questions
  with a 1.6s wait; the table below is the second run. The two runs agree for the frames they share.
- **The first run's Tab walk left focus on the sound button**, so the Enter meant to lock an answer
  muted the sound instead. That is how the Enter finding was made; the second run cleared focus
  first, and "Tap it again, or press Enter, to lock it in" then "Locked in" read back as expected.
- **A Tab stop's name in `flows.json` is `textContent`**, which runs words together ("Plays
  sound.Random RoundA picture…"). The accessibility tree has the spaces; nothing rests on the former.
- In the reduced-motion seat the last answer rests at `translateY(-2px)`, not 0. **Not explained.**

**Not covered:** nothing was listened to; no screen reader was run; one pack; the emulator's vault
marks option A right; three seats; no real office machine.

### The entrance, frame by frame

`getComputedStyle` every frame from the standings into question two, in an ordinary seat and one
asking for reduced motion. It agrees with session 2's reading of the stylesheet (14px, 28px, 70ms
apart, 0.6s), which is the cross-check on the instrument.

| | Ordinary | Reduced motion |
|---|---|---|
| Picture | Fully there in the first frame | Same |
| Prompt | 90% visible at 165ms, at rest at 383ms | There in one frame |
| Last answer | Hidden until 216ms, 90% at 366ms, at rest at 566ms | Hidden until 216ms, then there at once |

So the "fade in of the question and answer" is nine-tenths done in a third of a second. Reduced
motion works: no movement, the same short hold.

### Sound — read in the code, not heard

| Moment | Cue |
|---|---|
| Somebody joins | `join`, quizmaster only |
| Opening titles | none |
| **A question arrives** | **none** (a tune round starts its tune) |
| Last 9 seconds | The clock bed — on a 10-second question, from one second in |
| You answer | `lock` |
| Reveal | `gong`, then `correct` or `wrong` |
| Standings | `sting` |
| Screen changes, the light band | none |
| Final | `roll`, `fanfare` |

A question's arrival is the one beat with almost no movement and no sound. `grep "useCue(\|play('"`.

### Errors, and a bug found in passing

- `npm run read-errors -- --since 30d`, 11 Nov: 8 rows in 3 groups. Seven are one room at the final
  on 28 Oct, 14:30, asking for a chunk the 14:23 deploy had deleted: fixed 29 Oct (`f71aaba`,
  PROJ-77). One notice was shown, and it carries the SDK's own words: "Answers stopped reaching this
  device (Missing or insufficient permissions.)" (`App.tsx:827`).
- **Fastest finger names one player once per question** — "Ann & Ann & Ann & Ann & Ann · In on the
  buzzer at 10.0 seconds". `fastest` pushes the uid again whenever a time equals the best so far
  (`awards.ts:79`), and every unlocked pick is stamped exactly the window. **Reported, not fixed.**

### What the design docs bind

- **A height-keyed tier already exists on the landing page** ([`gotchas.md`](gotchas.md), "short-viewport
  tier"), and must sit at the end of the stylesheet. That is the pattern for proposal 1.
- The round card is on the standings because over the question it would eat the answer window
  (`gotchas.md`). The lead-in answers that by adding its length to the window.
- **Greg has a design system in Claude Design that is not linked** ([`office-feedback-7-oct.md`](office-feedback-7-oct.md), §5):
  57 distinct hex colours outside `:root` on 7 Oct, 59 in session 1. Colour and type clean-up waits
  on it, and the next step is Greg's (`/design-login`).
- The lobby's length is its preamble and settings, not the pack shelves restyled on 20 Oct
  ([`lobby-shelves.md`](lobby-shelves.md)). `office-feedback-9-oct.md` holds nothing on the UI.


## How games do it

Moved verbatim from `ui-ux-review.md` on 11 November 2026.

**How games do it — a thin look, two searches, 10 Nov:**

- Kahoot shows the question alone before the answers; in Team mode it is 5s of question, then 5s
  with the answers before the timer starts. *From a search summary* of Kahoot's support forum
  (support.kahoot.com, posts 360028793713 and 115000985507); the pages were not opened, and the
  plain-mode timing is not verified.
- Jackbox "draws on the language of TV — narrative timing, transitions and dialogue". *From a search
  summary* of Built In's piece on its design principles (builtin.com), page not opened. No source
  found on how it times a reveal.
- "Juice it or lose it" (Jonasson and Purho, GDC Europe 2012): a plain game made to feel alive by
  layering small responses — easing, squash, particles, sound — on every action. *From search summaries*, talk
  not watched; **what follows from it for a quiz is my reading**: every press answers back, and
  nothing arrives or leaves without easing.
