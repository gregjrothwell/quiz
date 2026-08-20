/**
 * Which products actually refuse an unattested client.
 *
 * **The negative half of the App Check evidence, and the half that carries the
 * proof.** Turning enforcement on and watching the site still work shows only
 * that nothing broke. The question worth answering is the opposite one: is a
 * client with no App Check token now refused? Until that is checked, "enforced"
 * is a setting somebody clicked, not a fact.
 *
 * `check-rules` cannot answer it. That script needs its debug token to do its
 * job, and without one it dies on the first Firestore call — long before it
 * reaches the Realtime Database checks. So this is a separate, deliberately
 * tiny script that signs in with **no** App Check at all and reports, per
 * product, whether the request was refused.
 *
 * Reports rather than gates. It is a measurement of the console's current
 * state, and both answers are legitimate readings depending on what has been
 * switched on — so it always exits 0 and never fails a preflight. What it must
 * not do is let "not enforced" pass unnoticed, which is why each line says so
 * in as many words.
 *
 *   npm run appcheck-probe
 *
 * Nothing here reaches `src/firebase.ts` — see `scripts/imports.test.ts`.
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { get, getDatabase, ref, remove, set } from 'firebase/database';
import { doc, getDoc, getFirestore } from 'firebase/firestore';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. This script needs .env.local.`);
  return value;
}

const config = {
  apiKey: required('VITE_FIREBASE_API_KEY'),
  authDomain: required('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: required('VITE_FIREBASE_PROJECT_ID'),
  appId: required('VITE_FIREBASE_APP_ID'),
  databaseURL: required('VITE_FIREBASE_DATABASE_URL'),
};

/** A room code nothing else uses, so a leftover is obvious and harmless. */
const PROBE_ROOM = 'appcheck-probe';

/**
 * How long to give one probe before calling it hung.
 *
 * A refused Realtime Database call does not reliably reject: the SDK retries a
 * dropped connection rather than surfacing it, so a request that will never be
 * served just never settles. Left unguarded, the whole script hangs and reports
 * nothing at all — which is worse than either answer.
 */
const PROBE_TIMEOUT_MS = 8_000;

function withTimeout<T>(work: Promise<T>): Promise<T> {
  return Promise.race([
    work,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('no response within 8s')), PROBE_TIMEOUT_MS).unref(),
    ),
  ]);
}

interface Probe {
  product: string;
  what: string;
  run: () => Promise<unknown>;
}

async function main(): Promise<void> {
  // Deliberately no attachDebugAppCheck. That absence is the whole experiment.
  const app = initializeApp(config, 'appcheck-probe');

  console.log(`\nProject ${config.projectId}, with no App Check token at all.\n`);

  // Auth first, and reported separately: if signing in is refused then every
  // line below would fail for that reason rather than their own, and reading
  // that as "everything is enforced" would be exactly wrong.
  let uid: string;
  try {
    const credential = await withTimeout(signInAnonymously(getAuth(app)));
    uid = credential.user.uid;
    console.log(`  NOT ENFORCED  Authentication  · signed in as ${uid.slice(0, 8)}…`);
  } catch (error) {
    console.log('  ENFORCED      Authentication  · refused, so nothing below can be read');
    console.log(`                ${error instanceof Error ? error.message : String(error)}`);
    process.exit(0);
  }

  const db = getFirestore(app);
  const rtdb = getDatabase(app);
  const presence = ref(rtdb, `presence/${PROBE_ROOM}/${uid}`);

  const probes: Probe[] = [
    {
      product: 'Cloud Firestore',
      what: 'read a room',
      run: () => getDoc(doc(db, 'rooms', 'ZZZZ')),
    },
    {
      product: 'Realtime Database',
      what: 'write presence',
      run: () => set(presence, { name: 'App Check probe', at: Date.now() }),
    },
    {
      product: 'Realtime Database',
      what: 'read presence',
      run: () => get(ref(rtdb, `presence/${PROBE_ROOM}`)),
    },
  ];

  for (const probe of probes) {
    try {
      await withTimeout(probe.run());
      console.log(`  NOT ENFORCED  ${probe.product.padEnd(18)}· ${probe.what} succeeded`);
    } catch (error) {
      const message = (error instanceof Error ? error.message : String(error)).split('\n')[0];
      console.log(`  ENFORCED      ${probe.product.padEnd(18)}· ${probe.what} refused`);
      console.log(`                ${message}`);
    }
  }

  // Best effort, and timed out like everything else. Once the Realtime Database
  // is enforced this delete is refused the same way the write was — by never
  // settling — so an unguarded cleanup hangs the script *after* it has printed
  // the answer, which is a maddening way to fail.
  await withTimeout(remove(presence)).catch(() => undefined);

  console.log(
    '\n  "NOT ENFORCED" is a finding, not a pass. It means this product accepts a\n'
      + '  client that cannot attest — which is what App Check exists to stop.\n',
  );

  // Both clients hold the event loop open, so returning from main() is not the
  // process ending. Without this the script prints its answer and then hangs.
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error('appcheck-probe failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
