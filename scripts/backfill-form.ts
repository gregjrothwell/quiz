/**
 * Seeds `form` on season rows that predate it. Dry run by default:
 *
 *   npm run backfill-form            # shows what it would write, writes nothing
 *   npm run backfill-form -- --go    # writes
 *
 * **Why this is an estimate and not a backfill.** `form` is the sum of a
 * player's best {@link FORM_KEPT} scores from their last {@link FORM_WINDOW}
 * rounds, and it is computed from the `recent` array that `bankGame` writes.
 * Rows banked before 8 September 2026 have neither field — and, crucially, the
 * per-round scores `form` is defined over were **never stored anywhere**. Only
 * the running totals survive: `played`, `points`, `best`.
 *
 * So there is nothing to recover. This invents a number, and the only honest
 * thing to do is say so plainly rather than let a computed-looking figure pass
 * as history. What it invents:
 *
 *     form ≈ best + mean × min(FORM_KEPT - 1, played - 1)
 *
 * The player's actual best round — which *is* real, stored data — plus as many
 * average nights as their record can support. A one-round player scores exactly
 * their one round, which is also what the real formula would give them.
 *
 * **It understates strong players and overstates streaky ones**, because a real
 * `form` takes the best four rounds and a mean does not. It also reinstates,
 * for one round only, the average-shaped ranking that form ranking exists to
 * replace — every seeded row is displaced by real data the first time that
 * player banks, so the distortion decays rather than persisting.
 *
 * **Never overwrites a real `form`.** A row that already has one was banked by
 * the form client and its figure is genuine.
 *
 * There is no field to mark a row as estimated: `firestore.rules` validates the
 * season document with `hasOnly`, so an extra key makes the player's next bank
 * fail. The record of which rows were seeded is this script's output and
 * `docs/decisions/season.md`, not the data.
 */

import { readFile } from 'node:fs/promises';
import { cert, initializeApp as initAdmin, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';

import { FORM_KEPT } from '../src/engine/records';

const BUCKETS = ['season-1', 'season-2'] as const;

interface Seed {
  bucket: string;
  id: string;
  name: string;
  played: number;
  best: number;
  mean: number;
  form: number;
}

/**
 * Pure, so the arithmetic can be checked without a network. Returns `null` for
 * a row that must be left alone — one that already has a real figure, or one
 * with nothing to estimate from.
 */
export function estimateForm(row: {
  form?: unknown;
  played?: unknown;
  points?: unknown;
  best?: unknown;
}): number | null {
  if (typeof row.form === 'number') return null;

  const played = typeof row.played === 'number' ? row.played : 0;
  const points = typeof row.points === 'number' ? row.points : 0;
  const best = typeof row.best === 'number' ? row.best : 0;
  if (played < 1 || best < 1) return null;

  const mean = Math.round(points / played);
  const extra = Math.min(FORM_KEPT - 1, played - 1);
  return best + mean * extra;
}

async function main(): Promise<void> {
  const go = process.argv.includes('--go');
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyPath === undefined || keyPath === '') {
    console.error('\nGOOGLE_APPLICATION_CREDENTIALS is not set. It lives in .env.local.\n');
    process.exit(1);
  }

  const key = JSON.parse(await readFile(keyPath, 'utf8')) as ServiceAccount;
  const db = getAdminFirestore(initAdmin({ credential: cert(key) }, 'backfill-form'));

  const seeds: Seed[] = [];
  let alreadyReal = 0;
  let skipped = 0;

  for (const bucket of BUCKETS) {
    const snapshot = await db.collection('seasons').doc(bucket).collection('players').get();
    snapshot.forEach((doc) => {
      const row = doc.data() as Record<string, unknown>;
      const form = estimateForm(row);
      if (form === null) {
        if (typeof row.form === 'number') alreadyReal++;
        else skipped++;
        return;
      }
      const played = row.played as number;
      seeds.push({
        bucket,
        id: doc.id,
        name: String(row.name ?? '?'),
        played,
        best: row.best as number,
        mean: Math.round((row.points as number) / played),
        form,
      });
    });
  }

  seeds.sort((left, right) => right.form - left.form);

  console.log(`\n${go ? 'Writing' : 'Dry run —'} ${seeds.length} estimated form figures.`);
  console.log(`${alreadyReal} row(s) already carry a real form and are left alone; ${skipped} have nothing to estimate from.\n`);
  console.log('  bucket    player             played     best     mean   form (estimated)');
  for (const s of seeds) {
    console.log(
      `  ${s.bucket.padEnd(9)} ${s.name.slice(0, 17).padEnd(18)} ${String(s.played).padStart(6)}`
      + ` ${String(s.best).padStart(8)} ${String(s.mean).padStart(8)} ${String(s.form).padStart(8)}`,
    );
  }

  if (!go) {
    console.log('\nNothing written. Re-run with `-- --go` to apply.\n');
    return;
  }

  // Batched, because 30 individual writes against a rules-validated collection
  // is 30 chances to half-finish. Firestore caps a batch at 500.
  const batch = db.batch();
  for (const s of seeds) {
    batch.update(db.collection('seasons').doc(s.bucket).collection('players').doc(s.id), { form: s.form });
  }
  await batch.commit();
  console.log(`\nWrote ${seeds.length} form figures. These are estimates — see the header of this file.\n`);
}

void main().then(() => process.exit(0));
