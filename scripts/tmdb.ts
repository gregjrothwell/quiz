/**
 * TMDB search / images. Pack-build only — never imported by `src/`.
 *
 * Untitled backdrops (`iso_639_1 === null`) are the stills we want: language
 * tags on TMDB usually mean titled keyart. Cache keys omit the API key.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { titleMatches } from './itunes';
import type { ScreenSpec } from './hand-screens-data';

export const TMDB_IMAGE_HOST = 'image.tmdb.org';
export const TMDB_BACKDROP_SIZE = 'w780';
/** Stay under TMDB’s ~40 requests / 10s. Cache hits skip this. */
export const TMDB_GAP_MS = 280;

export type TmdbGet = (url: string) => Promise<unknown>;

export interface TmdbBackdrop {
  file_path: string;
  iso_639_1: string | null;
  vote_average: number;
  vote_count: number;
  width: number;
  aspect_ratio: number;
}

export interface ResolvedBackdrop {
  tmdbId: number;
  name: string;
  filePath: string;
  imageUrl: string;
  /** True when we hashed a portrait poster and the client must crop the title. */
  posterCrop?: boolean;
}

const TITLE_ALIASES: Record<string, string[]> = {
  'Harry Potter and the Philosopher’s Stone': ["Harry Potter and the Sorcerer's Stone"],
  'Harry Potter and the Philosopher\'s Stone': ["Harry Potter and the Sorcerer's Stone"],
  'Mamma Mia!': ['Mamma Mia'],
  'Avengers: Endgame': ['Avengers Endgame'],
};

const TMDB_CACHE = join(import.meta.dirname, '..', '.cache', 'tmdb-lookup.json');

let lastCallAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function requireTmdbKey(): string {
  const key = process.env.TMDB_API_KEY?.trim();
  if (!key) {
    throw new Error(
      'TMDB_API_KEY is missing. Create a free key at https://www.themoviedb.org/settings/api and add it to .env.local',
    );
  }
  return key;
}

export function tmdbBackdropUrl(filePath: string): string {
  const path = filePath.startsWith('/') ? filePath : `/${filePath}`;
  return `https://${TMDB_IMAGE_HOST}/t/p/${TMDB_BACKDROP_SIZE}${path}`;
}

function isUntitledLang(lang: string | null): boolean {
  return lang === null || lang === '';
}

function rankUntitled(images: TmdbBackdrop[]): TmdbBackdrop[] {
  return [...images].sort((a, b) => {
    if (b.vote_count !== a.vote_count) return b.vote_count - a.vote_count;
    return b.vote_average - a.vote_average;
  });
}

export function pickUntitledBackdrop(images: TmdbBackdrop[]): TmdbBackdrop {
  const untitled = images.filter(
    (image) =>
      isUntitledLang(image.iso_639_1)
      && Boolean(image.file_path)
      && image.width >= 780
      && image.aspect_ratio >= 1.3
      && image.aspect_ratio <= 2.4,
  );
  const picked = rankUntitled(untitled)[0];
  if (!picked) throw new Error('no untitled backdrop');
  return picked;
}

/** Portrait keyart with no language tag — crop hides typical title treatment. */
export function pickUntitledPoster(images: TmdbBackdrop[]): TmdbBackdrop {
  const untitled = images.filter(
    (image) =>
      isUntitledLang(image.iso_639_1)
      && Boolean(image.file_path)
      && image.width >= 500
      && image.aspect_ratio >= 0.5
      && image.aspect_ratio <= 0.85,
  );
  const picked = rankUntitled(untitled)[0];
  if (!picked) throw new Error('no untitled poster');
  return picked;
}

function asRecord(data: unknown): Record<string, unknown> {
  if (typeof data !== 'object' || data === null) return {};
  return data as Record<string, unknown>;
}

function asResults(data: unknown): Record<string, unknown>[] {
  const results = asRecord(data).results;
  if (!Array.isArray(results)) return [];
  return results.filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null);
}

function asImageList(data: unknown, key: 'backdrops' | 'posters' | 'stills'): TmdbBackdrop[] {
  const list = asRecord(data)[key];
  if (!Array.isArray(list)) return [];
  const found: TmdbBackdrop[] = [];
  for (const row of list) {
    if (typeof row !== 'object' || row === null) continue;
    const image = row as Record<string, unknown>;
    if (typeof image.file_path !== 'string') continue;
    found.push({
      file_path: image.file_path,
      iso_639_1:
        typeof image.iso_639_1 === 'string' && image.iso_639_1.length > 0 ? image.iso_639_1 : null,
      vote_average: typeof image.vote_average === 'number' ? image.vote_average : 0,
      vote_count: typeof image.vote_count === 'number' ? image.vote_count : 0,
      width: typeof image.width === 'number' ? image.width : 0,
      aspect_ratio: typeof image.aspect_ratio === 'number' ? image.aspect_ratio : 0,
    });
  }
  return found;
}

function yearOf(date: unknown): number | null {
  if (typeof date !== 'string' || date.length < 4) return null;
  const year = Number(date.slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

function namesOf(row: Record<string, unknown>): string[] {
  const keys = ['title', 'original_title', 'name', 'original_name'] as const;
  const names: string[] = [];
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.length > 0) names.push(value);
  }
  return names;
}

