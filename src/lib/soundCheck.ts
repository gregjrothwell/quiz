/**
 * What the lobby's sound check plays.
 *
 * A real Apple preview rather than a synth line, because the level being set
 * is the level a Name that Tune or Sleeves clip plays at — an `<audio>` element
 * at `el.volume`, which the synth's master gain never reaches. And the press
 * that starts it is the gesture that lets the page play media at all.
 *
 * Not a question in any pack, and never an option in Name that Tune:
 * `soundCheck.test.ts` checks both against the published packs, so a harvest
 * that adds this song fails the suite rather than playing an answer in the
 * lobby. Greg, 30 September 2026. See docs/decisions/sound-check.md.
 */
export const SOUND_CHECK = {
  title: 'Shut Up and Dance',
  artist: 'WALK THE MOON',
  trackId: 1473891823,
  previewUrl:
    'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/96/11/5e/96115e9d-fb35-676d-7c92-a31b0259ece8/mzaf_11767367275586827851.plus.aac.p.m4a',
} as const;

/** As long as a Name that Tune question, which is always ten seconds. */
export const SOUND_CHECK_SECONDS = 10;
