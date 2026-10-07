/**
 * Draws every Catchphrase puzzle still waiting for its pictures, unattended,
 * and leaves contact sheets for the morning. Run it yourself before bed:
 *
 *   npm run draw-overnight
 *
 * Greg, 7 October 2026: "Ideally I could just run that overnight without
 * spending tokens — then pick up the output after to wire everything in." The
 * drawing never needed a session; the tokens went on keeping one open for a
 * 2.8-hour draw and on reading ~90 full-size drawings one at a time to pick
 * versions. This is the first half without a session. The second half reads a
 * handful of sheets instead of ninety pictures.
 *
 * **Greg plays Catchphrase blind: do not open the sheets.** They are for the
 * pick, which Claude makes. Everything this prints is counts and numbers.
 *
 * What it does, in order:
 *
 * 1. Refuses to start on battery. A long draw holds the MacBook flat even on
 *    the charger (5 October 2026), so it never starts without one.
 * 2. Keeps the Mac awake for as long as it runs (`caffeinate -i -s -w <pid>`).
 *    `caffeinate`'s man page says nothing about a closed lid: **leave it open.**
 * 3. Draws each undrawn spec, three versions, exactly as `catchphrase-draw`
 *    does. Between puzzles it checks the battery: below {@link PAUSE_BELOW}% or
 *    off the charger it pauses, and resumes at {@link RESUME_AT}% on the
 *    charger. Stopping it is safe at any point; run it again to carry on.
 * 4. Reads any writing off the drawings with Vision (`text.json`), as before.
 * 5. Writes contact sheets of every puzzle with no `seed` yet — numbered by
 *    place in the spec list, never by slug — and a key from number to slug.
 * 6. Writes `run.json` and tells the Mac's notification centre it is done.
 *
 * Not part of the build or the tests (`main` runs only when invoked directly).
 */

import { spawn, execFile } from 'node:child_process';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import {
  DRAW_DIR,
  DRAW_SEEDS,
  drawOne,
  drawingPath,
  isDrawn,
  readDrawings,
  savedModel,
} from './catchphrase-draw';
import { CATCHPHRASE_SPECS, type CatchphraseSpec } from './hand-catchphrase-data';

const execFileAsync = promisify(execFile);

/** Pause the batch below this charge, between puzzles. */
export const PAUSE_BELOW = 30;
/** Resume once back at this charge, on the charger. */
export const RESUME_AT = 50;
/** How often a paused batch looks at the battery again. */
const PAUSE_POLL_MS = 5 * 60_000;
/**
 * Four puzzles, three versions each, at 400×300: a 1200×1288 sheet. Twelve made
 * a sheet 3,864px tall, which an image reader scales until a drawing is about
 * 160px wide — too small to judge lettering or a face. Four keeps every drawing
 * at full cell size and still reads 30 puzzles in 8 images rather than 90.
 */
export const PUZZLES_PER_SHEET = 4;

export const SHEET_DIR = join(DRAW_DIR, 'sheets');
export const RUN_FILE = join(DRAW_DIR, 'run.json');
const LOG_FILE = join(DRAW_DIR, 'draw.log');

export interface Battery {
  onMains: boolean;
  /** Null on a Mac with no battery. */
  percent: number | null;
}

/** What `pmset -g batt` says, or null if it said nothing recognisable. */
export function parseBattery(text: string): Battery | null {
  const source = /Now drawing from '([^']+)'/.exec(text)?.[1];
  if (!source) return null;
  const percent = /(\d+)%/.exec(text)?.[1];
  return { onMains: source === 'AC Power', percent: percent === undefined ? null : Number(percent) };
}

/**
 * Whether to draw the next puzzle. Pauses off the charger or below the floor,
 * and once paused waits for {@link RESUME_AT} rather than flapping at the floor.
 */
export function shouldDraw(battery: Battery, paused: boolean): boolean {
  if (!battery.onMains) return false;
  if (battery.percent === null) return true;
  return battery.percent >= (paused ? RESUME_AT : PAUSE_BELOW);
}

export interface SheetCell {
  /** Place in `CATCHPHRASE_SPECS`, from 1. What the pick is written in. */
  number: number;
  seed: number;
  slug: string;
  path: string;
}

/** Every drawn puzzle with no `seed` yet, three versions each, {@link PUZZLES_PER_SHEET} puzzles a sheet. */
export function sheetsFor(
  specs: readonly CatchphraseSpec[],
  drawn: (slug: string) => boolean,
): SheetCell[][] {
  const waiting = specs
    .map((spec, i) => ({ spec, number: i + 1 }))
    .filter(({ spec }) => spec.seed === undefined && drawn(spec.slug));
  const sheets: SheetCell[][] = [];
  for (let start = 0; start < waiting.length; start += PUZZLES_PER_SHEET) {
    sheets.push(
      waiting.slice(start, start + PUZZLES_PER_SHEET).flatMap(({ spec, number }) =>
        DRAW_SEEDS.map((seed) => ({ number, seed, slug: spec.slug, path: drawingPath(spec.slug, seed) })),
      ),
    );
  }
  return sheets;
}

/** What a cell says under its picture. A number and a version: the round is blind. */
export function cellLabel(cell: SheetCell): string {
  return `${cell.number} · v${cell.seed}`;
}

async function log(line: string): Promise<void> {
  const stamped = `${new Date().toISOString()} ${line}`;
  console.log(stamped);
  await appendFile(LOG_FILE, `${stamped}\n`);
}

async function battery(): Promise<Battery> {
  const { stdout } = await execFileAsync('pmset', ['-g', 'batt']);
  const read = parseBattery(stdout);
  if (!read) throw new Error(`pmset said nothing recognisable:\n${stdout}`);
  return read;
}

