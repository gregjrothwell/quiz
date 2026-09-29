import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { SLEEVE_SPECS } from './hand-sleeves-data';
import { albumTracks, type ItunesGet } from './itunes';
import { pickAlbumSong, songNamesAlbum, type AlbumTrack } from './sleeve-song';
import { stableId } from './write-hand-packs';
import { isItunesPreviewUrl } from '../src/lib/apple-media';

/**
 * A song from the album, played halfway through a sleeve.
 *
 * The cover is the question and the song is a clue, so the one thing the song
 * must never do is say the album's name. There are two ways it can. **Its
 * title** — *Purple Rain* off *Purple Rain* — is checked here, offline, by
 * name. **Its lyric** — "oh well, whatever, never mind" — needs a transcriber,
 * and is `npm run tune-audit -- --pack sleeves`, whose numbers go into the
 * spec by hand exactly as they do for Name that Tune.
 *
 * See docs/decisions/sleeves-song.md.
 */

const PREVIEW = 'https://audio-ssl.itunes.apple.com/itunes-assets/x.m4a';

const track = (trackName: string, trackId = 1): AlbumTrack => ({
  trackId,
  trackName,
  previewUrl: PREVIEW,
  storeUrl: `https://music.apple.com/gb/album/x/99?i=${trackId}`,
});

describe('songNamesAlbum', () => {
  test('a title track names its album', () => {
    // #given the four the story was written against
    expect(songNamesAlbum('Purple Rain', 'Purple Rain')).toBe(true);
    expect(songNamesAlbum('Back to Black', 'Back to Black')).toBe(true);
    expect(songNamesAlbum('The Bends', 'The Bends')).toBe(true);
    expect(songNamesAlbum('London Calling (Remastered)', 'London Calling')).toBe(true);
  });

  test('a song that carries the album title inside its own names it too', () => {
    // #given the album's words sitting whole inside a longer song title
    // #then refused. "Another Brick in the Wall" under *The Wall* is the answer
    // with a few words in front.
    expect(songNamesAlbum('Another Brick in the Wall, Pt. 2', 'The Wall')).toBe(true);
    expect(songNamesAlbum('Parklife', 'Parklife')).toBe(true);
  });

  test('a song whose title is inside the album title names it as well', () => {
    // #given *(What’s the Story) Morning Glory?* and its song "Morning Glory"
    // #then refused: two of the album's four words, and the two anybody says
    expect(songNamesAlbum('Morning Glory', '(What’s the Story) Morning Glory?')).toBe(true);
  });

  test('a song sharing one distinctive word with the album points at it', () => {
    // #given the pairs that pass a whole-run check and still give it away —
    // found picking the first hundred songs, 29 September 2026
    // #then refused: "Strange" in the song is half the answer to *Strange Days*
    expect(songNamesAlbum('People Are Strange', 'Strange Days')).toBe(true);
    expect(songNamesAlbum('Supermassive Black Hole', 'Black Holes and Revelations')).toBe(true);
    expect(songNamesAlbum('Holy Grail', 'Magna Carta Holy Grail')).toBe(true);
  });

  test('a common word shared is not a clue', () => {
    // #given words every title uses
    // #then not refused, or half the catalogue would be
    expect(
      songNamesAlbum('I Bet You Look Good on the Dancefloor', 'Whatever People Say I Am, That’s What I’m Not'),
    ).toBe(false);
    expect(songNamesAlbum('Moaning Lisa Smile', 'My Love Is Cool')).toBe(false);
    expect(songNamesAlbum('Learn to Fly', 'There Is Nothing Left to Lose')).toBe(false);
  });

  test('a song that shares no run of words with the album is fine', () => {
    expect(songNamesAlbum('Smells Like Teen Spirit', 'Nevermind')).toBe(false);
    expect(songNamesAlbum('Wonderwall', '(What’s the Story) Morning Glory?')).toBe(false);
    expect(songNamesAlbum('Comfortably Numb', 'The Wall')).toBe(false);
    expect(songNamesAlbum('Do I Wanna Know?', 'AM')).toBe(false);
  });

  test('matches whole words, not letters', () => {
    // #given "wall" inside "Wonderwall" — one word, and not the album's
    expect(songNamesAlbum('Wonderwall', 'The Wall')).toBe(false);
    // #and a one-letter album title against a song that happens to contain an x
    expect(songNamesAlbum('Sing', 'x')).toBe(false);
  });
});

