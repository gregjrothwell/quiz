/**
 * iTunes Search / Lookup, GB store.
 *
 * ~20 calls/min per IP. Callers must go through {@link itunesGet}, which
 * spaces live requests. Tests inject {@link ItunesGet}. Never imported by
 * `src/` — pack-build only.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { itunesArtworkSize } from '../src/lib/apple-media';

export const ITUNES_COUNTRY = 'gb';
/** Stay under Apple's ~20/min. 3.2s gap is 18.75/min. */
export const ITUNES_GAP_MS = 3_200;

export type ItunesGet = (url: string) => Promise<unknown>;

interface ItunesSongResult {
  wrapperType?: string;
  kind?: string;
  trackId?: number;
  trackName?: string;
  artistName?: string;
  previewUrl?: string;
  trackViewUrl?: string;
  artworkUrl100?: string;
}

interface ItunesCollectionResult {
  wrapperType?: string;
  collectionType?: string;
  collectionId?: number;
  collectionName?: string;
  artistName?: string;
  collectionViewUrl?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  trackViewUrl?: string;
  trackId?: number;
  trackName?: string;
  kind?: string;
}

interface ItunesList {
  resultCount?: number;
  results?: Array<ItunesSongResult & ItunesCollectionResult>;
}

export interface ResolvedSong {
  trackId: number;
  trackName: string;
  artistName: string;
  previewUrl: string;
  storeUrl: string;
}

export interface ResolvedArt {
  id: number;
  name: string;
  artistName: string;
  storeUrl: string;
  artworkUrl: string;
}

let lastCallAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function defaultItunesGet(url: string): Promise<unknown> {
  const wait = lastCallAt + ITUNES_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastCallAt = Date.now();
  const response = await fetch(url, {
    headers: { 'User-Agent': 'VibeQuiz/0.1 (https://github.com/gregjrothwell/quiz; pack builder)' },
  });
  if (!response.ok) throw new Error(`iTunes ${response.status} for ${url}`);
  return response.json() as Promise<unknown>;
}

const ITUNES_CACHE = join(import.meta.dirname, '..', '.cache', 'itunes-lookup.json');

/** Live lookups, remembered in `.cache/` so a re-run does not burn the rate limit. */
export async function cachedItunesGet(): Promise<ItunesGet> {
  let store: Record<string, unknown> = {};
  try {
    store = JSON.parse(await readFile(ITUNES_CACHE, 'utf8')) as Record<string, unknown>;
  } catch {
    store = {};
  }
  return async (url: string) => {
    const hit = store[url];
    if (hit !== undefined) return hit;
    const data = await defaultItunesGet(url);
    store[url] = data;
    await mkdir(join(import.meta.dirname, '..', '.cache'), { recursive: true });
    await writeFile(ITUNES_CACHE, `${JSON.stringify(store)}\n`);
    return data;
  };
}

function searchUrl(params: Record<string, string>): string {
  const query = new URLSearchParams({ country: ITUNES_COUNTRY, limit: '8', ...params });
  return `https://itunes.apple.com/search?${query.toString()}`;
}

function asList(data: unknown): ItunesList {
  if (typeof data !== 'object' || data === null) return {};
  return data as ItunesList;
}

function foldName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/['’]/g, '');
}

function artistMatches(got: string | undefined, want: string): boolean {
  if (!got) return false;
  const a = foldName(got).replace(/\./g, '');
  const b = foldName(want).replace(/\./g, '');
  return a.includes(b) || b.includes(a);
}

function coreTitle(value: string): string {
  return foldName(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/^(the|a|an) /, '')
    .replace(/ \d{4}\b.*$/, '')
    .replace(/ (deluxe|remaster|remastered|anniversary|edition|expanded|super deluxe).*$/, '')
    .trim();
}

/** Album/track title: exact after dropping "The" and remaster suffixes. */
export function titleMatches(got: string | undefined, want: string): boolean {
  if (!got) return false;
  const a = coreTitle(got);
  const b = coreTitle(want);
  if (a === b) return true;
  if (a.startsWith(`${b} `) && (b.length >= 4 || /^\d+$/.test(b))) return true;
  return false;
}

function lookupUrl(id: number): string {
  return `https://itunes.apple.com/lookup?id=${id}&country=${ITUNES_COUNTRY}`;
}

