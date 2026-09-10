/**
 * Runtime switch that points a production bundle at the Firebase emulators.
 *
 * Playwright sets this on `window` before the app loads. It is not a Vite env
 * var: a build-time flag would make the tested artefact differ from the one
 * that ships, or worse, point production at localhost.
 */

export const EMULATOR_HOST = '127.0.0.1' as const;
export const EMULATOR_PORTS = { auth: 9099, firestore: 8080, database: 9000 } as const;
export const EMULATOR_FLAG = '__QUIZ_EMULATORS__' as const;

declare global {
  var __QUIZ_EMULATORS__: true | undefined;
}

/**
 * Whether this page should talk to the emulators.
 *
 * Boolean `true` only. The App Check debug token had the same class of bug:
 * the SDK treated the string `'true'` as a token, and attestation failed with
 * nothing useful in the console. A truthy check would make `'true'` and `1`
 * look like a deliberate switch.
 *
 * Reads `globalThis` by default so the browser path (`window`) and Node tests
 * share this function. Does not read a host from the page — an XSS that could
 * set the emulator host would redirect Firebase at an attacker. The host is
 * {@link EMULATOR_HOST}, hardcoded.
 */
export function emulatorsWanted(
  store: { __QUIZ_EMULATORS__?: unknown } = globalThis,
): boolean {
  return store.__QUIZ_EMULATORS__ === true;
}

/**
 * Auth emulator origin. Built here so `firebase.ts` does not concatenate a URL
 * ad hoc from values it could have read off the page.
 */
export function authEmulatorUrl(): string {
  return `http://${EMULATOR_HOST}:${EMULATOR_PORTS.auth}`;
}
