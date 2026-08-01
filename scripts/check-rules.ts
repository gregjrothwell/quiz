/**
 * Checks that the published security rules match what the app needs. Run with:
 *
 *   npm run check-rules
 *
 * Both rulesets are published by hand in the Firebase console, and an
 * unpublished one has now broken the game twice — first Firestore, then the
 * Realtime Database, where every presence write was rejected and the room
 * quietly filled with ghosts. This is the thirty-second preflight that catches
 * it before a round does.
 *
 * Deliberately read-only against Firestore and self-cleaning against the
 * Realtime Database, so running it leaves nothing behind.
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { get, getDatabase, ref, remove, set } from 'firebase/database';
import { collection, doc, getDoc, getDocs, getFirestore, limit, query } from 'firebase/firestore';

/**
 * The rule is `match /seasons/{season}/players/{uid}`, so any season id
 * exercises the same path. Using a literal keeps this script out of the app's
 * module graph — importing the real constant drags in src/firebase.ts, which
 * reads `import.meta.env` and only exists under Vite.
 */
const ANY_SEASON = 'rules-check';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — run with --env-file=.env.local`);
  return value;
}

const config = {
  apiKey: required('VITE_FIREBASE_API_KEY'),
  authDomain: required('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: required('VITE_FIREBASE_PROJECT_ID'),
  appId: required('VITE_FIREBASE_APP_ID'),
  databaseURL: required('VITE_FIREBASE_DATABASE_URL'),
};

interface Check {
  label: string;
  hint: string;
  run: () => Promise<unknown>;
}

async function main(): Promise<void> {
  const app = initializeApp(config, 'check-rules');
  const credential = await signInAnonymously(getAuth(app));
  const uid = credential.user.uid;
  const db = getFirestore(app);
  const rtdb = getDatabase(app);

  console.log(`Project ${config.projectId}, signed in anonymously as ${uid.slice(0, 8)}…\n`);

  const presence = ref(rtdb, `presence/__rules-check__/${uid}`);

  const checks: Check[] = [
    {
      label: 'Firestore  · read a room',
      hint: 'publish firestore.rules',
      run: () => getDoc(doc(db, 'rooms', 'ZZZZ')),
    },
    {
      label: 'Firestore  · read the season table',
      hint: 'firestore.rules is missing the seasons/{season}/players block',
      run: () =>
        getDocs(query(collection(db, 'seasons', ANY_SEASON, 'players'), limit(1))),
    },
    {
      label: 'Realtime DB · write presence',
      hint: 'publish database.rules.json — closed tabs will never be cleaned up',
      run: () => set(presence, { name: 'Rules check', at: Date.now() }),
    },
    {
      label: 'Realtime DB · read presence',
      hint: 'publish database.rules.json',
      run: () => get(ref(rtdb, 'presence/__rules-check__')),
    },
  ];

  let failed = 0;

  for (const check of checks) {
    try {
      await check.run();
      console.log(`  PASS  ${check.label}`);
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.log(`  FAIL  ${check.label}`);
      console.log(`        ${message.split('\n')[0]}`);
      console.log(`        → ${check.hint}`);
    }
  }

  await remove(presence).catch(() => undefined);

  console.log(
    failed === 0
      ? '\nBoth rulesets are live.'
      : `\n${failed} check(s) failed — the app will misbehave until those rules are published.`,
  );

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error('check-rules failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
