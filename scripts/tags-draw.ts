/**
 * Draws The Price is Right pictures on this Mac with Z-Image-Turbo, through
 * mflux — the MacBook, not the Mini (Greg, 20 October 2026: the Mini was never
 * finished after its crashes). Run it yourself, on the charger, lid open:
 *
 *   npm run tags-draw
 *
 * Draws two versions of every spec not yet drawn, reads any writing off them
 * with Apple's Vision into `.cache/price-is-right/text.json`, and leaves contact
 * sheets numbered by place in the spec list. Pauses off the charger or under
 * 30%, as `draw-overnight` does; stopping it is safe, and a rerun carries on.
 *
 * **Refuses to start until `TAGS_STYLE` is set**: Greg approves the look first,
 * from samples of objects that are not in the pack.
 *
 * Not part of the build or the tests. See docs/decisions/price-is-right.md.
 */

import { execFile, spawn } from 'node:child_process';
import { access, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { savedModel } from './catchphrase-draw';
import { parseBattery, shouldDraw, writeSheet, type Battery, type SheetCell } from './draw-overnight';
import { TAG_SPECS, type TagSpec } from './hand-tags-data';
import { readCovers } from './sleeve-audit';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const TAGS_DIR = join(import.meta.dirname, '..', '.cache', 'price-is-right');
export const TAGS_TEXT = join(TAGS_DIR, 'text.json');
export const TAGS_SEEDS = [1, 2] as const;
const SHEET_DIR = join(TAGS_DIR, 'sheets');
/** Six items, two versions each, three a row: a sheet four rows tall. */
const ITEMS_PER_SHEET = 6;

const NO_WRITING = 'no text, no words, no letters, no numbers, no labels, no logos, no price tag, no packaging';

/** The three looks drawn for Greg on 20 October 2026, as `{object}` around the spec's `picture`. */
export const TAG_STYLES = {
  catalogue: `Studio product photograph of {object}, centred, whole object in frame, on a seamless pale grey background, soft even lighting, gentle shadow underneath, sharp focus, ${NO_WRITING}`,
  podium: `Photograph of {object} displayed as a television game show prize on a glossy round podium, deep navy blue studio behind, spotlights, soft cyan and amber stage lights, whole object in frame, sharp focus, ${NO_WRITING}`,
  illustrated: `Clean flat vector illustration of {object}, bold simple shapes, thick dark outlines, limited palette of navy, cyan, white and amber, plain dark blue background, centred, whole object in frame, ${NO_WRITING}`,
} as const;

export type TagStyle = keyof typeof TAG_STYLES;

/** Greg's pick. Null until he has seen the samples. */
export const TAGS_STYLE: TagStyle | null = null;

export function tagPrompt(spec: TagSpec, style: TagStyle): string {
  return TAG_STYLES[style].replace('{object}', spec.picture);
}

/** Where mflux puts one version: it appends `_seed_<n>` when given several seeds. */
export function tagDrawingPath(slug: string, seed: number, dir = TAGS_DIR): string {
  return join(dir, `${slug}_seed_${seed}.png`);
}

/** `--no-metadata` keeps the prompt out of the file, as it does for Catchphrase. */
export function tagDrawArgs(spec: TagSpec, style: TagStyle, model: string, dir = TAGS_DIR): string[] {
  return [
    '--model', model,
    '--base-model', 'z-image-turbo',
    '--prompt', tagPrompt(spec, style),
    '--width', '1024',
    '--height', '768',
    '--steps', '9',
    '--seed', ...TAGS_SEEDS.map(String),
    '--no-metadata',
    '--output', join(dir, `${spec.slug}.png`),
  ];
}

/** Every drawn spec with no `seed` yet and not dropped, both versions, numbered by place in the list. */
export function tagSheets(specs: readonly TagSpec[], drawn: (slug: string) => boolean): SheetCell[][] {
  const waiting = specs
    .map((spec, i) => ({ spec, number: i + 1 }))
    .filter(({ spec }) => spec.seed === undefined && spec.dropped === undefined && drawn(spec.slug));
  const sheets: SheetCell[][] = [];
  for (let start = 0; start < waiting.length; start += ITEMS_PER_SHEET) {
    sheets.push(
      waiting.slice(start, start + ITEMS_PER_SHEET).flatMap(({ spec, number }) =>
        TAGS_SEEDS.map((seed) => ({ number, seed, slug: spec.slug, path: tagDrawingPath(spec.slug, seed) })),
      ),
    );
  }
  return sheets;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function isDrawn(spec: TagSpec): Promise<boolean> {
  const have = await Promise.all(TAGS_SEEDS.map((seed) => exists(tagDrawingPath(spec.slug, seed))));
  return have.every(Boolean);
}

function run(command: string, args: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  });
}

