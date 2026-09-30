# Sound check in the lobby

> **Owner: Greg Rothwell. Last updated: 30 September 2026. Budget: 250 lines.**

**Status: option A chosen by Greg, 30 September 2026. Built on
`music-rounds-start-at-once`; not merged, not deployed.**

## Why

Somebody in the office asked for an audio check "instead of the first
question": the first question of a music round is where people find out their
level is wrong, or that they cannot hear anything at all. `CUC4` showed the
second one in the data — answers per question ran 7, 8, 9 as people found the
button one at a time ([`audio-stack.md`](audio-stack.md)).

Two shapes were offered. **A:** a button in the lobby that plays a short clip on
each person's own device, beside a volume slider. **B:** a synced, unscored
check in place of question one — a new room phase, which means a rules paste.
Greg chose A.

## Story

> As a player waiting in the lobby, I want to hear a few seconds of music at the
> level a music round will play at, so that I can set my volume before the first
> question rather than losing that question to it.

## Acceptance criteria

1. **Every player in the lobby sees it**, quizmaster or not, whatever pack is
   picked — players cannot see the pick until the round starts.
2. **It plays through `playPreview`**, the path Name that Tune and Sleeves use:
   an `<audio>` element at `el.volume`. So the level heard is the level the
   round plays at, and the press is the gesture that unlocks media elements for
   the page — the gate a link auto-join never opens (`audio-stack.md`).
3. **Ten seconds**, the length of a Name that Tune question, then it stops.
   Pressing again restarts it rather than stacking a second copy.
4. **A muted player who presses it is unmuted first.** A button that does
   nothing is worse than no button — the replay's rule.
5. **A volume slider sits beside it**, the same control as the one in the
   corner and bound to the same level, so moving either moves both.
6. **Leaving the lobby stops it**, so a clip never runs into question one.
   Nothing is stopped if the check was never pressed.
7. **The clip is not a question.** Its preview is in no pack, and its title is
   no Name that Tune option, so the lobby can never play an answer.
8. It carries "Provided courtesy of iTunes", as a question with a preview does.
9. **Nothing in Firebase.** No room field, no phase, no rules paste.

## The clip

*Shut Up and Dance*, WALK THE MOON (`trackId` 1473891823): a guitar riff from
the first bar and a modern master, so it sits at the loudness most previews
do. Checked absent from every pack on 30 September 2026. A swap is one
constant in `src/lib/soundCheck.ts`; the test in item 7 guards the new one.

## As built

`src/components/SoundCheck.tsx`, rendered in the lobby's first section under the
squad picker. The corner slider's range input moved into
`src/components/VolumeSlider.tsx` so both places are one control. Lobby copy:
"Ten seconds at the level a music round plays at. Set it so you can still hear
the call over it."

## Evidence, 30 September 2026

- **Offline.** 11 new tests; `npm test` 1,170 passed, `typecheck` and `lint`
  clean. **Each test was seen failing** under a mutation: no unmute, stop on
  every unmount, stop on none, and a clip taken from `tunes.json`.
- **Built bundle, `index-frzpKPeW`**, checked against the build output before
  anything was read, in the design gallery (`#/preview`). `play()` was wrapped
  to record elements, and **the wrapper was checked on a known `Audio` first**.
  - A real click played the preview from 0s at the stored level (0.316).
  - The lobby slider moved to 50 at 2.9s into the clip took the playing element
    to 0.1 live, and the corner slider with it.
  - The clip stopped at 9.999s of its own time.
  - The panel shows in both gallery lobbies, quizmaster and link-joiner. At
    375px it wraps under the button with no horizontal scroll.

## Not covered

- **The autoplay unlock itself.** The automation browser grants user activation
  already, so a refused first question cannot be reproduced there — the same
  limit `audio-stack.md` records. That the press unlocks media is the browser's
  documented behaviour, not something measured here.
- **Not played in a live room.** Nothing in it touches Firebase, which is why a
  gallery check stands in; the first real lobby is the test of whether people
  use it.
- **Safari**, as for the rest of the audio stack.
