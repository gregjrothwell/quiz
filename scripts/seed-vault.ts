/**
 * Uploads the answers to Firestore. Run with:
 *
 *   npm run seed-vault
 *
 * The packs under `public/packs/` ship without answers; this is where the
 * answers go instead. Nothing can read the collection afterwards — see the
 * `vault` block in firestore.rules — but security rules can, which is what lets
 * the reveal check an asserted answer without ever handing one out.
 *
 * There are two ways in, and the script picks whichever is available:
 *
 * **A service account** (`GOOGLE_APPLICATION_CREDENTIALS`). Bypasses the rules
 * entirely, so nothing needs publishing and the game stays up while it runs.
 * It can also *read* the vault, so a top-up writes only what is new and tells
 * you what changed. This is the one to use.
 *
 * **Anonymous auth**, if no credentials are configured. Needs
 * firestore.seed.rules published for as long as it runs, during which nobody
 * can play and the vault is writable by anyone — then firestore.rules
 * republished afterwards. It cannot read the vault, so it rewrites every
 * answer every time. Kept as the path for anyone who would rather not hold a
 * key; `npm run check-rules` catches the seeding ruleset being left live.
 *
 * Safe to re-run either way: same ids, same values.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cert, initializeApp as initAdmin, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { doc, getFirestore, writeBatch } from 'firebase/firestore';
import { HAND_VAULT_CACHE } from './write-hand-packs';

const VAULT_CACHE = join(import.meta.dirname, '..', '.cache', 'vault.json');

/** Firestore's own cap on a batched write. */
const BATCH_SIZE = 500;

/**
 * The harnesses play their own synthetic questions, which are not in any pack
 * and so not in the harvested vault. Without entries here, `npm run host-room`
 * could never reveal anything and would look like a broken vault rather than a
 * harness with no answers. Ids and text match scripts/host-room.ts.
 */
const HARNESS_ANSWERS: Record<string, string> = {
  hq0: 'The first one',
  hq1: 'The first one',
  hq2: 'The first one',
  // The preflight's own question. Without it `npm run check-rules` cannot prove
  // the reveal path *works*, only that it refuses things — and the direction
  // that breaks a quiz night is the one where nothing can be revealed at all.
  'rules-check-q': 'The right one',
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — run with --env-file=.env.local`);
  return value;
}

async function loadAnswers(): Promise<Record<string, string>> {
  const raw = await readFile(VAULT_CACHE, 'utf8').catch(() => null);
  if (raw === null) {
    throw new Error(
      `No ${VAULT_CACHE}. Run \`npm run fetch-questions -- --resort\` first — it `
        + 'writes the packs and the vault together, from the cached pool.',
    );
  }

  const harvested = JSON.parse(raw) as Record<string, string>;
  const handRaw = await readFile(HAND_VAULT_CACHE, 'utf8').catch(() => null);
  const hand = handRaw ? (JSON.parse(handRaw) as Record<string, string>) : {};
  return { ...harvested, ...hand, ...HARNESS_ANSWERS };
}

interface Outcome {
  added: number;
  changed: number;
  unchanged: number;
}

/**
 * The privileged path. Reads what is already there, writes only the difference,
 * and reports it — a top-up after a harvest should say "412 new", not silently
 * rewrite four thousand documents that were already correct.
 *
 * A *changed* answer is worth calling out separately. Ids are a hash of the
 * question text, so an id that already exists with a different answer means the
 * upstream source revised the answer to a question we are already asking.
 */
async function seedAsAdmin(keyPath: string): Promise<Outcome> {
  const key = JSON.parse(await readFile(keyPath, 'utf8')) as ServiceAccount;
  const app = initAdmin({ credential: cert(key) }, 'seed-vault-admin');
  const db = getAdminFirestore(app);

  const answers = await loadAnswers();
  const existing = new Map<string, string>();

  const snapshot = await db.collection('vault').get();
  for (const document of snapshot.docs) {
    existing.set(document.id, (document.data() as { a?: string }).a ?? '');
  }
  console.log(`Vault currently holds ${existing.size} answers.`);

  const pending = Object.entries(answers).filter(([id, a]) => existing.get(id) !== a);
  const changed = pending.filter(([id]) => existing.has(id));

  if (pending.length === 0) {
    return { added: 0, changed: 0, unchanged: Object.keys(answers).length };
  }

  for (let start = 0; start < pending.length; start += BATCH_SIZE) {
    const batch = db.batch();
    for (const [id, a] of pending.slice(start, start + BATCH_SIZE)) {
      batch.set(db.collection('vault').doc(id), { a });
    }
    await batch.commit();
    const done = Math.min(start + BATCH_SIZE, pending.length);
    process.stdout.write(`\r  ${done} / ${pending.length} written…`);
  }
  process.stdout.write('\n');

  return {
    added: pending.length - changed.length,
    changed: changed.length,
    unchanged: Object.keys(answers).length - pending.length,
  };
}

/**
 * The unprivileged path. Cannot read the vault, so it cannot tell what is
 * already there and writes everything.
 */
async function seedAnonymously(): Promise<Outcome> {
  const config = {
    apiKey: required('VITE_FIREBASE_API_KEY'),
    authDomain: required('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: required('VITE_FIREBASE_PROJECT_ID'),
    appId: required('VITE_FIREBASE_APP_ID'),
  };

  const answers = await loadAnswers();
  const app = initializeApp(config, 'seed-vault');
  await signInAnonymously(getAuth(app));
  const db = getFirestore(app);

  const entries = Object.entries(answers);

  for (let start = 0; start < entries.length; start += BATCH_SIZE) {
    const batch = writeBatch(db);
    for (const [id, a] of entries.slice(start, start + BATCH_SIZE)) {
      batch.set(doc(db, 'vault', id), { a });
    }
    await batch.commit();
    const done = Math.min(start + BATCH_SIZE, entries.length);
    process.stdout.write(`\r  ${done} / ${entries.length} written…`);
  }
  process.stdout.write('\n');

  return { added: entries.length, changed: 0, unchanged: 0 };
}

async function main(): Promise<void> {
  const keyPath = process.env['GOOGLE_APPLICATION_CREDENTIALS'];
  const projectId = required('VITE_FIREBASE_PROJECT_ID');

  console.log(`Seeding the vault in ${projectId}.`);

  let outcome: Outcome;

  if (keyPath) {
    console.log(`Using the service account at ${keyPath} — no rules to publish.\n`);
    outcome = await seedAsAdmin(keyPath);
  } else {
    console.log(
      'No GOOGLE_APPLICATION_CREDENTIALS — falling back to anonymous auth.\n'
        + 'This needs firestore.seed.rules published, and rewrites every answer.\n'
        + 'See README step 4 for the service-account route, which needs neither.\n',
    );
    outcome = await seedAnonymously();
  }

  if (outcome.added === 0 && outcome.changed === 0) {
    console.log(`\nNothing to do — all ${outcome.unchanged} answers are already correct.`);
  } else {
    console.log(`\nDone. ${outcome.added} added, ${outcome.changed} changed, `
      + `${outcome.unchanged} already correct.`);
  }

  if (!keyPath) {
    console.log('Now publish firestore.rules (the locked one) and run `npm run check-rules`.');
  }

  process.exit(0);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nseed-vault failed: ${message}`);
  if (message.toLowerCase().includes('permission')) {
    console.error(
      '\nWithout a service account this needs firestore.seed.rules published. '
        + 'Either publish it, run this again and republish firestore.rules — or '
        + 'set GOOGLE_APPLICATION_CREDENTIALS and skip all of that. README step 4.',
    );
  }
  process.exit(1);
});
