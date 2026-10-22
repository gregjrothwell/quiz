import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import { connectDatabaseEmulator, getDatabase, type Database } from 'firebase/database';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import {
  connectFirestoreEmulator as connectLiteEmulator,
  getFirestore as getLiteFirestore,
  type Firestore as LiteFirestore,
} from 'firebase/firestore/lite';
import { initializeApp as initializeAdmin, getApps as getAdminApps } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore, type Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { EMULATOR_HOST, EMULATOR_PORTS, authEmulatorUrl } from '../src/lib/emulators';

/**
 * Node-side clients for the e2e rules cases: the same client SDK the app uses,
 * pointed at the emulators that `npm run e2e` starts with the repo's own
 * `firestore.rules` and `database.rules.json`.
 *
 * The project id is the one `npm run e2e` passes (`--project quiz-d686e`). The
 * database URL only matters for its subdomain: the RTDB emulator loads the
 * rules file into `<project>-default-rtdb` and no other namespace
 * (firebase-tools `getRulesConfig`, read 15 Oct 2026), so a client on any other
 * namespace would be testing no rules at all. The presence canary in the rules
 * spec fails if that ever stops being true.
 */
const PROJECT_ID = 'quiz-d686e';
const DATABASE_URL = `https://${PROJECT_ID}-default-rtdb.europe-west1.firebasedatabase.app`;

export interface Player {
  uid: string;
  db: Firestore;
  /** Lite on the same app, pointed at the same emulator — never the live project. */
  lite: LiteFirestore;
  rtdb: Database;
  app: FirebaseApp;
  close: () => Promise<void>;
}

let counter = 0;

export async function player(): Promise<Player> {
  counter += 1;
  const app = initializeApp(
    { apiKey: 'emulator', projectId: PROJECT_ID, appId: 'emulator', databaseURL: DATABASE_URL },
    `player-${process.pid}-${counter}`,
  );
  const auth = getAuth(app);
  connectAuthEmulator(auth, authEmulatorUrl(), { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, EMULATOR_HOST, EMULATOR_PORTS.firestore);
  const lite = getLiteFirestore(app);
  connectLiteEmulator(lite, EMULATOR_HOST, EMULATOR_PORTS.firestore);
  const rtdb = getDatabase(app);
  connectDatabaseEmulator(rtdb, EMULATOR_HOST, EMULATOR_PORTS.database);
  const { user } = await signInAnonymously(auth);
  return { uid: user.uid, db, lite, rtdb, app, close: () => deleteApp(app) };
}

/**
 * The Admin SDK against the emulator, which ignores the rules: for seeding the
 * vault (no client may write it) and reading back what the rules let through.
 * `emulators:exec` sets FIRESTORE_EMULATOR_HOST for its child; defaulted here
 * so the spec does not depend on that.
 */
export function admin(): AdminFirestore {
  process.env.FIRESTORE_EMULATOR_HOST ??= `${EMULATOR_HOST}:${EMULATOR_PORTS.firestore}`;
  const app = getAdminApps()[0] ?? initializeAdmin({ projectId: PROJECT_ID });
  return getAdminFirestore(app);
}

/**
 * Puts an answer for every question in the room into the vault: the first
 * option, so pressing A is right. The real answers are not in this repo and
 * never reach CI.
 */
export async function seedVault(code: string): Promise<void> {
  const db = admin();
  const room = await db.doc(`rooms/${code}`).get();
  const questions = (room.data()?.questions ?? []) as { id: string; options: string[] }[];
  await Promise.all(
    questions.map((question) => db.doc(`vault/${question.id}`).set({ a: question.options[0] })),
  );
}

/** Resolves once `check` passes, polling the Admin SDK; throws after `ms`. */
export async function until<T>(
  read: () => Promise<T>,
  check: (value: T) => boolean,
  ms = 20_000,
): Promise<T> {
  const deadline = Date.now() + ms;
  for (;;) {
    const value = await read();
    if (check(value)) return value;
    if (Date.now() > deadline) throw new Error(`until: timed out after ${ms}ms`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}
