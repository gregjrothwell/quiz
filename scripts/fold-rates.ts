/**
 * Folds the office's kept rounds into `public/packs/rates.json`, the hit rates
 * Mr Fries plays to (docs/decisions/beat-the-chaser.md, S1). Run with:
 *
 *   npm run fold-rates            # dry run: prints what it would write
 *   npm run fold-rates -- --go    # writes the file
 *
 * **Needs a service account**, as `read-games` does: no client may read `games/`.
 * The arithmetic is `scripts/rates.ts`. The file holds counts only — no question
 * ids, no answers, no names — and `seal.test.ts` checks it.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cert, initializeApp, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { parseGameRecord } from './game-report';
import { foldRates } from './rates';
import type { GameRecord } from '../src/engine/gameRecord';

const PACKS = join(import.meta.dirname, '..', 'public', 'packs');
const OUT = join(PACKS, 'rates.json');

/** Question id → the pack file it ships in, for crediting a random round's questions. */
function packIndex(): Map<string, string> {
  const index = new Map<string, string>();
  for (const name of readdirSync(PACKS)) {
    if (!name.endsWith('.json') || name === 'index.json' || name === 'rates.json') continue;
    const pack = JSON.parse(readFileSync(join(PACKS, name), 'utf8')) as { questions?: { id: string }[] };
    for (const question of pack.questions ?? []) index.set(question.id, name.replace(/\.json$/, ''));
  }
  return index;
}

async function main(): Promise<void> {
  const keyPath = process.env['GOOGLE_APPLICATION_CREDENTIALS'] ?? join(import.meta.dirname, '..', '.secrets', 'service-account.json');
  const key = JSON.parse(readFileSync(keyPath, 'utf8')) as ServiceAccount;
  const db = getFirestore(initializeApp({ credential: cert(key) }, 'fold-rates'));

  const snapshot = await db.collection('games').get();
  const games: { id: string; record: GameRecord }[] = [];
  let unreadable = 0;
  for (const document of snapshot.docs) {
    const record = parseGameRecord(document.data());
    if (record) games.push({ id: document.id, record });
    else unreadable += 1;
  }

  const rates = foldRates(games, packIndex());
  const text = `${JSON.stringify(rates, null, 2)}\n`;
  const pct = (hits: number, tries: number): string => `${String(Math.round((100 * hits) / Math.max(1, tries)))}%`;

  console.log(`${String(snapshot.size)} kept rounds read, ${String(unreadable)} unreadable.`);
  console.log(`Overall: ${pct(rates.overall.hits, rates.overall.tries)} of ${String(rates.overall.tries)} answers`);
  for (const [difficulty, tally] of Object.entries(rates.byDifficulty)) {
    console.log(`  ${difficulty.padEnd(7)} ${pct(tally.hits, tally.tries).padStart(4)} of ${String(tally.tries)}`);
  }
  console.log(`${String(Object.keys(rates.byPack).length)} packs with a rate.`);

  if (!process.argv.includes('--go')) {
    console.log(`\nDry run. --go writes ${OUT}.`);
    return;
  }
  const before = existsSync(OUT) ? readFileSync(OUT, 'utf8') : null;
  writeFileSync(OUT, text);
  console.log(`\nWrote ${OUT}${before === text ? ' (unchanged)' : ''}.`);
}

main().catch((error: unknown) => {
  console.error('fold-rates failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
