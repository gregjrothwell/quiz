import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getDatabase, type Database } from 'firebase/database';
import { getFirestore, type Firestore } from 'firebase/firestore';

/**
 * These values identify the project; they do not authorise access. Real access
 * control lives in firestore.rules and database.rules.json. Shipping them in a
 * static bundle is how Firebase web apps are meant to work.
 */
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
};

/**
 * Checked against the raw environment, touching no Firebase API, so the app can
 * decide to show setup instructions before anything tries to connect.
 */
export const isFirebaseConfigured = Boolean(
  config.apiKey && config.projectId && config.databaseURL,
);

/**
 * Everything below is created on first use rather than at module load.
 *
 * `getDatabase()` throws synchronously when `databaseURL` is missing, and at
 * module scope that takes down the entire import graph — the app rendered a
 * blank page instead of the setup instructions, because the file explaining
 * what to configure could not itself load.
 */
interface Services {
  app: FirebaseApp;
  db: Firestore;
  auth: Auth;
  rtdb: Database;
}

let services: Services | null = null;

function connect(): Services {
  if (!isFirebaseConfigured) {
    throw new Error(
      'Firebase is not configured. Copy .env.example to .env.local and fill in the values.',
    );
  }

  if (!services) {
    const app = initializeApp(config);
    services = {
      app,
      // Room state and answers.
      db: getFirestore(app),
      // Anonymous identity — a stable uid per browser, with no sign-up.
      auth: getAuth(app),
      // Presence only. Firestore has no `onDisconnect`, so knowing who is still
      // in the room needs the Realtime Database alongside it.
      rtdb: getDatabase(app),
    };
  }

  return services;
}

export function firestore(): Firestore {
  return connect().db;
}

export function firebaseAuth(): Auth {
  return connect().auth;
}

export function realtimeDb(): Database {
  return connect().rtdb;
}
