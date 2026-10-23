import { EMULATOR_HOST, EMULATOR_PORTS } from '../src/lib/emulators';

/** The project `npm run e2e` passes to the emulators. Public id, same as `.firebaserc`. */
const PROJECT_ID = 'quiz-d686e';

export interface EmulatorClearRequest {
  url: string;
  /** Sent with the wipe. Absent means no extra headers. */
  headers?: Record<string, string>;
}

/**
 * Where a wipe goes. Firestore and Auth are the emulator control endpoints.
 * The RTDB namespace is the database URL's subdomain: the emulator loads rules
 * into `<project>-default-rtdb` and the e2e clients connect there
 * (`e2e/nodeClient.ts`). A DELETE there without a token is a client write, and
 * the repo rules refuse it, so the request carries the emulator's admin token
 * — the same `Bearer owner` firebase-tools uses to import.
 */
export function emulatorClearRequests(): readonly EmulatorClearRequest[] {
  return [
    {
      url: `http://${EMULATOR_HOST}:${EMULATOR_PORTS.firestore}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    },
    {
      url: `http://${EMULATOR_HOST}:${EMULATOR_PORTS.auth}/emulator/v1/projects/${PROJECT_ID}/accounts`,
    },
    {
      url: `http://${EMULATOR_HOST}:${EMULATOR_PORTS.database}/.json?ns=${PROJECT_ID}-default-rtdb`,
      headers: { Authorization: 'Bearer owner' },
    },
  ];
}

/** Deletes every Auth account, Firestore document and RTDB node in the emulator. */
export async function clearEmulators(): Promise<void> {
  const results = await Promise.all(
    emulatorClearRequests().map(async ({ url, headers }) => {
      const response = await fetch(url, { method: 'DELETE', ...(headers ? { headers } : {}) });
      await response.text();
      return { url, status: response.status };
    }),
  );
  const failed = results.filter((result) => result.status < 200 || result.status >= 300);
  if (failed.length > 0) {
    const detail = failed.map((result) => `${String(result.status)} ${result.url}`).join('; ');
    throw new Error(`emulator clear failed: ${detail}`);
  }
}
