import { describe, expect, test } from 'vitest';
import { SONG_CLUE_SHARE, songClueAtMs, songClueDue } from './songClue';

const PREVIEW = 'https://audio-ssl.itunes.apple.com/itunes-assets/x.m4a';
const ART = 'https://is1-ssl.mzstatic.com/image/thumb/x/600x600bb.jpg';

describe('songClueAtMs', () => {
  test('a tune plays from the start, because the song is the question', () => {
    // #given Name that Tune — a preview and no picture
    // #then no hold at any window. Anything else would change a round that
    // already works.
    for (const window of [10_000, 15_000, 20_000]) {
      expect(songClueAtMs({ previewUrl: PREVIEW }, window)).toBe(0);
    }
  });

  test('a sleeve with a song plays it from the start too', () => {
    // #given the cover is the question and the song is the clue
    const sleeve = { previewUrl: PREVIEW, artworkUrl: ART };

    // #then no hold at any window a quizmaster can pick. Greg, 30 September
    // 2026: in `XDUF` three answers in four were in before a half-clock song
    // had started, so the clue helped almost nobody.
    for (const window of [10_000, 15_000, 20_000]) {
      expect(songClueAtMs(sleeve, window)).toBe(0);
    }
    expect(SONG_CLUE_SHARE).toBe(0);
  });

  test('the dial still holds a sleeve back if it is turned up again', () => {
    // #given the share this shipped with on 29 September
    const sleeve = { previewUrl: PREVIEW, artworkUrl: ART };

    // #then the cover plays alone for that share of each window
    expect(songClueAtMs(sleeve, 10_000, 0.5)).toBe(5_000);
    expect(songClueAtMs(sleeve, 15_000, 0.5)).toBe(7_500);
    expect(songClueAtMs(sleeve, 20_000, 0.5)).toBe(10_000);
  });

  test('a hashed still with a song is held back the same way', () => {
    // #given the rule is "a picture and a song", not "the Sleeves pack", so a
    // later picture pack with audio behaves the same without a second rule
    expect(songClueAtMs({ previewUrl: PREVIEW, image: 'abc.jpg' }, 10_000, 0.5)).toBe(5_000);
  });

  test('a tune is never held, whatever the dial says', () => {
    expect(songClueAtMs({ previewUrl: PREVIEW }, 10_000, 0.5)).toBe(0);
  });

  test('a question with no song has nothing to hold', () => {
    // #given a sleeve with no usable song, or any text question
    // #then no clue at all, which the caller reads as "never plays"
    expect(songClueAtMs({ artworkUrl: ART }, 10_000)).toBeNull();
    expect(songClueAtMs({}, 10_000)).toBeNull();
  });
});

describe('songClueDue', () => {
  test('is due at the clue and after it, never before', () => {
    // #given a sleeve on a 10s clock, whose clue lands at 5s
    // #then one tick early is still the cover alone
    expect(songClueDue(4_999, 5_000)).toBe(false);
    expect(songClueDue(5_000, 5_000)).toBe(true);
    expect(songClueDue(9_000, 5_000)).toBe(true);
  });

  test('a tune is due at once', () => {
    expect(songClueDue(0, 0)).toBe(true);
  });

  test('no song is never due', () => {
    expect(songClueDue(20_000, null)).toBe(false);
  });
});
