import { initializeApp, type FirebaseApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getAuth, type Auth } from 'firebase/auth';
import { getDatabase, type Database } from 'firebase/database';
import { getFirestore, type Firestore } from 'firebase/firestore';

declare global {
  /**
   * Set before `initializeAppCheck` to skip attestation on a machine reCAPTCHA
   * will never vouch for. The SDK reads it off the global object by name.
   */
  var FIREBASE_APPCHECK_DEBUG_TOKEN: string | boolean | undefined;
}

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
 * The reCAPTCHA v3 site key, which is what App Check attests with.
 *
 * Public in exactly the way the API key above is public — it is embedded in
 * every page that uses reCAPTCHA, and its counterpart secret lives only in the
 * Firebase console. What it is *not* is a mitigation on its own: an allowed-
 * domains list is the only thing tying it to this site, which is why `localhost`
 * must never be added to that list. Local development uses a debug token.
 *
 * **Optional.** Without it App Check is simply not initialised, and the app
 * behaves as it did before any of this existed. That is deliberate: it lets
 * this ship ahead of the console being finished, keeps `#/preview` and the
 * setup notice working on a machine with no key, and means a misconfigured
 * value degrades to "unenforced" rather than "nobody can play".
 */
const appCheckSiteKey: string | undefined = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY;

/**
 * A registered debug token, for a machine reCAPTCHA cannot vouch for.
 *
 * `npm run dev` runs on localhost, which reCAPTCHA will refuse, so without this
 * every local request fails the moment enforcement is switched on. Registered
 * per-app under App Check → Manage debug tokens, and revocable there — which is
 * the whole reason this is the supported route and adding `localhost` to the
 * reCAPTCHA allowlist is not. That would let anybody run this app against this
 * project from their own machine.
 *
 * Lives in `.env.local`, which is gitignored. It is a real credential: it
 * bypasses attestation entirely.
 */
const appCheckDebugToken: string | undefined = import.meta.env
  .VITE_FIREBASE_APPCHECK_DEBUG_TOKEN;

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

    /*
      Before every other service, because App Check attaches a token to the
      requests those services make and cannot retrofit one onto a client that
      has already started talking.

      Not fatal on failure. A reCAPTCHA that will not load — a blocked script on
      a work network is the obvious way — must not take the quiz down while
      enforcement is still off, and once it is on the request is refused by the
      server anyway, which is a far clearer failure than a blank screen. So this
      is allowed to throw and be swallowed rather than gating `connect()`.
    */
    if (appCheckSiteKey) {
      // `true` rather than a token asks the SDK to mint one and print it to the
      // browser console, which is how you get a token to safelist in the first
      // place — the console's own dialog generates its value and will not take
      // one you made up. Boolean, not the string: the SDK tests for `=== true`,
      // so `'true'` from an env file would be read as a token that is not
      // registered and fail attestation with no clue why.
      if (appCheckDebugToken) {
        globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN =
          appCheckDebugToken === 'true' ? true : appCheckDebugToken;
      }
      try {
        initializeAppCheck(app, {
          provider: new ReCaptchaV3Provider(appCheckSiteKey),
          isTokenAutoRefreshEnabled: true,
        });
      } catch {
        // Deliberately quiet. The App Check metrics in the console are where
        // "is this working" gets answered, not a console warning nobody reads.
      }
    }

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
