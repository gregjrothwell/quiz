/**
 * The Slop Cannon's kill switch, with no deploy (docs/decisions/slop-cannon.md,
 * C4). Run with:
 *
 *   npm run cannon                        # what is pulled now
 *   npm run cannon -- off <shot>          # dry run
 *   npm run cannon -- off <shot> --go     # pull it: gone from every lobby, and
 *                                         # off mid-round on every device that loads after
 *   npm run cannon -- on <shot> --go      # put it back
 *
 * Writes `config/cannon`, which no client may write. **Needs a service
 * account**, as `read-games` does: `GOOGLE_APPLICATION_CREDENTIALS` under
 * `.secrets/`. A dry run by default, the shape of `fold-votes`.
 */

import { readFile } from 'node:fs/promises';
import { cert, initializeApp as initAdmin, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { MAX_SHOT_ID, isModeKey } from '../src/engine/cannon';
import { switched } from './cannon-report';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — point it at a service account key under .secrets/`);
  return value;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const go = args.includes('--go');
  const [action, id] = args.filter((arg) => arg !== '--go');

  const key = JSON.parse(await readFile(required('GOOGLE_APPLICATION_CREDENTIALS'), 'utf8')) as ServiceAccount;
  const db = getAdminFirestore(initAdmin({ credential: cert(key) }, 'cannon-admin'));
  const ref = db.doc('config/cannon');
  const data: unknown = (await ref.get()).data();
  const current: unknown = typeof data === 'object' && data !== null ? Reflect.get(data, 'off') : undefined;
  const off = Array.isArray(current) ? current.filter((entry): entry is string => typeof entry === 'string') : [];

  console.log(`config/cannon on ${required('VITE_FIREBASE_PROJECT_ID')}: pulled ${off.length ? off.join(', ') : 'nothing'}.`);
  if (action === undefined) return;

  if ((action !== 'off' && action !== 'on') || !id || id.length > MAX_SHOT_ID) {
    throw new Error('Usage: npm run cannon -- off|on <shot> [--go]');
  }
  if (isModeKey(id)) {
    // E6: a `mode-` key is a question about a finished lobby mode, not a shot.
    // Pulling it here would not turn Mr Fries off — that is the lobby's.
    throw new Error(`${id} is a lobby mode, not a shot — the kill switch cannot turn it off. Its Keep / Bin stops when its New sticker does.`);
  }
  const next = switched(off, action, id);
  console.log(`After \`${action} ${id}\`: pulled ${next.length ? next.join(', ') : 'nothing'}.`);
  if (!go) {
    console.log('Dry run. Re-run with `--go` to write it.');
    return;
  }
  await ref.set({ off: next });
  console.log('Written. Every page loaded from now reads it; open pages keep what they read.');
}

main().then(
  () => process.exit(0),
  (cause: unknown) => {
    console.error(cause instanceof Error ? cause.message : cause);
    process.exit(1);
  },
);
