/**
 * Which album covers print their own title, read off the actual artwork.
 *
 * Run: `npm run sleeve-audit [-- --all] [-- --sheet]`
 *
 * Resolves every album in `hand-sleeves-data.ts` against iTunes GB, downloads
 * the artwork, reads the text on it, and rewrites `sleeve-cover-text.ts` with
 * what it found. The pack builder then refuses any sleeve whose cover names the
 * album — see `write-sleeves-pack.ts`. Prints the verdicts either way; `--all`
 * prints the clean ones too, and `--sheet` writes a labelled contact sheet of
 * everything it cleared, for the pass a person has to do afterwards.
 *
 * **That pass is not optional.** Vision reads printed prose well and stylised
 * cover type badly, and of the 37 sleeves it cleared on 21 September 2026,
 * **eleven print their own title in a form it never saw** — letterspaced,
 * scripted, or upside down in one tile of a grid. Every one of them is obvious
 * in the contact sheet at 190px. They are listed, with what is on them, in
 * `sleeve-refusals.ts`.
 *
 * Needs `uv` and the network, and reads the text with **Apple's Vision
 * framework**, so it is macOS-only — the same trade as `tune-audit` needing
 * `whisper`. Local-only and out of `npm test`, which must keep running offline;
 * the part worth testing is pure and lives in `title-on-cover.ts`.
 *
 * **The verdicts are checked in rather than recomputed at build time.** A build
 * that had to OCR fifty images would need a Mac, a network and 4.8MB of
 * downloads to produce a file that changes about as often as the album list
 * does. Checking the text in makes the gate deterministic, reviewable in a
 * diff, and enforceable by an offline test — and it means the reason a sleeve
 * was dropped is written down next to the drop.
 *
 * **Vision under-reads stylised type, so a clean verdict is the weaker one.**
 * It returned "LONELY HEARTS" for a Sgt. Pepper drum skin that a person reads
 * in full, and nothing at all for the "1989" printed on that sleeve's corner.
 * Every threshold in `title-on-cover.ts` leans towards rejecting for this
 * reason: the machine sees less than the player does, never more.
 */

import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SLEEVE_SPECS } from './hand-sleeves-data';
import { cachedItunesGet, resolveAlbum } from './itunes';
import { artistOnCover, joinCoverText, sleeveVerdict } from './title-on-cover';
import { SLEEVE_HAND_REFUSALS } from './sleeve-refusals';
import { isItunesArtworkUrl } from '../src/lib/apple-media';

const ROOT = join(import.meta.dirname, '..');
const ART = join(ROOT, '.cache', 'sleeve-art');
const OUT = join(import.meta.dirname, 'sleeve-cover-text.ts');

export interface CoverLine {
  text: string;
  confidence: number;
}

/**
 * Reads the text off a batch of images with Apple's Vision framework.
 *
 * One `uv` process for the lot rather than one per image: the interpreter and
 * the framework load dominate, so fifty separate calls spend most of their time
 * starting up. `usesLanguageCorrection` is off deliberately — correction is
 * tuned for prose and turns stylised cover type into confident English words
 * that were never there, which is exactly the wrong failure for a gate.
 */
async function readCovers(paths: string[]): Promise<Record<string, CoverLine[]>> {
  const script = `
import json, sys, pathlib
import Vision
from Foundation import NSURL

def ocr(path):
    url = NSURL.fileURLWithPath_(str(path))
    handler = Vision.VNImageRequestHandler.alloc().initWithURL_options_(url, None)
    req = Vision.VNRecognizeTextRequest.alloc().init()
    req.setRecognitionLevel_(Vision.VNRequestTextRecognitionLevelAccurate)
    req.setUsesLanguageCorrection_(False)
    handler.performRequests_error_([req], None)
    out = []
    for obs in (req.results() or []):
        cand = obs.topCandidates_(1)
        if cand and len(cand):
            c = cand[0]
            out.append({"text": c.string(), "confidence": round(float(c.confidence()), 3)})
    return out

print(json.dumps({p: ocr(p) for p in json.load(sys.stdin)}))
`;
  return new Promise((resolve, reject) => {
    const child = spawn(
      'uv',
      ['run', '--quiet', '--with', 'pyobjc-framework-Vision', 'python', '-c', script],
      { stdio: ['pipe', 'pipe', 'inherit'] },
    );
    let stdout = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Vision OCR exited ${code}. Is \`uv\` on the PATH?`));
        return;
      }
      resolve(JSON.parse(stdout) as Record<string, CoverLine[]>);
    });
    child.stdin.write(JSON.stringify(paths));
    child.stdin.end();
  });
}

interface Row {
  slug: string;
  title: string;
  artist: string;
  path: string;
  /** Why this one is not being read, when it is not. */
  skipped?: string;
}

async function fetchArt(): Promise<Row[]> {
  await mkdir(ART, { recursive: true });
  const lookup = await cachedItunesGet();
  const rows: Row[] = [];
  for (const spec of SLEEVE_SPECS) {
    process.stdout.write(`  ${spec.slug}…`);
    const path = join(ART, `${spec.slug}.jpg`);
    const row: Row = { slug: spec.slug, title: spec.correct, artist: spec.artist, path };
    try {
      const album = await resolveAlbum(
        spec.term,
        spec.artist,
        lookup,
        spec.correct,
        spec.collectionId,
      );
      if (!isItunesArtworkUrl(album.artworkUrl)) throw new Error('artwork is not on mzstatic');
      const response = await fetch(album.artworkUrl);
      if (!response.ok) throw new Error(`artwork ${response.status}`);
      await writeFile(path, Buffer.from(await response.arrayBuffer()));
      console.log(` ${album.name}`);
    } catch (error: unknown) {
      row.skipped = error instanceof Error ? error.message : String(error);
      console.log(` skip — ${row.skipped}`);
    }
    rows.push(row);
  }
  return rows;
}

