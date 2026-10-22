/**
 * Reads back a rig check (docs/decisions/rig-in-your-hand.md, P3). Run with:
 *
 *   npm run read-rig -- ABCD
 *
 * Prints, for the room's last run, how many phones painted each cue, the spread
 * between the first and the last, how late the room was together, and whether
 * the run passes the line in the story: 90% of devices within ±50 ms of the
 * median on 9 cues of 10. The arithmetic is `src/engine/rigProbe.ts`.
 *
 * Reads as any member reads, with the App Check debug token. Writes nothing.
 * Not part of the build or the test suite: it talks to the live project.
 */

import { deleteApp, initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { get, getDatabase, goOffline, ref } from 'firebase/database';
import { RIG_PASS_CUES, RIG_PASS_SHARE, RIG_TOLERANCE_MS, cueTimes, reportRig, rigRunFrom } from '../src/engine/rigProbe';
import { attachDebugAppCheck } from './appCheck';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — run with --env-file=.env.local`);
  return value;
}

async function main(): Promise<void> {
  const code = (process.argv[2] ?? '').toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(code)) throw new Error('usage: npm run read-rig -- <room code>');

  const app = initializeApp(
    {
      apiKey: required('VITE_FIREBASE_API_KEY'),
      authDomain: required('VITE_FIREBASE_AUTH_DOMAIN'),
      projectId: required('VITE_FIREBASE_PROJECT_ID'),
      appId: required('VITE_FIREBASE_APP_ID'),
      databaseURL: required('VITE_FIREBASE_DATABASE_URL'),
    },
    'read-rig',
  );
  await attachDebugAppCheck(app);
  await signInAnonymously(getAuth(app));
  const db = getDatabase(app);

  const run = rigRunFrom((await get(ref(db, `rig/${code}/run`))).val());
  if (!run) {
    console.log(`Room ${code} has no rig check run.`);
  } else {
    const raw = ((await get(ref(db, `rig/${code}/paints/${run.id}`))).val() ?? {}) as Record<string, Record<string, unknown>>;
    const painted: Record<number, Record<string, number>> = {};
    for (const [cue, byUid] of Object.entries(raw)) {
      painted[Number(cue)] = Object.fromEntries(
        Object.entries(byUid).filter((entry): entry is [string, number] => typeof entry[1] === 'number'),
      );
    }
    const report = reportRig(painted, cueTimes(run.startAt));
    console.log(`\nRig check ${run.id} in room ${code}: ${report.devices} devices\n`);
    console.log('  cue  devices  spread  late   within ±' + String(RIG_TOLERANCE_MS) + ' ms');
    for (const cue of report.cues) {
      console.log(
        `  ${String(cue.cue + 1).padStart(3)}  ${String(cue.devices).padStart(7)}  ${`${String(Math.round(cue.spreadMs))}ms`.padStart(6)}` +
          `  ${`${String(Math.round(cue.lateMs))}ms`.padStart(5)}   ${String(Math.round(cue.withinShare * 100))}%`,
      );
    }
    console.log(
      `\n${report.pass ? 'PASSES' : 'DOES NOT PASS'}: ${report.cuesPassed} of ${report.cues.length} cues had ` +
        `${Math.round(RIG_PASS_SHARE * 100)}% of devices within ±${RIG_TOLERANCE_MS} ms (needs ${RIG_PASS_CUES}).`,
    );
  }

  goOffline(db);
  await deleteApp(app);
}

main()
  .catch((error: unknown) => {
    console.error('read-rig failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