export function titleFits(got: string | undefined, want: string): boolean {
  if (titleMatches(got, want)) return true;
  return (TITLE_ALIASES[want] ?? []).some((alias) => titleMatches(got, alias));
}

/** TMDB’s US theatrical date can sit a calendar year off a UK/premiere year. */
export function yearFits(got: number | null, want: number): boolean {
  if (got === null) return false;
  return Math.abs(got - want) <= 1;
}

function originOk(row: Record<string, unknown>, want?: string): boolean {
  if (!want) return true;
  const countries = row.origin_country;
  if (!Array.isArray(countries)) return false;
  return countries.some((code) => code === want);
}

function searchHit(row: Record<string, unknown>, spec: ScreenSpec): boolean {
  if (typeof row.id !== 'number') return false;
  if (!namesOf(row).some((name) => titleFits(name, spec.correct))) return false;
  if (!originOk(row, spec.originCountry)) return false;
  const date = spec.kind === 'movie' ? row.release_date : row.first_air_date;
  return yearFits(yearOf(date), spec.year);
}

function tmdbSearchUrl(spec: ScreenSpec, apiKey: string): string {
  const path = spec.kind === 'movie' ? '/search/movie' : '/search/tv';
  const params = new URLSearchParams({
    api_key: apiKey,
    query: spec.query,
    include_adult: 'false',
  });
  if (spec.kind === 'movie') params.set('year', String(spec.year));
  else params.set('first_air_date_year', String(spec.year));
  return `https://api.themoviedb.org/3${path}?${params.toString()}`;
}

function tmdbImagesUrl(spec: ScreenSpec, tmdbId: number, apiKey: string): string {
  const path = spec.kind === 'movie' ? `/movie/${tmdbId}/images` : `/tv/${tmdbId}/images`;
  const params = new URLSearchParams({ api_key: apiKey });
  return `https://api.themoviedb.org/3${path}?${params.toString()}`;
}

/** Cache key omits the API key so `.cache/tmdb-lookup.json` is not a credential. */
export function tmdbCacheKey(url: string): string {
  const parsed = new URL(url);
  parsed.searchParams.delete('api_key');
  return `${parsed.pathname}?${parsed.searchParams.toString()}`;
}

export async function defaultTmdbGet(url: string): Promise<unknown> {
  requireTmdbKey();
  const wait = lastCallAt + TMDB_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastCallAt = Date.now();
  const response = await fetch(url, {
    headers: { 'User-Agent': 'VibeQuiz/0.1 (https://github.com/gregjrothwell/quiz; pack builder)' },
  });
  if (!response.ok) throw new Error(`TMDB ${response.status} for ${tmdbCacheKey(url)}`);
  return response.json() as Promise<unknown>;
}

export async function cachedTmdbGet(): Promise<TmdbGet> {
  let store: Record<string, unknown> = {};
  try {
    store = JSON.parse(await readFile(TMDB_CACHE, 'utf8')) as Record<string, unknown>;
  } catch {
    store = {};
  }
  return async (url: string) => {
    const key = tmdbCacheKey(url);
    const hit = store[key];
    if (hit !== undefined) return hit;
    const data = await defaultTmdbGet(url);
    store[key] = data;
    await mkdir(join(import.meta.dirname, '..', '.cache'), { recursive: true });
    await writeFile(TMDB_CACHE, `${JSON.stringify(store)}\n`);
    return data;
  };
}

function displayName(row: Record<string, unknown>, fallback: string): string {
  const names = namesOf(row);
  return names[0] ?? fallback;
}

export async function resolveUntitledBackdrop(
  spec: ScreenSpec,
  get: TmdbGet,
  apiKey = process.env.TMDB_API_KEY?.trim() || 'test',
): Promise<ResolvedBackdrop> {
  const search = asResults(await get(tmdbSearchUrl(spec, apiKey)));
  const match = search.find((row) => searchHit(row, spec));
  if (!match || typeof match.id !== 'number') {
    throw new Error(`No TMDB ${spec.kind} for “${spec.correct}” (${spec.year})`);
  }
  const payload = await get(tmdbImagesUrl(spec, match.id, apiKey));
  const landscape = [...asImageList(payload, 'backdrops'), ...asImageList(payload, 'stills')];
  try {
    const backdrop = pickUntitledBackdrop(landscape);
    return {
      tmdbId: match.id,
      name: displayName(match, spec.correct),
      filePath: backdrop.file_path,
      imageUrl: tmdbBackdropUrl(backdrop.file_path),
    };
  } catch (backdropError: unknown) {
    if (!(backdropError instanceof Error) || !backdropError.message.includes('untitled backdrop')) {
      throw backdropError;
    }
  }
  const poster = pickUntitledPoster(asImageList(payload, 'posters'));
  return {
    tmdbId: match.id,
    name: displayName(match, spec.correct),
    filePath: poster.file_path,
    imageUrl: tmdbBackdropUrl(poster.file_path),
    posterCrop: true,
  };
}