function asModule(found: Record<string, string>): string {
  const entries = Object.keys(found)
    .sort()
    .map((slug) => `  ${JSON.stringify(slug)}: ${JSON.stringify(found[slug])},`)
    .join('\n');
  return `/**
 * What Apple's Vision framework read off each album cover.
 *
 * **Generated by \`npm run sleeve-audit\`. Do not edit by hand** — rerun it when
 * the album list changes, and commit the diff.
 *
 * Folded to lower-case letters, digits and spaces, with anything Vision was
 * less than 30% sure of dropped. An empty string means it read nothing on that
 * cover, which is the only kind of sleeve this round can safely ask about.
 *
 * \`write-sleeves-pack.ts\` refuses to publish a sleeve whose cover names its own
 * album, and \`title-on-cover.ts\` decides what counts as naming it. Why this is
 * checked in rather than recomputed is in \`sleeve-audit.ts\`.
 */

export const SLEEVE_COVER_TEXT: Record<string, string> = {
${entries}
};
`;
}

/**
 * A labelled grid of every cover that got through, so a person can check them.
 *
 * Python and Pillow because there is no image library in this project's
 * dependencies and adding one to draw a debugging aid would be the tail wagging
 * the dog — the audit already needs `uv` and a Mac for Vision.
 */
async function writeSheet(rows: Row[]): Promise<void> {
  const script = `
import json, sys, pathlib
from PIL import Image, ImageDraw
rows = json.load(sys.stdin)
CELL, LABEL, COLS = 190, 18, 5
lines = (len(rows) + COLS - 1) // COLS
sheet = Image.new("RGB", (COLS * CELL, lines * (CELL + LABEL)), (12, 14, 20))
d = ImageDraw.Draw(sheet)
for i, row in enumerate(rows):
    im = Image.open(row["path"]).convert("RGB").resize((CELL - 6, CELL - 6))
    x, y = (i % COLS) * CELL, (i // COLS) * (CELL + LABEL)
    sheet.paste(im, (x + 3, y + 3))
    d.text((x + 4, y + CELL - 1), f'{i + 1}. {row["slug"][:26]}', fill=(210, 220, 235))
sheet.save(sys.argv[1])
print(sys.argv[1])
`;
  const out = join(ROOT, '.cache', 'sleeve-sheet.png');
  await new Promise<void>((resolve, reject) => {
    const child = spawn('uv', ['run', '--quiet', '--with', 'pillow', 'python', '-c', script, out], {
      stdio: ['pipe', 'inherit', 'inherit'],
    });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`sheet exited ${code}`))));
    child.stdin.write(JSON.stringify(rows.map((row) => ({ slug: row.slug, path: row.path }))));
    child.stdin.end();
  });
  console.log(`\nContact sheet: ${out.replace(ROOT, '.')} — look at it before trusting this list.`);
}

async function main(): Promise<void> {
  const showAll = process.argv.includes('--all');
  console.log('Sleeve audit — resolving artwork');
  const rows = await fetchArt();

  const readable = rows.filter((row) => row.skipped === undefined);
  console.log(`\nReading text off ${readable.length} covers with Vision…`);
  const text = await readCovers(readable.map((row) => row.path));

  const found: Record<string, string> = {};
  for (const row of readable) {
    found[row.slug] = joinCoverText(text[row.path] ?? []);
  }
  await writeFile(OUT, asModule(found));

  const bad: string[] = [];
  const named: string[] = [];
  console.log('');
  for (const row of readable) {
    const cover = found[row.slug] ?? '';
    const byHand = SLEEVE_HAND_REFUSALS[row.slug];
    if (byHand !== undefined) {
      bad.push(row.slug);
      console.log(`  REFUSED  ${row.slug.padEnd(28)} ${byHand} (by eye)`);
      continue;
    }
    const verdict = sleeveVerdict(row.title, row.artist, cover);
    if (!verdict.publishable) {
      bad.push(row.slug);
      console.log(`  REFUSED  ${row.slug.padEnd(28)} ${verdict.why}`);
      continue;
    }
    if (artistOnCover(row.artist, cover)) named.push(row.slug);
    if (showAll) console.log(`  ok       ${row.slug.padEnd(28)} ${cover || '(no text)'}`);
  }

  if (process.argv.includes('--sheet')) await writeSheet(readable.filter((row) => !bad.includes(row.slug)));

  const skipped = rows.filter((row) => row.skipped !== undefined);
  if (skipped.length > 0) {
    console.log(`\n${skipped.length} could not be resolved:`);
    for (const row of skipped) console.log(`  ${row.slug}: ${row.skipped}`);
  }
  if (named.length > 0) {
    console.log(
      `\n${named.length} cover(s) name the artist but not the album. Harmless where all four`
        + `\noptions are by that artist, a narrowing where they are not — your call:`
        + `\n  ${named.join(', ')}`,
    );
  }
  console.log(
    `\n${bad.length} of ${readable.length} refused.`
      + ` ${readable.length - bad.length} are publishable.`,
  );
  console.log(`Written to ${OUT.replace(ROOT, '.')}`);
}

const runningDirect = process.argv[1]?.includes('sleeve-audit') === true;
if (runningDirect) {
  main().catch((error: unknown) => {
    console.error('sleeve-audit failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
