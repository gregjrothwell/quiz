/**
 * Which tune clips say their own name, and where.
 *
 * Run: `npm run tune-audit [-- --window 15]`
 *
 * Downloads every preview in `public/packs/tunes.json`, transcribes it, and
 * reports the moments the title is sung — then prints the `previewStart` /
 * `previewSeconds` to paste into `hand-tunes-data.ts`. Nothing is written to
 * the pack: the numbers go into the spec file by hand, because a clip that has
 * been listened to is worth more than one a transcriber guessed at.
 *
 * Needs `whisper` on the PATH (`brew install openai-whisper`) and the network.
 * Local-only, like `itunes-probe` — out of `npm test`, which must keep running
 * offline. The part worth testing is pure and lives in `title-in-clip.ts`.
 *
 * **`medium.en`, not `small.en`, and that is a measured choice.** On the Sweet
 * Caroline preview small.en returned "The sweet, terrible life" for "Sweet
 * Caroline, good times" — the title mangled past any matcher. medium.en gets it
 * word for word. Roughly 20 seconds a clip on an M-series CPU; MPS is not an
 * option, whisper's decoder wants float64 and Metal has none.
 */

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { TUNE_SPECS } from './hand-tunes-data';
import { stableId } from './write-hand-packs';
import { chooseClip, titleHits, type TranscriptWord } from './title-in-clip';
import type { Pack } from '../src/questions/types';

const ROOT = join(import.meta.dirname, '..');
const PREVIEWS = join(ROOT, '.cache', 'tune-previews');
const TRANSCRIPTS = join(ROOT, '.cache', 'tune-transcripts');
const MODEL = 'medium.en';

interface Row {
  slug: string;
  title: string;
  artist: string;
  url: string;
  /** So a rebuilt pack that moved a track re-fetches instead of reusing. */
  stamp: string;
}

async function rows(): Promise<Row[]> {
  const pack = JSON.parse(
    await readFile(join(ROOT, 'public', 'packs', 'tunes.json'), 'utf8'),
  ) as Pack;
  const byId = new Map(pack.questions.map((question) => [question.id, question]));
  const out: Row[] = [];
  for (const spec of TUNE_SPECS) {
    const question = byId.get(stableId(spec.slug));
    if (!question?.previewUrl) continue;
    out.push({
      slug: spec.slug,
      title: spec.correct,
      artist: spec.artist,
      url: question.previewUrl,
      stamp: createHash('sha1').update(question.previewUrl).digest('hex').slice(0, 10),
    });
  }
  return out;
}

async function fetchPreviews(list: Row[]): Promise<void> {
  await mkdir(PREVIEWS, { recursive: true });
  let fetched = 0;
  for (const row of list) {
    const stampFile = join(PREVIEWS, `${row.slug}.url`);
    const current = await readFile(stampFile, 'utf8').catch(() => '');
    if (current === row.stamp) continue;
    const response = await fetch(row.url);
    if (!response.ok) throw new Error(`${row.slug}: preview ${response.status}`);
    await writeFile(join(PREVIEWS, `${row.slug}.m4a`), Buffer.from(await response.arrayBuffer()));
    await writeFile(stampFile, row.stamp);
    fetched += 1;
  }
  console.log(`Previews: ${fetched} fetched, ${list.length - fetched} already here`);
}

/**
 * One whisper process for the whole batch, not one per clip.
 *
 * The model is half a gigabyte and loading it is most of a short clip's cost;
 * the CLI takes a list of files and loads it once, so a re-run of 177 tunes is
 * transcription time rather than 177 model loads.
 */
async function transcribe(missing: string[]): Promise<void> {
  if (missing.length === 0) return;
  await mkdir(TRANSCRIPTS, { recursive: true });
  console.log(`Transcribing ${missing.length} clips with ${MODEL} — around 20s each.`);
  const args = [
    ...missing.map((slug) => join(PREVIEWS, `${slug}.m4a`)),
    '--model', MODEL,
    '--language', 'en',
    '--word_timestamps', 'True',
    '--output_format', 'json',
    '--output_dir', TRANSCRIPTS,
    '--verbose', 'False',
  ];
  await new Promise<void>((resolve, reject) => {
    const child = spawn('whisper', args, { stdio: ['ignore', 'inherit', 'inherit'] });
    child.on('error', (error: NodeJS.ErrnoException) => {
      reject(
        error.code === 'ENOENT'
          ? new Error('whisper is not on the PATH — `brew install openai-whisper`')
          : error,
      );
    });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`whisper exited ${String(code)}`));
    });
  });
}

interface WhisperJson {
  segments?: { words?: { word: string; start: number; end: number }[] }[];
}

async function readTranscript(slug: string): Promise<TranscriptWord[] | null> {
  const raw = await readFile(join(TRANSCRIPTS, `${slug}.json`), 'utf8').catch(() => null);
  if (raw === null) return null;
  const data = JSON.parse(raw) as WhisperJson;
  return (data.segments ?? []).flatMap((segment) =>
    (segment.words ?? []).map((word) => ({
      word: word.word.trim(),
      start: word.start,
      end: word.end,
    })),
  );
}

async function main(): Promise<void> {
  const windowArg = process.argv.indexOf('--window');
  const window = windowArg > 0 ? Number(process.argv[windowArg + 1]) : 15;

  const list = await rows();
  await fetchPreviews(list);

  const done = new Set(
    (await readdir(TRANSCRIPTS).catch(() => [] as string[]))
      .filter((name) => name.endsWith('.json'))
      .map((name) => name.replace(/\.json$/, '')),
  );
  await transcribe(list.filter((row) => !done.has(row.slug)).map((row) => row.slug));

  const verdicts: Record<string, number> = { clean: 0, trimmed: 0, shifted: 0, unavoidable: 0 };
  const changes: string[] = [];
  for (const row of list) {
    const transcript = await readTranscript(row.slug);
    if (transcript === null) {
      console.log(`  ${row.slug}: no transcript`);
      continue;
    }
    const hits = titleHits(row.title, transcript);
    const choice = chooseClip(hits, { window });
    verdicts[choice.verdict] = (verdicts[choice.verdict] ?? 0) + 1;
    if (choice.verdict === 'clean') continue;
    console.log(
      `  ${row.slug.padEnd(32)} ${choice.verdict.padEnd(12)} ${choice.note}`
      + `  [heard: ${hits.map((hit) => hit.heard).join(' / ')}]`,
    );
    if (choice.verdict === 'unavoidable') continue;
    const parts = [
      choice.previewStart > 0 ? `previewStart: ${choice.previewStart}` : '',
      choice.previewSeconds !== undefined ? `previewSeconds: ${choice.previewSeconds}` : '',
    ].filter(Boolean);
    changes.push(`  ${row.slug}: ${parts.join(', ')}`);
  }

  console.log(`\nOn a ${window}s window, of ${list.length} tunes:`);
  for (const [verdict, count] of Object.entries(verdicts)) console.log(`  ${verdict}: ${count}`);
  console.log(`\nPaste into hand-tunes-data.ts:\n${changes.join('\n')}`);
}

const runningDirect = process.argv[1]?.includes('tune-title-audit') === true;
if (runningDirect) {
  main().catch((error: unknown) => {
    console.error('tune-title-audit failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