describe('pickAlbumSong', () => {
  test('takes the named song off the album', () => {
    // #given an album's track list, in album order
    const tracks = [track('Radio Friendly Unit Shifter', 1), track('Smells Like Teen Spirit', 2)];

    // #when the spec names the one wanted
    const picked = pickAlbumSong(tracks, 'Smells Like Teen Spirit', 'Nevermind');

    // #then that one, not track one
    expect('song' in picked && picked.song.trackId).toBe(2);
  });

  test('tolerates the remaster suffix Apple adds', () => {
    const picked = pickAlbumSong([track('Wonderwall (Remastered)', 7)], 'Wonderwall', 'Morning Glory');
    expect('song' in picked && picked.song.trackId).toBe(7);
  });

  test('refuses a song that is not on this album', () => {
    // #given a spec that names a song the GB edition does not carry
    const picked = pickAlbumSong([track('Lithium')], 'Smells Like Teen Spirit', 'Nevermind');

    // #then refused, with a reason a person can act on — not the first track
    // instead, which is how a wrong clip ships green
    expect('refused' in picked && picked.refused).toMatch(/not on the album/);
  });

  test('refuses a title track even when a spec asks for it', () => {
    const picked = pickAlbumSong([track('Purple Rain')], 'Purple Rain', 'Purple Rain');
    expect('refused' in picked && picked.refused).toMatch(/names the album/);
  });
});

describe('albumTracks', () => {
  test('reads an album’s songs from one lookup, and only the ones with a preview', async () => {
    // #given the GB lookup for a collection, which returns the album row first
    const seen: string[] = [];
    const get: ItunesGet = async (url) => {
      seen.push(url);
      return {
        results: [
          { wrapperType: 'collection', collectionId: 99, collectionName: 'Nevermind' },
          {
            wrapperType: 'track', kind: 'song', trackId: 1, trackName: 'Smells Like Teen Spirit',
            previewUrl: PREVIEW, trackViewUrl: 'https://music.apple.com/gb/album/x/99?i=1',
          },
          // No preview: Apple withholds some. Useless as a clue.
          { wrapperType: 'track', kind: 'song', trackId: 2, trackName: 'Endless, Nameless' },
          // A video on the same album is not a song.
          {
            wrapperType: 'track', kind: 'music-video', trackId: 3, trackName: 'Lithium',
            previewUrl: PREVIEW, trackViewUrl: 'https://music.apple.com/gb/album/x/99?i=3',
          },
        ],
      };
    };

    const tracks = await albumTracks(99, get);

    // #then one request, to the GB store, asking for songs
    expect(seen).toHaveLength(1);
    const url = new URL(seen[0] ?? '');
    expect(url.searchParams.get('id')).toBe('99');
    expect(url.searchParams.get('entity')).toBe('song');
    expect(url.searchParams.get('country')).toBe('gb');
    // #and only the song that can actually be played
    expect(tracks.map((row) => row.trackId)).toEqual([1]);
  });
});

describe('the specs', () => {
  const withSong = SLEEVE_SPECS.filter((spec) => spec.song !== undefined);

  // Guards the two below: with no songs chosen they would pass vacuously.
  test('most sleeves name a song', () => {
    expect(withSong.length).toBeGreaterThanOrEqual(90);
  });

  test('no spec names a song that names its album', () => {
    const named = withSong.filter((spec) => songNamesAlbum(spec.song ?? '', spec.correct));
    expect(named.map((spec) => `${spec.slug}: ${spec.song ?? ''}`)).toEqual([]);
  });
});

describe('the published sleeves', () => {
  interface Published {
    id: string;
    previewUrl?: string;
    previewStart?: number;
    previewSeconds?: number;
  }
  const published = (
    JSON.parse(readFileSync(resolve(import.meta.dirname, '../public/packs/sleeves.json'), 'utf8')) as {
      questions: Published[];
    }
  ).questions;
  const bySlug = new Map(SLEEVE_SPECS.map((spec) => [stableId(spec.slug), spec]));

  test('most of the pack has a song, and every song is Apple’s', () => {
    const songs = published.filter((question) => question.previewUrl !== undefined);
    expect(songs.length).toBeGreaterThanOrEqual(90);
    expect(songs.filter((question) => !isItunesPreviewUrl(question.previewUrl ?? ''))).toEqual([]);
  });

  test('a song is only published for a spec that chose one', () => {
    // #given the build refuses rather than guessing
    // #then no preview appears on a sleeve nobody picked a song for
    const unchosen = published.filter(
      (question) => question.previewUrl !== undefined && bySlug.get(question.id)?.song === undefined,
    );
    expect(unchosen.map((question) => question.id)).toEqual([]);
  });

  test('the audit’s cuts reached the pack', () => {
    // #given the numbers pasted into the spec from `tune-audit -- --pack sleeves`
    // #then the published question carries them, or the trim protects nothing
    const lost = published.filter((question) => {
      const spec = bySlug.get(question.id);
      if (!spec || question.previewUrl === undefined) return false;
      return (
        (spec.previewStart ?? 0) !== (question.previewStart ?? 0)
        || spec.previewSeconds !== question.previewSeconds
      );
    });
    expect(lost.map((question) => question.id)).toEqual([]);
  });
});
