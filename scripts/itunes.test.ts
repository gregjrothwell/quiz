import { describe, expect, test } from 'vitest';
import { resolveAlbum, resolveScreen, resolveSong, titleMatches, type ItunesGet } from './itunes';
import { anonymiseStoreUrl } from '../src/lib/apple-media';
import { buildScreensPack } from './write-screens-pack';
import { buildSleevesPack } from './write-sleeves-pack';
import { buildTunesPack } from './write-tunes-pack';
import { SCREEN_SPECS } from './hand-screens-data';
import { SLEEVE_SPECS } from './hand-sleeves-data';
import { TUNE_SPECS } from './hand-tunes-data';

const PREVIEW = 'https://audio-ssl.itunes.apple.com/itunes-assets/x.m4a';
const ART = 'https://is1-ssl.mzstatic.com/image/thumb/Music/v4/aa/source/100x100bb.jpg';

const get: ItunesGet = async (url) => {
  const parsed = new URL(url);
  if (parsed.pathname.endsWith('/lookup')) {
    const id = Number(parsed.searchParams.get('id'));
    const spec = SLEEVE_SPECS.find((row) => row.collectionId === id);
    if (!spec) throw new Error(`unexpected lookup ${id}`);
    return {
      results: [
        {
          wrapperType: 'collection',
          collectionId: id,
          collectionName: spec.correct,
          artistName: spec.artist,
          collectionViewUrl: `https://music.apple.com/gb/album/${spec.slug}/${id}`,
          artworkUrl100: ART,
        },
      ],
    };
  }
  const term = parsed.searchParams.get('term') ?? '';
  const entity = parsed.searchParams.get('entity');
  if (entity === 'song') {
    const spec = TUNE_SPECS.find((row) => row.term === term);
    if (!spec) throw new Error(`unexpected song term ${term}`);
    return {
      results: [
        {
          kind: 'song',
          trackId: 1440717826,
          trackName: spec.correct,
          artistName: spec.artist,
          previewUrl: PREVIEW,
          trackViewUrl: `https://music.apple.com/gb/album/${spec.slug}/1440717563?i=1440717826`,
        },
      ],
    };
  }
  if (entity === 'album') {
    const spec = SLEEVE_SPECS.find((row) => row.term === term);
    if (spec) {
      const collectionId = 1000 + SLEEVE_SPECS.indexOf(spec);
      return {
        results: [
          {
            wrapperType: 'collection',
            collectionId,
            collectionName: spec.correct,
            artistName: spec.artist,
            collectionViewUrl: `https://music.apple.com/gb/album/${spec.slug}/${collectionId}`,
            artworkUrl100: ART,
          },
        ],
      };
    }
    return {
      results: [
        {
          wrapperType: 'collection',
          collectionId: 10,
          collectionName: 'Hot Fuss',
          artistName: 'The Killers',
          collectionViewUrl: 'https://music.apple.com/gb/album/hot-fuss/10',
          artworkUrl100: ART,
        },
      ],
    };
  }
  if (entity === 'tvSeason') {
    const spec = SCREEN_SPECS.find((row) => row.term === term && row.kind === 'tvSeason');
    if (!spec) throw new Error(`unexpected tv term ${term}`);
    const collectionId = 3000 + SCREEN_SPECS.indexOf(spec);
    return {
      results: [
        {
          collectionId,
          collectionName: spec.correct,
          collectionViewUrl: `https://music.apple.com/gb/tv-season/${spec.slug}/${collectionId}`,
          artworkUrl100: ART,
        },
      ],
    };
  }
    const spec = SCREEN_SPECS.find((row) => row.term === term && row.kind === 'movie');
    if (spec) {
      const trackId = 2000 + SCREEN_SPECS.indexOf(spec);
      return {
        results: [
          {
            trackId,
            trackName: spec.correct,
            trackViewUrl: `https://music.apple.com/gb/movie/${spec.slug}/${trackId}`,
            artworkUrl100: ART,
          },
        ],
      };
    }
  return {
    results: [
      {
        trackId: 20,
        trackName: 'Inception',
        trackViewUrl: 'https://music.apple.com/gb/movie/inception/20',
        artworkUrl100: ART,
      },
    ],
  };
};

describe('resolveSong', () => {
  test('picks a GB preview whose artist matches', async () => {
    const song = await resolveSong('mr brightside killers', 'The Killers', get);
    expect(song.previewUrl).toBe(PREVIEW);
    expect(song.trackId).toBe(1440717826);
  });
});

describe('titleMatches', () => {
  test('accepts a remaster suffix and refuses a different album', () => {
    expect(titleMatches('The Wall (2011 Remastered)', 'The Wall')).toBe(true);
    expect(titleMatches('The Dark Side of the Moon', 'The Wall')).toBe(false);
    expect(titleMatches('Dark Side of the Moon', 'The Dark Side of the Moon')).toBe(true);
    expect(titleMatches('AM', 'Whatever People Say I Am, That’s What I’m Not')).toBe(false);
  });
});

describe('resolveAlbum', () => {
  test('upsizes artwork to 600px', async () => {
    const album = await resolveAlbum('hot fuss', 'The Killers', get);
    expect(album.artworkUrl).toContain('600x600bb');
  });
});

describe('resolveScreen', () => {
  test('returns movie artwork', async () => {
    const film = await resolveScreen('inception', 'movie', get);
    expect(film.name).toBe('Inception');
    expect(film.artworkUrl).toContain('mzstatic.com');
  });
});

describe('buildTunesPack', () => {
  test('seals previews and strips the store slug', async () => {
    const { pack, answers } = await buildTunesPack(get);
    expect(pack.questions.length).toBe(TUNE_SPECS.length);
    expect(Object.keys(answers)).toHaveLength(TUNE_SPECS.length);
    for (const question of pack.questions) {
      expect(question.previewUrl).toBe(PREVIEW);
      expect(question.storeUrl).toBe(
        anonymiseStoreUrl('https://music.apple.com/gb/album/x/1440717563?i=1440717826'),
      );
      expect(question.storeUrl).not.toMatch(/brightside|wonderwall|bohemian/i);
      expect('correct' in question).toBe(false);
    }
  });
});

describe('buildSleevesPack', () => {
  test('hotlinks mzstatic artwork and never hashes a cover filename', async () => {
    const { pack } = await buildSleevesPack(get);
    expect(pack.questions.length).toBe(SLEEVE_SPECS.length);
    for (const question of pack.questions) {
      expect(question.artworkUrl).toContain('600x600bb');
      expect(question.image).toBeUndefined();
      expect(question.storeUrl).toMatch(/^https:\/\/music\.apple\.com\/gb\/album\/\d+$/);
      expect('correct' in question).toBe(false);
    }
    const ids = pack.questions.map((question) => question.trackId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('buildScreensPack', () => {
  test('crops posters and hotlinks artwork', async () => {
    const { pack } = await buildScreensPack(get);
    expect(pack.questions.length).toBe(SCREEN_SPECS.length);
    for (const question of pack.questions) {
      expect(question.posterCrop).toBe(true);
      expect(question.artworkUrl).toContain('mzstatic.com');
      expect(question.image).toBeUndefined();
      expect('correct' in question).toBe(false);
    }
  });
});
