/**
 * App Check for the scripts that talk to the live project from Node.
 *
 * `check-rules`, `sync-harness` and `host-room` connect with the *client* SDK
 * and behave like extra browsers, which is the whole reason they can prove
 * anything about the security rules. App Check works by having a real browser
 * attest through reCAPTCHA — which Node cannot do, and never will. So the
 * moment Firestore enforcement is switched on, all three start failing with
 * permission errors, including the preflight that is supposed to be run before
 * every quiz.
 *
 * A registered debug token is the supported way out. It is set on the global
 * object *before* `initializeAppCheck`, and the SDK then skips attestation
 * entirely for that client.
 *
 * **The token is a real credential.** It bypasses App Check completely for
 * anybody holding it, which is exactly what it is for. It lives in
 * `.env.local`, which is gitignored, and it is revocable from App Check →
 * Manage debug tokens — which is the reason this is the supported route and
 * adding `localhost` to the reCAPTCHA allowed domains is not.
 */

import type { FirebaseApp } from 'firebase/app';

declare global {
  var FIREBASE_APPCHECK_DEBUG_TOKEN: string | boolean | undefined;
}

/**
 * Attaches a debug App Check token to a script's Firebase app.
 *
 * A no-op without `VITE_FIREBASE_APPCHECK_DEBUG_TOKEN`, so nothing changes for
 * anybody who has not set App Check up, and the scripts keep running exactly as
 * they did while enforcement is still off.
 *
 * Failures are reported and swallowed rather than thrown. While enforcement is
 * off, a script that cannot start App Check still does its job perfectly and
 * should not fail; once it is on, the request is refused by the server anyway
 * and *that* is the error worth surfacing — it names the real problem, where a
 * throw here would only ever say "App Check would not start".
 */
export async function attachDebugAppCheck(app: FirebaseApp): Promise<void> {
  const debugToken = process.env['VITE_FIREBASE_APPCHECK_DEBUG_TOKEN'];
  const apiKey = process.env['VITE_FIREBASE_API_KEY'];
  const appId = process.env['VITE_FIREBASE_APP_ID'];
  if (!debugToken || debugToken === 'true' || !apiKey || !appId) return;

  try {
    // Imported here rather than at the top of the file so a Node incompatibility
    // in a browser-targeted package cannot take the script down on load, before
    // it has had the chance to say what went wrong.
    const { initializeAppCheck, CustomProvider } = await import('firebase/app-check');

    initializeAppCheck(app, {
      provider: new CustomProvider({ getToken: () => exchangeDebugToken(apiKey, appId, debugToken) }),
      isTokenAutoRefreshEnabled: false,
    });

    /*
      Exchanged once, eagerly, rather than left for the first request that needs
      it. `getToken` is lazy and enforcement is off, so nothing would call it —
      and the whole question this preflight has to answer is whether these
      scripts will still work *after* enforcement is switched on. Left lazy, it
      would report a clean run right up until the day it mattered.

      Only the expiry is printed. The token is a bearer credential and the debug
      token behind it is worse: both would end up in terminal scrollback.
    */
    const { expireTimeMillis } = await exchangeDebugToken(apiKey, appId, debugToken);
    const minutes = Math.round((expireTimeMillis - Date.now()) / 60_000);
    console.log(`  App Check: debug token accepted, good for ${minutes} minutes.`);
  } catch (cause: unknown) {
    console.warn(
      `  App Check did not start for this client: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
    console.warn('  Fine while enforcement is off. Once it is on, this script will be denied.');
  }
}

/**
 * Trades the debug token for a real App Check token, over HTTP.
 *
 * **This is why the provider is `CustomProvider` and not `ReCaptchaV3Provider`,
 * which is what the browser uses.** Every `document` reference in
 * `@firebase/app-check` is in the reCAPTCHA path — it injects a div and two
 * script tags — so constructing that provider under Node fails with `document
 * is not defined` before any token is ever requested. `CustomProvider` never
 * goes near reCAPTCHA, and `initializeAppCheck` itself is DOM-free.
 *
 * The token is exchanged rather than attested because Node has nothing to
 * attest with, which is the whole reason debug tokens exist. The endpoint is
 * the same one the browser SDK calls internally once it has a debug token.
 */
async function exchangeDebugToken(
  apiKey: string,
  appId: string,
  debugToken: string,
): Promise<{ token: string; expireTimeMillis: number }> {
  // `1:252734199790:web:…` — the project number is the second field, and the
  // endpoint wants it rather than the project id.
  const projectNumber = appId.split(':')[1];
  if (!projectNumber) throw new Error(`VITE_FIREBASE_APP_ID is not the expected shape: ${appId}`);

  const response = await fetch(
    `https://firebaseappcheck.googleapis.com/v1/projects/${projectNumber}/apps/${appId}:exchangeDebugToken?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ debugToken }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `exchangeDebugToken returned ${response.status}. The likely cause is that this token is `
        + 'not safelisted: Firebase console -> App Check -> Apps -> ⋮ -> Manage debug tokens.',
    );
  }

  const { token, ttl } = (await response.json()) as { token: string; ttl: string };
  // `ttl` arrives as a protobuf duration — '3600s'.
  return { token, expireTimeMillis: Date.now() + Number.parseFloat(ttl) * 1_000 };
}