async function battery(): Promise<Battery> {
  const { stdout } = await execFileAsync('pmset', ['-g', 'batt']);
  const read = parseBattery(stdout);
  if (!read) throw new Error(`pmset said nothing recognisable:\n${stdout}`);
  return read;
}

async function main(): Promise<void> {
  const style = TAGS_STYLE;
  if (style === null) {
    throw new Error('No TAGS_STYLE yet — Greg approves the look from the samples first (price-is-right.md).');
  }
  const model = await savedModel();
  await mkdir(TAGS_DIR, { recursive: true });
  const first = await battery();
  if (!first.onMains) throw new Error('On battery. A long draw holds the MacBook flat; plug it in first.');
  // Keep the Mac awake while this process lives. Leave the lid open.
  spawn('caffeinate', ['-i', '-s', '-w', String(process.pid)], { stdio: 'ignore', detached: true }).unref();

  let paused = false;
  let drawn = 0;
  const failed: string[] = [];
  for (const spec of TAG_SPECS) {
    if (spec.dropped !== undefined || spec.seed !== undefined || (await isDrawn(spec))) continue;
    for (;;) {
      const now = await battery();
      if (shouldDraw(now, paused)) break;
      paused = true;
      console.log(`Paused: ${now.onMains ? 'on mains' : 'on battery'}, ${now.percent ?? '?'}%`);
      await new Promise((resolve) => setTimeout(resolve, 5 * 60_000));
    }
    paused = false;
    // mflux never overwrites; clear half-drawn versions first.
    await Promise.all(TAGS_SEEDS.map((seed) => rm(tagDrawingPath(spec.slug, seed), { force: true })));
    const code = await run('mflux-generate-z-image-turbo', tagDrawArgs(spec, style, model));
    if (code === 0) drawn += 1;
    else failed.push(spec.slug);
  }

  const pictures = (await readdir(TAGS_DIR)).filter((name) => name.endsWith('.png')).sort();
  const read = await readCovers(pictures.map((name) => join(TAGS_DIR, name)));
  const text = Object.fromEntries(pictures.map((name) => [name, (read[join(TAGS_DIR, name)] ?? []).map((line) => line.text)]));
  await writeFile(TAGS_TEXT, `${JSON.stringify(text, null, 2)}\n`);
  const withWriting = Object.values(text).filter((lines) => lines.length > 0).length;

  await mkdir(SHEET_DIR, { recursive: true });
  const drawnNow = new Set<string>();
  for (const spec of TAG_SPECS) if (await isDrawn(spec)) drawnNow.add(spec.slug);
  const sheets = tagSheets(TAG_SPECS, (slug) => drawnNow.has(slug));
  for (const [i, cells] of sheets.entries()) {
    await writeSheet(cells, join(SHEET_DIR, `sheet-${String(i + 1).padStart(2, '0')}.png`));
  }

  // Counts only.
  console.log(`Drew ${drawn}, ${failed.length} failed${failed.length > 0 ? ` (${failed.join(', ')})` : ''}.`);
  console.log(`${withWriting} of ${pictures.length} drawings carry writing; ${sheets.length} sheets in ${SHEET_DIR}.`);
}

const runningDirect = process.argv[1]?.includes('tags-draw') === true;
if (runningDirect) {
  main().catch((error: unknown) => {
    console.error('tags-draw failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
