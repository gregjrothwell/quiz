/**
 * What the season actually remembers having asked. Run with:
 *
 *   npm run asked-probe
 *
 * Read-only. The reading that matters is **whether a pack's id count grows**.
 * `recordAsked` merges this round's ids into what it was handed and writes the
 * whole document back, so a healthy pack climbs by the round length every
 * sitting until it reaches `ASKED_LIMIT`. A pack sitting at exactly one round's
 * worth with a recent `at` has been *overwritten* rather than appended to, and
 * every round since has been drawing from the full pool.
 *
 * That distinction is the whole reason this script exists. `loadAsked` returns
 * an empty set both when a pack has no history and when the read was refused,
 * and the caller swallows the failure either way — so from inside the app the
 * two are indistinguishable, and neither says a word on screen. Run this before
 * and after a round: the count must be higher afterwards, not equal to the
 * round length.
 *
 * Needs the service account for the same reason `take-stock` does — `list` is a
 * query, and this walks the subcollections rather than guessing their names.
 * The admin SDK bypasses the rules, so keep the key under `.secrets/`.
 */

import { readFileSync } from 'node:fs';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { ASKED_LIMIT } from '../src/engine/askedHistory';


interface PackHistory {
  season: string;
  pack: string;
  ids: number;
  unique: number;
  at: Date | null;
}

/**
 * Every `asked` document under every season bucket.
 *
 * No hardcoded season id, for the reason `take-stock` records: a hardcoded one
 * went stale the moment weekly boards shipped and the script quietly reported a
 * fraction of what was there. `listDocuments` returns the implicit parents of
 * the subcollections that actually exist, which is the question being asked.
 */
async function askedHistory(db: FirebaseFirestore.Firestore): Promise<PackHistory[]> {
  const parents = await db.collection('seasons').listDocuments();

  const perSeason = await Promise.all(
    parents.map(async (parent) => {
      const snapshot = await parent.collection('asked').get();
      return snapshot.docs.map((entry): PackHistory => {
        const ids = entry.get('ids') as unknown;
        const list = Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
        const at = entry.get('at') as unknown;
        return {
          season: parent.id,
          pack: entry.id,
          ids: list.length,
          unique: new Set(list).size,
          at: typeof at === 'number' ? new Date(at) : null,
        };
      });
    }),
  );

  return perSeason.flat().sort((a, b) => a.season.localeCompare(b.season) || a.pack.localeCompare(b.pack));
}

function when(at: Date | null): string {
  if (!at) return 'never';
  const days = Math.floor((Date.now() - at.getTime()) / 86_400_000);
  return `${at.toISOString().slice(0, 10)}  (${days}d ago)`;
}

async function main(): Promise<void> {
  const keyPath = process.env['GOOGLE_APPLICATION_CREDENTIALS'];
  if (!keyPath) {
    throw new Error(
      'No GOOGLE_APPLICATION_CREDENTIALS in .env.local. This script needs the '
        + 'service account: walking the `asked` subcollections is a list, and '
        + 'clients are denied that.',
    );
  }

  const key: unknown = JSON.parse(readFileSync(keyPath, 'utf8'));
  const app = initializeApp({ credential: cert(key as Parameters<typeof cert>[0]) }, 'asked-probe');
  const db = getFirestore(app);

  const history = await askedHistory(db);

  console.log(`\nQuestion history, ${new Date().toISOString().slice(0, 10)}\n`);

  if (history.length === 0) {
    console.log('  Nothing recorded. No round has ever written a history, or the');
    console.log('  writes are being refused — run `npm run check-rules` to tell which.\n');
    return;
  }

  console.log('  season      pack                 ids  unique  last written');
  for (const row of history) {
    console.log(
      `  ${row.season.padEnd(11)} ${row.pack.padEnd(20)}`
        + `${String(row.ids).padStart(4)}  ${String(row.unique).padStart(6)}  ${when(row.at)}`,
    );
  }

  const capped = history.filter((row) => row.ids >= ASKED_LIMIT).length;
  const total = history.reduce((sum, row) => sum + row.ids, 0);
  console.log(`\n  ${history.length} packs, ${total.toLocaleString('en-GB')} ids, ${capped} at the ${ASKED_LIMIT} cap.`);

  /*
    The reading is a comparison, not a number, so this says what to compare
    rather than pronouncing a verdict from one run. A count equal to a round
    length is only damning next to an earlier, larger one — a pack genuinely
    played once looks identical.
  */
  console.log('\n  Run a round, then run this again. Every pack that round drew on must');
  console.log('  climb by the round length. One that comes back at exactly the round');
  console.log('  length has been overwritten, and its history is gone.\n');
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
