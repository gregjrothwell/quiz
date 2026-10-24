/**
 * Resolves the GB store's original recording of each theme and writes
 * `public/packs/themes.json`.
 *
 * **Blind pack.** Every line this prints names a slug (`theme-NNN`) and a
 * number, never a programme or a track — the log is somebody's screen. See
 * docs/decisions/tv-themes.md.
 *
 * Stricter than Name that Tune's writer, on purpose. `resolveSong` falls back
 * to the artist's top hit when the title does not match, and says so; a
 * composer's top hit is usually a *different* theme by the same composer, which
 * in this pack is a question with the wrong answer. So a theme with no matching
 * recording is skipped, not guessed.
 *
 * Run: `npm run write-themes-pack`
 */

import { THEME_SPECS, THEME_PROMPT, THEMES_MIN_PACK, themeTerm, type ThemeSpec } from './hand-themes-data';
import { cachedItunesGet, ITUNES_COUNTRY, type ItunesGet } from './itunes';
import { writeSealedPack } from './write-sealed-pack';
import { stableId } from './write-hand-packs';
import { isItunesPreviewUrl } from '../src/lib/apple-media';
import { PACK_META, sealQuestion, type Pack, type Question } from '../src/questions/types';

export interface ThemeRecording {
  trackId: number;
  previewUrl: string;
  storeUrl: string;
}

interface Row {
  kind?: string;
  trackId?: number;
  trackName?: string;
  artistName?: string;
  previewUrl?: string;
  trackViewUrl?: string;
}

/** The URL `.cache/tv-themes/measure.ts` searched with, so the cache answers it. */
export function themeSearchUrl(spec: ThemeSpec): string {
  const query = new URLSearchParams({
    country: ITUNES_COUNTRY,
    limit: '25',
    term: themeTerm(spec),
    entity: 'song',
    media: 'music',
  });
  return `https://itunes.apple.com/search?${query.toString()}`;
}

function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/['’.]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/^(the|a|an) /, '')
    .trim();
}

/** A re-recording that says what it is. Never the original. */
const NOT_ORIGINAL = /karaoke|tribute|made famous|in the style|cover|remix|re ?record|soundalike|piano|ringtone|8 bit|lullaby/;

/**
 * Which search result is the theme: credited to the spec's artist, titled as
 * the recording or the programme, not a karaoke or tribute version. An exact
 * artist credit beats a partial one (a composer "and his orchestra").
 */
export function pickThemeRecording(results: unknown, spec: ThemeSpec): ThemeRecording | null {
  const rows = ((results as { results?: Row[] } | null)?.results ?? []);
  const want = [fold(spec.correct), fold(spec.track)];
  const artist = fold(spec.artist);
  const usable = rows.filter((row): row is Row & Required<Pick<Row, 'trackId' | 'trackName' | 'artistName' | 'previewUrl' | 'trackViewUrl'>> => {
    if (row.kind !== 'song' || row.trackId === undefined) return false;
    if (!row.trackName || !row.artistName || !row.previewUrl || !row.trackViewUrl) return false;
    if (!isItunesPreviewUrl(row.previewUrl)) return false;
    const got = fold(row.artistName);
    if (!(got.includes(artist) || artist.includes(got))) return false;
    const title = fold(row.trackName);
    if (!want.some((name) => title.includes(name))) return false;
    return !NOT_ORIGINAL.test(fold(`${row.trackName} ${row.artistName}`));
  });
  const best = usable.find((row) => fold(row.artistName) === artist) ?? usable[0];
  if (!best) return null;
  return { trackId: best.trackId, previewUrl: best.previewUrl, storeUrl: best.trackViewUrl };
}

export async function buildThemesPack(
  get?: ItunesGet,
): Promise<{ pack: Pack; answers: Record<string, string>; skipped: string[] }> {
  const lookup = get ?? (await cachedItunesGet());
  const answers: Record<string, string> = {};
  const questions = [];
  const skipped: string[] = [];
  for (const spec of THEME_SPECS) {
    const recording = pickThemeRecording(await lookup(themeSearchUrl(spec)), spec);
    if (!recording) {
      skipped.push(spec.slug);
      continue;
    }
    const question: Question = {
      id: stableId(spec.slug),
      source: 'hand',
      question: THEME_PROMPT,
      correct: spec.correct,
      incorrect: spec.incorrect,
      category: 'Theme Tunes',
      difficulty: spec.difficulty,
      previewUrl: recording.previewUrl,
      storeUrl: recording.storeUrl,
      trackId: recording.trackId,
      ...(spec.previewStart && spec.previewStart > 0 ? { previewStart: spec.previewStart } : {}),
      ...(spec.previewSeconds && spec.previewSeconds > 0
        ? { previewSeconds: spec.previewSeconds }
        : {}),
    };
    answers[question.id] = spec.correct;
    questions.push(sealQuestion(question));
  }
  if (questions.length < THEMES_MIN_PACK) {
    throw new Error(
      `Only ${questions.length} themes resolved (need ${THEMES_MIN_PACK}). Skipped: ${skipped.join(', ')}`,
    );
  }
  const meta = PACK_META.themes;
  return {
    pack: { id: 'themes', title: meta.title, blurb: meta.blurb, questions },
    answers,
    skipped,
  };
}

async function main(): Promise<void> {
  console.log('Theme Tunes pack (iTunes GB previews, originals only)');
  const { pack, answers, skipped } = await buildThemesPack();
  console.log(`Resolved ${pack.questions.length} of ${THEME_SPECS.length}.`);
  if (skipped.length > 0) console.warn(`No original recording for ${skipped.length}: ${skipped.join(', ')}`);
  await writeSealedPack(pack, answers, 'themes.json');
}

const runningDirect = process.argv[1]?.includes('write-themes-pack') === true;
if (runningDirect) {
  main().catch((error: unknown) => {
    console.error('write-themes-pack failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
