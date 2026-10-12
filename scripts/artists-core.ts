/**
 * Name the Artist: one clip per catalogue artist, from the tunes already published.
 *
 * The preview URL is copied off `public/packs/tunes.json`. Nothing here calls
 * iTunes or Firebase. Title-gate offsets stay on Name that Tune — a clip that
 * sings its title is not giving this answer away. See
 * docs/decisions/name-the-artist.md.
 */

import type { Difficulty } from '../src/questions/types';
import { isItunesPreviewUrl, isItunesStoreUrl } from '../src/lib/apple-media';
import type { TuneSpec } from './hand-tunes-data';
import { stableId } from './write-hand-packs';

/** Three default rounds, the same floor as Name that Tune. */
export const ARTISTS_MIN_PACK = 45;

/**
 * The same artist is the answer once. A second clip would be the same answer
 * again, and the pack is derived from how many distinct artists the catalogue
 * already has.
 */
export const ARTISTS_MAX_PER_NAME = 1;

export const ARTIST_PROMPT = 'Name the artist.';

/** Question ids are `stableId` of this, so they cannot collide with the tune. */
export function artistSlug(songSlug: string): string {
  return `artist-${songSlug}`;
}

/** A row of the sealed tunes pack. Cuts are ignored on purpose. */
export interface ClipRef {
  id: string;
  previewUrl?: string;
  storeUrl?: string;
  trackId?: number;
}

export interface ArtistDraft {
  slug: string;
  id: string;
  /** The tune this clip was copied from. Not published. */
  sourceSlug: string;
  artist: string;
  difficulty: Difficulty;
  incorrect: readonly string[];
  /** How many of the three wrong options are catalogue neighbours. */
  neighbourCount: number;
  previewUrl: string;
  storeUrl: string;
  trackId: number;
}

export interface ArtistBuild {
  drafts: ArtistDraft[];
  /** Tune specs with no usable published clip. */
  unresolved: number;
}

interface UsableClip {
  previewUrl: string;
  storeUrl: string;
  trackId: number;
}

const DIFFICULTY_RANK: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 };

export function isUsableClip(clip: ClipRef | undefined): clip is ClipRef & UsableClip {
  return (
    clip !== undefined
    && typeof clip.previewUrl === 'string'
    && isItunesPreviewUrl(clip.previewUrl)
    && typeof clip.storeUrl === 'string'
    && isItunesStoreUrl(clip.storeUrl)
    && typeof clip.trackId === 'number'
  );
}