function notify(message: string): void {
  // Counts only: this lands on the lock screen.
  const script = `display notification ${JSON.stringify(message)} with title "Quiz drawing"`;
  spawn('osascript', ['-e', script], { stdio: 'ignore' }).on('error', (cause) => {
    console.error('Could not post the notification:', cause.message);
  });
}

/** One sheet as a PNG: three versions a row, labelled by number. Pillow under `uv`, as `sleeve-audit` does. */
export async function writeSheet(cells: readonly SheetCell[], out: string): Promise<void> {
  const script = `
import json, sys
from PIL import Image, ImageDraw
cells = json.load(sys.stdin)
W, H, LABEL, COLS = 400, 300, 22, 3
rows = (len(cells) + COLS - 1) // COLS
sheet = Image.new("RGB", (COLS * W, rows * (H + LABEL)), (12, 14, 20))
d = ImageDraw.Draw(sheet)
for i, cell in enumerate(cells):
    im = Image.open(cell["path"]).convert("RGB").resize((W - 6, H - 6))
    x, y = (i % COLS) * W, (i // COLS) * (H + LABEL)
    sheet.paste(im, (x + 3, y + 3))
    d.text((x + 6, y + H + 3), cell["label"], fill=(210, 220, 235))
sheet.save(sys.argv[1])
`;
  await new Promise<void>((resolve, reject) => {
    const child = spawn('uv', ['run', '--quiet', '--with', 'pillow', 'python', '-c', script, out], {
      stdio: ['pipe', 'inherit', 'inherit'],
    });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`sheet exited ${code}`))));
    child.stdin.write(JSON.stringify(cells.map((cell) => ({ path: cell.path, label: cellLabel(cell) }))));
    child.stdin.end();
  });
}

async function main(): Promise<void> {
  await mkdir(SHEET_DIR, { recursive: true });
  const startedAt = new Date().toISOString();

  const atStart = await battery();
  if (!atStart.onMains) {
    throw new Error('On battery. Plug the charger in first — a draw holds the battery flat even on mains.');
  }
  const model = await savedModel();

  // Released when this process exits, however it exits.
  spawn('caffeinate', ['-i', '-s', '-w', String(process.pid)], { stdio: 'ignore', detached: true }).unref();

  const pending: { spec: CatchphraseSpec; number: number }[] = [];
  for (const [i, spec] of CATCHPHRASE_SPECS.entries()) {
    if (!(await isDrawn(spec))) pending.push({ spec, number: i + 1 });
  }
  await log(`Starting: ${pending.length} puzzles to draw, battery ${atStart.percent ?? '—'}%.`);

  const minutes: number[] = [];
  const failed: number[] = [];
  let pauses = 0;
  let paused = false;
  for (const { spec, number } of pending) {
    for (;;) {
      const now = await battery();
      if (shouldDraw(now, paused)) break;
      if (!paused) {
        pauses += 1;
        await log(`Paused: ${now.onMains ? 'on mains' : 'on battery'}, ${now.percent ?? '—'}%.`);
      }
      paused = true;
      await new Promise((resolve) => setTimeout(resolve, PAUSE_POLL_MS));
    }
    if (paused) await log('Resumed.');
    paused = false;

    const began = Date.now();
    await log(`Puzzle ${number}: drawing.`);
    const code = await drawOne(spec, model);
    minutes.push((Date.now() - began) / 60_000);
    if (code !== 0) failed.push(number);
    await log(`Puzzle ${number}: ${code === 0 ? 'done' : `failed, exit ${code}`}.`);
  }

  await log('Reading any writing off the drawings with Vision.');
  const lettered = await readDrawings();

  const drawnNow = new Set<string>();
  for (const spec of CATCHPHRASE_SPECS) if (await isDrawn(spec)) drawnNow.add(spec.slug);
  const sheets = sheetsFor(CATCHPHRASE_SPECS, (slug) => drawnNow.has(slug));
  const sheetFiles: string[] = [];
  for (const [i, cells] of sheets.entries()) {
    const out = join(SHEET_DIR, `sheet-${String(i + 1).padStart(2, '0')}.png`);
    await writeSheet(cells, out);
    sheetFiles.push(out);
  }
  // Number to slug, for wiring the pick in. A file, never printed.
  const key = Object.fromEntries(sheets.flat().map((cell) => [cell.number, cell.slug]));
  await writeFile(join(SHEET_DIR, 'key.json'), `${JSON.stringify(key, null, 2)}\n`);

  const summary = {
    startedAt,
    finishedAt: new Date().toISOString(),
    drawn: pending.length - failed.length,
    failed,
    pauses,
    minutesEach: minutes.map((m) => Math.round(m * 10) / 10),
    lettered: Object.keys(lettered).length,
    waitingForAPick: Object.keys(key).length,
    sheets: sheetFiles,
  };
  await writeFile(RUN_FILE, `${JSON.stringify(summary, null, 2)}\n`);
  await log(
    `Done: drew ${summary.drawn}, ${failed.length} failed, ${pauses} pauses; `
      + `${summary.waitingForAPick} puzzles on ${sheetFiles.length} sheets.`,
  );
  notify(`Drew ${summary.drawn}, ${failed.length} failed. ${sheetFiles.length} sheets ready.`);
  if (failed.length > 0) process.exitCode = 1;
}

const runningDirect = process.argv[1]?.includes('draw-overnight') === true;
if (runningDirect) {
  main().catch(async (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error('draw-overnight failed:', message);
    notify('Drawing stopped with an error — see .cache/catchphrase/draw.log.');
    await appendFile(LOG_FILE, `${new Date().toISOString()} failed: ${message}\n`).catch((cause: unknown) => {
      console.error('Could not write the log either:', cause);
    });
    process.exitCode = 1;
  });
}