export async function resolveSong(
  term: string,
  artist: string,
  get: ItunesGet = defaultItunesGet,
): Promise<ResolvedSong> {
  const data = asList(await get(searchUrl({ term, entity: 'song', media: 'music', explicit: 'No' })));
  const match = data.results?.find(
    (row) =>
      row.kind === 'song'
      && typeof row.trackId === 'number'
      && typeof row.previewUrl === 'string'
      && typeof row.trackViewUrl === 'string'
      && typeof row.trackName === 'string'
      && artistMatches(row.artistName, artist),
  );
  if (!match || match.trackId === undefined || !match.previewUrl || !match.trackViewUrl || !match.trackName || !match.artistName) {
    throw new Error(`No GB preview for “${term}” by ${artist}`);
  }
  return {
    trackId: match.trackId,
    trackName: match.trackName,
    artistName: match.artistName,
    previewUrl: match.previewUrl,
    storeUrl: match.trackViewUrl,
  };
}

function artFromCollection(row: ItunesCollectionResult, fallbackName: string): ResolvedArt {
  if (
    row.collectionId === undefined
    || !row.collectionViewUrl
    || !row.artworkUrl100
    || !row.collectionName
  ) {
    throw new Error(`Incomplete iTunes collection for ${fallbackName}`);
  }
  return {
    id: row.collectionId,
    name: row.collectionName,
    artistName: row.artistName ?? '',
    storeUrl: row.collectionViewUrl,
    artworkUrl: itunesArtworkSize(row.artworkUrl100, 600),
  };
}

export async function resolveAlbum(
  term: string,
  artist: string,
  get: ItunesGet = defaultItunesGet,
  titleHint?: string,
  collectionId?: number,
): Promise<ResolvedArt> {
  if (collectionId !== undefined) {
    const data = asList(await get(lookupUrl(collectionId)));
    const row = (data.results ?? []).find(
      (item) => item.collectionId === collectionId || item.wrapperType === 'collection',
    );
    if (!row) throw new Error(`No GB lookup for collection ${collectionId}`);
    return artFromCollection(row, term);
  }
  const data = asList(await get(searchUrl({ term, entity: 'album', media: 'music' })));
  const candidates = (data.results ?? []).filter(
    (row) =>
      row.wrapperType === 'collection'
      && typeof row.collectionId === 'number'
      && typeof row.collectionViewUrl === 'string'
      && typeof row.artworkUrl100 === 'string'
      && typeof row.collectionName === 'string'
      && artistMatches(row.artistName, artist),
  );
  const match = titleHint
    ? candidates.find((row) => titleMatches(row.collectionName, titleHint))
    : candidates[0];
  if (!match) {
    throw new Error(`No GB artwork for album “${term}” by ${artist}`);
  }
  return artFromCollection(match, term);
}

export async function resolveScreen(
  term: string,
  kind: 'movie' | 'tvSeason',
  get: ItunesGet = defaultItunesGet,
  titleHint?: string,
): Promise<ResolvedArt> {
  const media = kind === 'movie' ? 'movie' : 'tvShow';
  const entity = kind === 'movie' ? 'movie' : 'tvSeason';
  const data = asList(await get(searchUrl({ term, entity, media })));
  const candidates = (data.results ?? []).filter((row) => {
    if (typeof row.artworkUrl100 !== 'string') return false;
    if (kind === 'movie') {
      return (
        typeof row.trackId === 'number'
        && typeof row.trackViewUrl === 'string'
        && typeof row.trackName === 'string'
      );
    }
    return (
      typeof row.collectionId === 'number'
      && typeof row.collectionViewUrl === 'string'
      && typeof row.collectionName === 'string'
    );
  });
  const named = titleHint
    ? candidates.find((row) => {
        const name = kind === 'movie' ? row.trackName : row.collectionName;
        if (!name) return false;
        const a = coreTitle(name);
        const b = coreTitle(titleHint);
        if (a === b) return true;
        return kind === 'tvSeason' && a.startsWith(`${b} season`);
      })
    : candidates[0];
  const match = named;
  if (!match || !match.artworkUrl100) {
    throw new Error(`No GB artwork for ${kind} “${term}”`);
  }
  if (kind === 'movie') {
    if (match.trackId === undefined || !match.trackViewUrl || !match.trackName) {
      throw new Error(`No GB movie page for “${term}”`);
    }
    return {
      id: match.trackId,
      name: match.trackName,
      artistName: '',
      storeUrl: match.trackViewUrl,
      artworkUrl: itunesArtworkSize(match.artworkUrl100, 600),
    };
  }
  if (match.collectionId === undefined || !match.collectionViewUrl || !match.collectionName) {
    throw new Error(`No GB TV season for “${term}”`);
  }
  return {
    id: match.collectionId,
    name: match.collectionName,
    artistName: '',
    storeUrl: match.collectionViewUrl,
    artworkUrl: itunesArtworkSize(match.artworkUrl100, 600),
  };
}