/** Apostrophes and case, so a curly quote does not look like a different title. */
function fold(value: string): string {
  return value
    .normalize('NFC')
    .replace(/[’‘ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .toLocaleLowerCase('en-GB')
    .trim();
}

/**
 * How often the catalogue already pairs two artists, by using one's song as
 * the other's wrong answer. A title owned by two artists is not a pair.
 * The link runs both ways: listing someone's song is the data we have for
 * "same era or genre", and it should count for both of them.
 */
function neighbourWeights(specs: readonly TuneSpec[]): Map<string, Map<string, number>> {
  const owners = new Map<string, Set<string>>();
  for (const spec of specs) {
    const key = fold(spec.correct);
    const row = owners.get(key) ?? new Set<string>();
    row.add(spec.artist);
    owners.set(key, row);
  }

  const weights = new Map<string, Map<string, number>>();
  const add = (from: string, to: string): void => {
    const row = weights.get(from) ?? new Map<string, number>();
    row.set(to, (row.get(to) ?? 0) + 1);
    weights.set(from, row);
  };

  for (const spec of specs) {
    for (const title of spec.incorrect) {
      const who = owners.get(fold(title));
      if (!who || who.size !== 1) continue;
      const other = [...who][0];
      if (other === undefined || other === spec.artist) continue;
      add(spec.artist, other);
      add(other, spec.artist);
    }
  }
  return weights;
}

function spin(name: string, size: number): number {
  if (size <= 0) return 0;
  let hash = 2166136261;
  for (let i = 0; i < name.length; i += 1) {
    hash ^= name.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % size;
}

function pickDistractors(
  artist: string,
  songTitle: string,
  pool: readonly string[],
  weights: Map<string, number>,
): { incorrect: string[]; neighbourCount: number } {
  const banned = new Set<string>([fold(artist), fold(songTitle)]);
  const candidates = pool.filter((name) => {
    if (name === artist) return false;
    const folded = fold(name);
    if (banned.has(folded)) return false;
    return true;
  });

  const neighbours = candidates
    .filter((name) => (weights.get(name) ?? 0) > 0)
    .sort(
      (a, b) =>
        (weights.get(b) ?? 0) - (weights.get(a) ?? 0) || a.localeCompare(b, 'en-GB'),
    );

  const picked: string[] = [];
  const seen = new Set<string>(banned);
  const take = (name: string): void => {
    const folded = fold(name);
    if (seen.has(folded) || picked.length >= 3) return;
    seen.add(folded);
    picked.push(name);
  };
  for (const name of neighbours) take(name);

  const neighbourCount = picked.length;
  if (neighbourCount < 3) {
    const rest = candidates
      .filter((name) => !picked.includes(name))
      .sort((a, b) => a.localeCompare(b, 'en-GB'));
    const start = spin(artist, rest.length);
    const rotated = [...rest.slice(start), ...rest.slice(0, start)];
    for (const name of rotated) take(name);
  }

  if (picked.length < 3) {
    throw new Error('Not enough other catalogue artists to fill a question');
  }
  return { incorrect: picked.slice(0, 3), neighbourCount };
}

interface Chosen {
  spec: TuneSpec;
  clip: ClipRef & UsableClip;
  index: number;
}

function chooseClip(group: readonly Chosen[]): Chosen {
  const picked = [...group].sort((a, b) => {
    const byDifficulty = DIFFICULTY_RANK[a.spec.difficulty] - DIFFICULTY_RANK[b.spec.difficulty];
    if (byDifficulty !== 0) return byDifficulty;
    return a.index - b.index;
  })[0];
  if (!picked) throw new Error('empty artist group');
  return picked;
}

export function buildArtistDrafts(
  specs: readonly TuneSpec[],
  clips: readonly ClipRef[],
): ArtistBuild {
  const byId = new Map(clips.map((clip) => [clip.id, clip]));
  const grouped = new Map<string, Chosen[]>();
  let unresolved = 0;

  for (const [index, spec] of specs.entries()) {
    const clip = byId.get(stableId(spec.slug));
    if (!isUsableClip(clip)) {
      unresolved += 1;
      continue;
    }
    const group = grouped.get(spec.artist) ?? [];
    group.push({ spec, clip, index });
    grouped.set(spec.artist, group);
  }

  const chosen = [...grouped.values()].map((group) => chooseClip(group));
  const pool = chosen.map((row) => row.spec.artist);
  const weights = neighbourWeights(specs);

  const drafts = chosen
    .sort((a, b) => a.index - b.index)
    .map((row): ArtistDraft => {
      const { incorrect, neighbourCount } = pickDistractors(
        row.spec.artist,
        row.spec.correct,
        pool,
        weights.get(row.spec.artist) ?? new Map(),
      );
      const slug = artistSlug(row.spec.slug);
      return {
        slug,
        id: stableId(slug),
        sourceSlug: row.spec.slug,
        artist: row.spec.artist,
        difficulty: row.spec.difficulty,
        incorrect,
        neighbourCount,
        previewUrl: row.clip.previewUrl,
        storeUrl: row.clip.storeUrl,
        trackId: row.clip.trackId,
      };
    });

  const tallies = new Map<string, number>();
  for (const draft of drafts) {
    tallies.set(draft.artist, (tallies.get(draft.artist) ?? 0) + 1);
  }
  for (const count of tallies.values()) {
    if (count > ARTISTS_MAX_PER_NAME) {
      throw new Error('An artist is the answer more than once');
    }
  }

  return { drafts, unresolved };
}

export function artistPackStats(drafts: readonly ArtistDraft[]): {
  questions: number;
  easy: number;
  medium: number;
  hard: number;
  neighbours: readonly [number, number, number, number];
} {
  const neighbours: [number, number, number, number] = [0, 0, 0, 0];
  let easy = 0;
  let medium = 0;
  let hard = 0;
  for (const draft of drafts) {
    if (draft.difficulty === 'easy') easy += 1;
    else if (draft.difficulty === 'medium') medium += 1;
    else hard += 1;
    const bucket = draft.neighbourCount;
    const current = neighbours[bucket];
    if (current !== undefined) neighbours[bucket] = current + 1;
  }
  return { questions: drafts.length, easy, medium, hard, neighbours };
}
