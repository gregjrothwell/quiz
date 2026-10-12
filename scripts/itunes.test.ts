import { describe, expect, test } from 'vitest';
import { resolveAlbum, resolveSong, titleMatches, type ItunesGet } from './itunes';
import { anonymiseStoreUrl } from '../src/lib/apple-media';
import { buildSleevesPack } from './write-sleeves-pack';
import { buildTunesPack } from './write-tunes-pack';
import { SLEEVE_SPECS } from './hand-sleeves-data';
import { SLEEVE_COVER_TEXT } from './sleeve-cover-text';
import { sleeveVerdict } from './title-on-cover';
import { SLEEVE_HAND_REFUSALS } from './sleeve-refusals';
import { TUNE_SPECS } from './hand-tunes-data';
import { stableId } from './write-hand-packs';

const PREVIEW = 'https://audio-ssl.itunes.apple.com/itunes-assets/x.m4a';
const ART = 'https://is1-ssl.mzstatic.com/image/thumb/Music/v4/aa/source/100x100bb.jpg';

const get: ItunesGet = async (url) => {
  const parsed = new URL(url);
  if (parsed.pathname.endsWith('/lookup')) {
    const id = Number(parsed.searchParams.get('id'));
    // A hand-typed id, or the one the album search below handed out.
    const spec = SLEEVE_SPECS.find((row) => row.collectionId === id) ?? SLEEVE_SPECS[id - 1000];
    if (!spec) throw new Error(`unexpected lookup ${id}`);
    const album = {
      wrapperType: 'collection',
      collectionId: id,
      collectionName: spec.correct,
      artistName: spec.artist,
      collectionViewUrl: `https://music.apple.com/gb/album/${spec.slug}/${id}`,
      artworkUrl100: ART,
    };
    if (parsed.searchParams.get('entity') !== 'song') return { results: [album] };
    // The album's songs: the title track first, as Apple so often lists it,
    // then the one the spec chose — so a build that took track one would
    // publish the answer and fail below.
    const tracks = [spec.correct, ...(spec.song === undefined ? [] : [spec.song])].map(
      (trackName, index) => ({
        wrapperType: 'track',
        kind: 'song',
        trackId: id * 100 + index,
        trackName,
        previewUrl: PREVIEW,
        trackViewUrl: `https://music.apple.com/gb/album/${spec.slug}/${id}?i=${id * 100 + index}`,
      }),
    );
    return { results: [album, ...tracks] };
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
  return { results: [] };
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
    /*
      Not every spec any more — only the ones whose cover says nothing.

      `hand-sleeves-data.ts` is a list of candidates, and the gate in
      `write-sleeves-pack.ts` decides which of them can be published. Asserting
      the whole list would be asserting that the gate does nothing.
    */
    const publishable = SLEEVE_SPECS.filter((spec) => {
      if (SLEEVE_HAND_REFUSALS[spec.slug] !== undefined) return false;
      const cover = SLEEVE_COVER_TEXT[spec.slug];
      return cover !== undefined && sleeveVerdict(spec.correct, spec.artist, cover).publishable;
    });
    expect(publishable.length).toBeGreaterThan(30);
    expect(pack.questions.length).toBe(publishable.length);
    for (const question of pack.questions) {
      expect(question.artworkUrl).toContain('600x600bb');
      expect(question.image).toBeUndefined();
      expect(question.storeUrl).toMatch(/^https:\/\/music\.apple\.com\/gb\/album\/\d+$/);
      expect('correct' in question).toBe(false);
    }
    const ids = pack.questions.map((question) => question.trackId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('a sleeve carries the song its spec chose, and only that one', async () => {
    // #given specs that name a song, on albums whose first track is the title
    // track — see the fake lookup above
    const { pack } = await buildSleevesPack(get);
    const bySlug = new Map(SLEEVE_SPECS.map((spec) => [stableId(spec.slug), spec]));

    let withSong = 0;
    for (const question of pack.questions) {
      const spec = bySlug.get(question.id);
      expect(spec).toBeDefined();
      if (spec?.song === undefined) {
        // #then a sleeve nobody chose a song for plays exactly as it did
        expect(question.previewUrl).toBeUndefined();
        continue;
      }
      withSong += 1;
      // #and one that did carries a preview, and its album's store page is
      // still the link — the song adds no new identifier to the pack
      expect(question.previewUrl).toBe(PREVIEW);
      expect(question.storeUrl).toMatch(/^https:\/\/music\.apple\.com\/gb\/album\/\d+$/);
      expect(question.previewStart ?? 0).toBe(spec.previewStart ?? 0);
      expect(question.previewSeconds).toBe(spec.previewSeconds);
    }
    // Guards the loop: with no songs it would pass having checked nothing.
    expect(withSong).toBeGreaterThanOrEqual(90);
  });

  test('a song does not change a sleeve’s id, so the vault needs no reseed', async () => {
    // #given ids are the slug's hash, and the vault is keyed by them
    const { pack } = await buildSleevesPack(get);
    const slugIds = new Set(SLEEVE_SPECS.map((spec) => stableId(spec.slug)));

    // #then every id is still its slug's hash, whatever else the question now
    // carries — so a sleeve seeded before it had a song is found by the same id
    expect(pack.questions.filter((question) => !slugIds.has(question.id))).toEqual([]);
  });
});

