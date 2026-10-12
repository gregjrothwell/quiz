/**
 * Which of an album's songs a sleeve may play as its clue.
 *
 * The cover is the question and the song is a clue, so a song must never say
 * the album's name. Its **title** is checked here, by name and offline. Its
 * **lyric** needs a transcriber — `npm run tune-audit -- --pack sleeves` — and
 * that audit's numbers go into `hand-sleeves-data.ts` by hand, as they do for
 * Name that Tune. See docs/decisions/sleeves-song.md.
 */

import { titleMatches, type AlbumTrack } from './itunes';
import { words } from './title-in-clip';

export type { AlbumTrack } from './itunes';

/**
 * Apple's edition suffixes, which are not part of anybody's title — both the
 * bracketed kind, "(2011 Remastered)", and the dashed, "- Remastered 2009".
 */
const EDITION = '(remaster|version|edit|mix|mono|stereo|live)';
function bare(title: string): string {
  return title
    .replace(new RegExp(`\\s*[([][^)\\]]*${EDITION}[^)\\]]*[)\\]]`, 'gi'), '')
    .replace(new RegExp(`\\s+-\\s+.*${EDITION}.*$`, 'i'), '');
}

function containsRun(haystack: string[], needle: string[]): boolean {
  if (needle.length === 0 || needle.length > haystack.length) return false;
  for (let start = 0; start + needle.length <= haystack.length; start += 1) {
    if (needle.every((word, offset) => haystack[start + offset] === word)) return true;
  }
  return false;
}

/**
 * Four letters and up that every title uses, so sharing one is no clue.
 * Short words are left to {@link containsRun}, which only fires on the whole.
 */
const COMMON = new Set([
  'that', 'what', 'with', 'this', 'from', 'your', 'have', 'when', 'where', 'there',
  'they', 'into', 'then', 'than', 'will', 'been', 'were', 'like', 'just', 'some',
  'over', 'only', 'about', 'dont', 'cant',
]);

/**
 * Whether a song's title says, or points at, its album's name.
 *
 * Two tests, either of which refuses:
 *
 * - **The whole of one inside the other**, in order: *Purple Rain* off *Purple
 *   Rain*, "Another Brick in the Wall" off *The Wall*, "Morning Glory" off
 *   *(What's the Story) Morning Glory?*. This is what catches the short titles
 *   — *AM*, *Ten*, *x* — that the second test ignores.
 * - **One distinctive word in common**: "People Are Strange" off *Strange
 *   Days*, "Supermassive Black Hole" off *Black Holes and Revelations*. Neither
 *   is a whole run, and both are half the answer. Found picking the first
 *   hundred songs, 29 September 2026.
 *
 * Whole words throughout, because "Wonderwall" is not "wall". It errs towards
 * refusing: a false refusal costs picking another song, and a false pass
 * publishes the answer as the clue.
 */
export function songNamesAlbum(song: string, album: string): boolean {
  const songWords = words(bare(song));
  const albumWords = words(album);
  if (containsRun(songWords, albumWords) || containsRun(albumWords, songWords)) return true;
  const distinctive = new Set(albumWords.filter((word) => word.length >= 4 && !COMMON.has(word)));
  return songWords.some((word) => distinctive.has(word));
}

export type AlbumSongPick = { song: AlbumTrack } | { refused: string };

/**
 * The spec's chosen song, off the album's own track list.
 *
 * Refuses rather than falling back. Taking track one instead of a song that is
 * missing is how a wrong clip ships green — and on a great many albums track
 * one is the title track.
 */
export function pickAlbumSong(tracks: AlbumTrack[], want: string, album: string): AlbumSongPick {
  const song = tracks.find((row) => titleMatches(bare(row.trackName), want));
  if (!song) return { refused: `“${want}” is not on the album's GB track list` };
  if (songNamesAlbum(song.trackName, album)) {
    return { refused: `“${song.trackName}” names the album` };
  }
  return { song };
}
