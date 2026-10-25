import { describe, expect, test } from 'vitest';
import type { ThemeSpec } from './hand-themes-data';
import { buildThemesPack, pickThemeRecording, themeSearchUrl } from './write-themes-pack';

/*
  Synthetic programmes and artists only: Theme Tunes is blind, and a fixture
  copied from the pack would put a programme into the repo's test names.
*/
const SPEC: ThemeSpec = {
  slug: 'theme-999',
  correct: 'The Zorbling Hour',
  incorrect: ['Quexley Lane', 'Plimsoll Court', 'Vantry Road'],
  difficulty: 'easy',
  artist: 'Ada Fenwick',
  track: 'Zorbling March',
};

const PREVIEW = 'https://audio-ssl.itunes.apple.com/itunes-assets/x/mzaf_1.plus.aac.p.m4a';
const STORE = 'https://music.apple.com/gb/album/zorbling-march/123?i=456';

function song(over: Record<string, unknown>): Record<string, unknown> {
  return {
    kind: 'song',
    trackId: 1,
    trackName: 'Zorbling March',
    artistName: 'Ada Fenwick',
    previewUrl: PREVIEW,
    trackViewUrl: STORE,
    ...over,
  };
}

describe('pickThemeRecording', () => {
  test('takes the credited artist’s recording of the theme', () => {
    const got = pickThemeRecording({ results: [song({ trackId: 7 })] }, SPEC);
    expect(got).toEqual({ trackId: 7, previewUrl: PREVIEW, storeUrl: STORE });
  });

  test('a recording titled as the programme counts as well', () => {
    const got = pickThemeRecording({ results: [song({ trackId: 8, trackName: 'Theme from The Zorbling Hour' })] }, SPEC);
    expect(got?.trackId).toBe(8);
  });

  test('never falls back to another theme by the same composer', () => {
    // The failure this writer exists to refuse: a composer's top hit is
    // usually a different programme's theme, which is the wrong answer.
    const got = pickThemeRecording({ results: [song({ trackName: 'Quexley Lane' })] }, SPEC);
    expect(got).toBeNull();
  });

  test('refuses a soundalike by somebody else, and a karaoke version by anyone', () => {
    expect(pickThemeRecording({ results: [song({ artistName: 'The TV Theme Players' })] }, SPEC)).toBeNull();
    expect(
      pickThemeRecording({ results: [song({ trackName: 'Zorbling March (Karaoke Version)' })] }, SPEC),
    ).toBeNull();
  });

  test('an exact artist credit beats a partial one', () => {
    const got = pickThemeRecording(
      {
        results: [
          song({ trackId: 1, artistName: 'Ada Fenwick and Her Orchestra' }),
          song({ trackId: 2 }),
        ],
      },
      SPEC,
    );
    expect(got?.trackId).toBe(2);
  });

  test('refuses a preview that is not on Apple’s audio CDN', () => {
    expect(pickThemeRecording({ results: [song({ previewUrl: 'https://example.com/a.m4a' })] }, SPEC)).toBeNull();
  });
});

describe('themeSearchUrl', () => {
  test('is the GB search the coverage measurement used, so the cache answers it', () => {
    const url = new URL(themeSearchUrl(SPEC));
    expect(url.searchParams.get('country')).toBe('gb');
    expect(url.searchParams.get('limit')).toBe('25');
    expect(url.searchParams.get('term')).toBe('Zorbling March Ada Fenwick');
    expect([...url.searchParams.keys()]).toEqual(['country', 'limit', 'term', 'entity', 'media']);
  });
});

describe('buildThemesPack', () => {
  test('refuses to build below three rounds, naming slugs only', async () => {
    await expect(buildThemesPack(async () => ({ results: [] }))).rejects.toThrow(/^Only 0 themes resolved \(need 45\)\. Skipped: theme-\d{3}/);
  });
});
