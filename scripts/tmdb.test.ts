import { describe, expect, test } from 'vitest';
import { pickUntitledBackdrop, pickUntitledPoster, resolveUntitledBackdrop, titleFits, tmdbBackdropUrl, tmdbCacheKey, yearFits, type TmdbGet } from './tmdb';
import { buildScreensPack } from './write-screens-pack';
import { SCREEN_SPECS } from './hand-screens-data';

const UNTITLED = {
  file_path: '/deadbeef.jpg',
  iso_639_1: null,
  vote_average: 5.4,
  vote_count: 12,
  width: 1920,
  aspect_ratio: 1.777,
};

describe('pickUntitledBackdrop', () => {
  test('refuses titled keyart and prefers the most-voted untitled still', () => {
    const picked = pickUntitledBackdrop([
      { ...UNTITLED, file_path: '/titled.jpg', iso_639_1: 'en', vote_count: 99 },
      { ...UNTITLED, file_path: '/narrow.jpg', width: 400 },
      { ...UNTITLED, file_path: '/quiet.jpg', vote_count: 2 },
      { ...UNTITLED, file_path: '/loud.jpg', vote_count: 20 },
    ]);
    expect(picked.file_path).toBe('/loud.jpg');
  });

  test('throws when every backdrop is titled', () => {
    expect(() =>
      pickUntitledBackdrop([{ ...UNTITLED, iso_639_1: 'en' }]),
    ).toThrow(/untitled/);
  });
});

describe('pickUntitledPoster', () => {
  test('takes an untitled portrait when backdrops are titled', () => {
    const picked = pickUntitledPoster([
      { ...UNTITLED, file_path: '/wide.jpg', aspect_ratio: 1.777 },
      { ...UNTITLED, file_path: '/poster.jpg', aspect_ratio: 0.667, width: 1000, vote_count: 8 },
    ]);
    expect(picked.file_path).toBe('/poster.jpg');
  });
});

describe('tmdbCacheKey', () => {
  test('strips the API key', () => {
    const key = tmdbCacheKey(
      'https://api.themoviedb.org/3/search/movie?api_key=secret&query=Jaws&year=1975',
    );
    expect(key).not.toMatch(/secret|api_key/);
    expect(key).toContain('query=Jaws');
  });
});

describe('titleFits', () => {
  test('accepts the US Harry Potter title as the UK one', () => {
    expect(titleFits("Harry Potter and the Sorcerer's Stone", 'Harry Potter and the Philosopher’s Stone')).toBe(
      true,
    );
  });
});

describe('yearFits', () => {
  test('allows a US theatrical date one year off the premiere year', () => {
    expect(yearFits(1943, 1942)).toBe(true);
    expect(yearFits(1942, 1942)).toBe(true);
    expect(yearFits(1944, 1942)).toBe(false);
    expect(yearFits(null, 1942)).toBe(false);
  });
});

describe('tmdbBackdropUrl', () => {
  test('is on image.tmdb.org at w780', () => {
    expect(tmdbBackdropUrl('/x.jpg')).toBe('https://image.tmdb.org/t/p/w780/x.jpg');
  });
});

const get: TmdbGet = async (url) => {
  const parsed = new URL(url);
  if (parsed.pathname.endsWith('/search/movie') || parsed.pathname.endsWith('/search/tv')) {
    const query = parsed.searchParams.get('query') ?? '';
    const spec = SCREEN_SPECS.find((row) => row.query === query);
    if (!spec) throw new Error(`unexpected query ${query}`);
    const yearField = spec.kind === 'movie' ? 'release_date' : 'first_air_date';
    const nameField = spec.kind === 'movie' ? 'title' : 'name';
    return {
      results: [
        {
          id: 1000 + SCREEN_SPECS.indexOf(spec),
          [nameField]: spec.correct,
          [yearField]: `${spec.year}-06-01`,
          ...(spec.originCountry ? { origin_country: [spec.originCountry] } : {}),
        },
      ],
    };
  }
  if (parsed.pathname.includes('/images')) {
    return { backdrops: [UNTITLED] };
  }
  throw new Error(`unexpected ${parsed.pathname}`);
};

describe('resolveUntitledBackdrop', () => {
  test('returns a hashed-looking TMDB path, not a title slug', async () => {
    const jaws = SCREEN_SPECS.find((row) => row.slug === 'jaws');
    if (!jaws) throw new Error('missing jaws spec');
    const item = await resolveUntitledBackdrop(jaws, get);
    expect(item.imageUrl).toBe('https://image.tmdb.org/t/p/w780/deadbeef.jpg');
    expect(item.imageUrl).not.toMatch(/jaws/i);
    expect(item.posterCrop).toBeUndefined();
  });

  test('falls back to an untitled poster when every backdrop is titled', async () => {
    const jaws = SCREEN_SPECS.find((row) => row.slug === 'jaws');
    if (!jaws) throw new Error('missing jaws spec');
    const postersOnly: TmdbGet = async (url) => {
      const parsed = new URL(url);
      if (parsed.pathname.includes('/images')) {
        return {
          backdrops: [{ ...UNTITLED, iso_639_1: 'en' }],
          posters: [{ ...UNTITLED, file_path: '/poster.jpg', aspect_ratio: 0.667, width: 1000 }],
        };
      }
      return get(url);
    };
    const item = await resolveUntitledBackdrop(jaws, postersOnly);
    expect(item.imageUrl).toBe('https://image.tmdb.org/t/p/w780/poster.jpg');
    expect(item.posterCrop).toBe(true);
  });
});

describe('buildScreensPack', () => {
  test('seals hashed stills and never hotlinks TMDB', async () => {
    const { pack, answers } = await buildScreensPack({
      get,
      fetchImage: async () => ({ bytes: Buffer.from('fake-still'), contentType: 'image/jpeg' }),
      store: async () => 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg',
    });
    expect(pack.questions.length).toBe(SCREEN_SPECS.length);
    expect(Object.keys(answers)).toHaveLength(SCREEN_SPECS.length);
    const sealed = JSON.stringify(pack);
    expect(sealed).not.toMatch(/tmdb/i);
    expect(sealed).not.toMatch(/image\.tmdb\.org/);
    for (const question of pack.questions) {
      expect(question.image).toMatch(/^[a-f0-9]{64}\.jpg$/);
      expect(question.artworkUrl).toBeUndefined();
      expect(question.posterCrop).toBeUndefined();
      expect(question.storeUrl).toBeUndefined();
      expect(question.jigsaw).toBeUndefined();
      expect('correct' in question).toBe(false);
    }
  });

  test('refuses a pack thinner than three default rounds', async () => {
    await expect(
      buildScreensPack({
        get: async () => {
          throw new Error('no untitled backdrop');
        },
        fetchImage: async () => ({ bytes: Buffer.from('fake-still'), contentType: 'image/jpeg' }),
        store: async () => 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg',
      }),
    ).rejects.toThrow(/Only 0 screens resolved/);
  });
});
