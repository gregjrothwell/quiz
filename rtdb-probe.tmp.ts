import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { get, getDatabase, ref, set } from 'firebase/database';

const config = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  databaseURL: process.env.VITE_FIREBASE_DATABASE_URL,
};

async function main() {
const app = initializeApp(config, 'probe');
const auth = getAuth(app);
const user = await signInAnonymously(auth);
const db = getDatabase(app);
const uid = user.user.uid;

console.log('databaseURL =', config.databaseURL);
console.log('uid =', uid, '\n');

async function attempt(label: string, run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
    console.log(`  OK       ${label}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`  DENIED   ${label}  — ${message.split('\n')[0]}`);
  }
}

await attempt('read  presence/PROBE            (our rules: allow if signed in)', () =>
  get(ref(db, 'presence/PROBE')),
);
await attempt('write presence/PROBE/<own uid>  (valid payload)', () =>
  set(ref(db, `presence/PROBE/${uid}`), { name: 'Probe', at: Date.now() }),
);
await attempt('write presence/PROBE/<own uid>  (empty name — what a reload sends)', () =>
  set(ref(db, `presence/PROBE/${uid}`), { name: '', at: Date.now() }),
);
await attempt('write presence/PROBE/someone-else (must be denied)', () =>
  set(ref(db, 'presence/PROBE/not-my-uid'), { name: 'X', at: Date.now() }),
);
await attempt('read  / (root — must be denied)', () => get(ref(db, '/')));

}
main();
