/**
 * Draws the Catchphrase pictures on this Mac with Z-Image-Turbo, through mflux.
 *
 *   npm run catchphrase-draw                       # every spec, three versions each
 *   npm run catchphrase-draw -- --only <slug>,…    # some, e.g. after a scene rewrite
 *   npm run catchphrase-draw -- --only <slug> --force
 *
 * Needs `mflux` (`uv tool install --upgrade mflux`) and an 8-bit copy of the
 * model saved once with `mflux-save`. Quantising at load held 28 GB on a 24 GB
 * Mac and ran at 70 s a step; the saved copy runs at 11–13 s. Set
 * `CATCHPHRASE_MODEL` if the copy is not at the default path. Every number here
 * is in docs/decisions/catchphrase.md.
 *
 * Writes `.cache/catchphrase/<slug>_seed_<n>.png` and never `public/`: a drawing
 * ships only once somebody has looked at it and set `seed` on its spec. Then
 * reads any writing off every drawing with Apple's Vision — the same call
 * `sleeve-audit` makes — into `.cache/catchphrase/text.json`.
 *
 * Not part of the build or the tests: thirty specs take about 2.8 hours.
 */

import { spawn } from 'node:child_process';
import { access, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { CATCHPHRASE_SPECS, promptFor, type CatchphraseSpec } from './hand-catchphrase-data';
import { readCovers } from './sleeve-audit';

export const DRAW_DIR = join(import.meta.dirname, '..', '.cache', 'catchphrase');
export const DRAW_TEXT = join(DRAW_DIR, 'text.json');
export const DRAW_SEEDS = [1, 2, 3] as const;
const DEFAULT_MODEL = join(homedir(), '.cache', 'mflux-saved', 'z-image-turbo-q8');

/** Where mflux puts one version: it appends `_seed_<n>` when given several seeds. */
export function drawingPath(slug: string, seed: number, dir = DRAW_DIR): string {
  return join(dir, `${slug}_seed_${seed}.png`);
}

/**
 * The mflux arguments for one spec.
 *
 * **`--no-metadata` is the seal.** Without it mflux embeds generation metadata
 * in the image ("EXIF UserComment and friends", per its help), and the prompt
 * describes the answer. A probe without it carried its prompt through
 * `compressStill` into the published JPEG; `seal.test.ts` scans for exactly that.
 */
export function drawArgs(spec: CatchphraseSpec, model: string, dir = DRAW_DIR): string[] {
  return [
    '--model', model,
    '--base-model', 'z-image-turbo',
    '--prompt', promptFor(spec),
    '--width', '1024',
    '--height', '768',
    '--steps', '9',
    '--seed', ...DRAW_SEEDS.map(String),
    '--no-metadata',
    '--output', join(dir, `${spec.slug}.png`),
  ];
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function run(command: string, args: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  });
}

function onlyArg(): Set<string> | null {
  const at = process.argv.indexOf('--only');
  if (at < 0) return null;
  return new Set((process.argv[at + 1] ?? '').split(',').filter(Boolean));
}

async function main(): Promise<void> {
  const model = process.env.CATCHPHRASE_MODEL ?? DEFAULT_MODEL;
  if (!(await exists(model))) {
    throw new Error(
      `No saved model at ${model}. Save one first:\n  mflux-save --model z-image-turbo --quantize 8 --path ${model}`,
    );
  }
  const only = onlyArg();
  const force = process.argv.includes('--force');
  const unknown = [...(only ?? [])].filter((slug) => !CATCHPHRASE_SPECS.some((spec) => spec.slug === slug));
  if (unknown.length > 0) throw new Error(`No spec called ${unknown.join(', ')}`);

  await mkdir(DRAW_DIR, { recursive: true });
  const failed: string[] = [];
  let drawn = 0;
  for (const spec of CATCHPHRASE_SPECS) {
    if (only && !only.has(spec.slug)) continue;
    const have = await Promise.all(DRAW_SEEDS.map((seed) => exists(drawingPath(spec.slug, seed))));
    if (!force && have.every(Boolean)) {
      console.log(`  ${spec.slug}: already drawn`);
      continue;
    }
    console.log(`=== ${spec.slug} ${new Date().toISOString()}`);
    // mflux never overwrites: given a name that exists it writes `<name>_1.png`
    // beside it, so a redraw would leave the old drawing where the pack writer
    // reads. Found on 2 October 2026, when five redraws reviewed as unchanged.
    await Promise.all(DRAW_SEEDS.map((seed) => rm(drawingPath(spec.slug, seed), { force: true })));
    const code = await run('mflux-generate-z-image-turbo', drawArgs(spec, model));
    if (code === 0) drawn += 1;
    else failed.push(`${spec.slug} (exit ${code})`);
  }

  const pictures = (await readdir(DRAW_DIR)).filter((name) => name.endsWith('.png')).sort();
  console.log(`\nReading any writing off ${pictures.length} drawings with Vision…`);
  const read = await readCovers(pictures.map((name) => join(DRAW_DIR, name)));
  const text = Object.fromEntries(
    pictures.map((name) => [name, (read[join(DRAW_DIR, name)] ?? []).map((line) => line.text)]),
  );
  await writeFile(DRAW_TEXT, `${JSON.stringify(text, null, 2)}\n`);

  const lettered = Object.entries(text).filter(([, lines]) => lines.length > 0);
  console.log(`Drew ${drawn}; ${lettered.length} drawings carry writing:`);
  for (const [name, lines] of lettered) console.log(`  ${name}: ${lines.join(' / ')}`);
  if (failed.length > 0) {
    console.error(`Failed: ${failed.join(', ')}`);
    process.exitCode = 1;
  }
}

const runningDirect = process.argv[1]?.includes('catchphrase-draw') === true;
if (runningDirect) {
  main().catch((error: unknown) => {
    console.error('catchphrase-draw failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
