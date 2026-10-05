/**
 * Which packs the office is running out of. Run with:
 *
 *   npm run freshness                 the table, nothing else
 *   npm run freshness -- --notify     and a macOS notification if a played pack is low
 *   npm run freshness -- --if-due     only on a weekday from 08:00, once a day
 *   npm run freshness -- --low-below 100 --notify   force the alarm, to prove it
 *
 * A Claude scheduled task, `quiz-pack-freshness`, runs `--if-due --notify` on
 * weekdays at 08:00, and on next launch if the app was closed. Not launchd:
 * macOS will not let a background job read ~/Documents without a privacy grant,
 * found on 5 October 2026. docs/decisions/pack-freshness.md.
 *
 *
 * Read-only, through the Admin SDK: listing the `asked` subcollections and
 * querying `games/` are both refused to clients. Never imports `src/firebase.ts`.
 */

import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import {
  LOW_BELOW,
  WINDOW_DAYS,
  freshness,
  isDue,
  localDay,
  notificationFor,
  type FreshnessRow,
  type PackIds,
  type PlayedRound,
} from './freshness-core';

const ROOT = join(import.meta.dirname, '..');
const PACKS = join(ROOT, 'public', 'packs');
const CACHE = join(ROOT, '.cache');
const LATEST = join(CACHE, 'freshness-latest.txt');
const STAMP = join(CACHE, 'freshness-stamp');
const FAILED_STAMP = join(CACHE, 'freshness-failed');

const execFileAsync = promisify(execFile);

function flag(name: string): boolean {
  return process.argv.includes(name);
}

function lowBelow(): number {
  const at = process.argv.indexOf('--low-below');
  const value = at >= 0 ? Number(process.argv[at + 1]) : LOW_BELOW;
  if (!Number.isFinite(value) || value <= 0) throw new Error('--low-below takes a positive number');
  return value;
}

async function readText(path: string): Promise<string | null> {
  return readFile(path, 'utf8').then((text) => text.trim(), () => null);
}

/** Every published pack, from the same index the lobby reads. */
async function publishedPacks(): Promise<PackIds[]> {
  const index = JSON.parse(await readFile(join(PACKS, 'index.json'), 'utf8')) as { id: string; title: string }[];
  return Promise.all(
    index.map(async ({ id, title }) => {
      const pack = JSON.parse(await readFile(join(PACKS, `${id}.json`), 'utf8')) as { questions: { id: string }[] };
      return { id, title, ids: pack.questions.map((question) => question.id) };
    }),
  );
}

/**
 * The asked ids of the season most recently written to. The client's `SEASON`
 * lives in a module that loads Firebase, which a script must never import, and
 * a hardcoded copy goes stale — `take-stock` learned that. The live season is
 * the one rounds are writing to.
 */
async function currentAsked(db: FirebaseFirestore.Firestore): Promise<{ season: string; asked: Record<string, string[]> }> {
  const parents = await db.collection('seasons').listDocuments();
  const seasons = await Promise.all(
    parents.map(async (parent) => {
      const docs = (await parent.collection('asked').get()).docs;
      const latest = Math.max(0, ...docs.map((entry) => {
        const at = entry.get('at') as unknown;
        return typeof at === 'number' ? at : 0;
      }));
      const asked = Object.fromEntries(
        docs.map((entry) => {
          const ids = entry.get('ids') as unknown;
          return [entry.id, Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []];
        }),
      );
      return { season: parent.id, latest, asked };
    }),
  );
  const live = seasons.sort((a, b) => b.latest - a.latest)[0];
  if (!live) throw new Error('No season has an asked history');
  return { season: live.season, asked: live.asked };
}

async function recentRounds(db: FirebaseFirestore.Firestore, now: number): Promise<PlayedRound[]> {
  const since = Timestamp.fromMillis(now - WINDOW_DAYS * 86_400_000);
  const snapshot = await db.collection('games').where('finishedAt', '>=', since).get();
  return snapshot.docs.flatMap((game) => {
    const packId = game.get('packId') as unknown;
    const finishedAt = game.get('finishedAt') as unknown;
    const questions = game.get('questions') as unknown;
    if (typeof packId !== 'string' || !(finishedAt instanceof Timestamp) || !Array.isArray(questions)) return [];
    return [{ packId, finishedAt: finishedAt.toMillis(), questions: questions.length }];
  });
}

function table(rows: FreshnessRow[], season: string, at: Date): string {
  const lines = [
    `Pack freshness, ${at.toLocaleString('en-GB')} — ${season}, rounds from the last ${WINDOW_DAYS} days`,
    '',
    '  pack                 size  asked  unseen  round  fresh rounds  played',
    ...rows.map(
      (row) =>
        `  ${row.title.padEnd(19)}${String(row.size).padStart(6)}${String(row.asked).padStart(7)}`
        + `${String(row.unseen).padStart(8)}${String(row.roundLength).padStart(7)}`
        + `${row.freshRounds.toFixed(1).padStart(14)}${String(row.played).padStart(8)}`
        + (row.low ? '  LOW' : ''),
    ),
  ];
  return `${lines.join('\n')}\n`;
}

/** AppleScript string literal: backslashes and double quotes escaped, nothing else interpreted. */
async function notify(title: string, message: string): Promise<void> {
  const quote = (text: string) => `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  await execFileAsync('osascript', ['-e', `display notification ${quote(message)} with title ${quote(title)}`]);
}

async function main(): Promise<void> {
  const now = new Date();
  await mkdir(CACHE, { recursive: true });
  if (flag('--if-due') && !isDue(now, await readText(STAMP))) return;

  try {
    const keyPath = process.env['GOOGLE_APPLICATION_CREDENTIALS'];
    if (!keyPath) throw new Error('No GOOGLE_APPLICATION_CREDENTIALS in .env.local');
    const key: unknown = JSON.parse(await readFile(keyPath, 'utf8'));
    const app = initializeApp({ credential: cert(key as Parameters<typeof cert>[0]) }, 'freshness');
    const db = getFirestore(app);

    const [packs, { season, asked }, rounds] = await Promise.all([
      publishedPacks(),
      currentAsked(db),
      recentRounds(db, now.getTime()),
    ]);
    const rows = freshness({ packs, asked, rounds, now: now.getTime(), lowBelow: lowBelow() });
    const report = table(rows, season, now);
    process.stdout.write(report);
    await writeFile(LATEST, report);
    await writeFile(STAMP, `${localDay(now)}\n`);

    const message = notificationFor(rows);
    if (flag('--notify') && message) await notify('Quiz: packs running low', message);
  } catch (error: unknown) {
    // No stamp, so the next hourly or login run tries again. One notification
    // a day at most, so a key that has gone missing is heard about rather
    // than retried in silence for ever.
    const reason = error instanceof Error ? error.message : String(error);
    if (flag('--notify') && (await readText(FAILED_STAMP)) !== localDay(now)) {
      await writeFile(FAILED_STAMP, `${localDay(now)}\n`);
      await notify('Quiz: freshness check failed', reason.slice(0, 200));
    }
    throw error;
  }
}

main().catch((error: unknown) => {
  console.error('freshness failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
