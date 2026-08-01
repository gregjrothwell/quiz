/**
 * Checks that the published security rules match what the app needs — and, since
 * the security review, that they still refuse what they are supposed to refuse.
 * Run with:
 *
 *   npm run check-rules
 *
 * Both rulesets are published by hand in the Firebase console, and an
 * unpublished one has now broken the game twice — first Firestore, then the
 * Realtime Database, where every presence write was rejected and the room
 * quietly filled with ghosts.
 *
 * The deny checks matter for a different reason. A hand-paste can fail in two
 * directions, and the permissive direction is silent: everything works, and
 * nobody finds out that `list` is still allowed until a room full of colleagues
 * has been enumerated. Every tightening in firestore.rules therefore has a check
 * here that fails loudly if the console is still serving the old ruleset.
 *
 * Nothing here writes to a real room or the live season. The season checks use a
 * throwaway season id and tidy up after themselves; the Realtime Database checks
 * do the same.
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { get, getDatabase, ref, remove, set } from 'firebase/database';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  query,
  setDoc,
} from 'firebase/firestore';

/**
 * The rule is `match /seasons/{season}/players/{uid}`, so any season id
 * exercises the same path. Using a literal keeps this script out of the app's
 * module graph — importing the real constant drags in src/firebase.ts, which
 * reads `import.meta.env` and only exists under Vite. It also means the write
 * checks below cannot touch the season anybody is actually playing.
 */
const ANY_SEASON = 'rules-check';

/**
 * Outside the room-code alphabet, so a stray document can never be joined from
 * the UI. Not wrapped in double underscores — Firestore reserves those and
 * rejects the write before the rules are ever consulted, which reads as an
 * inconclusive check rather than a passing one.
 */
const PROBE_ROOM = 'rules-check-room';

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

/**
 * A denial has to be recognised as a denial. Treating *any* rejection as proof
 * that the rules are working would turn a flaky network into a clean bill of
 * health, which is the one result this script must never invent.
 */
function isPermissionDenied(error: unknown): boolean {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : '';
  const message = error instanceof Error ? error.message : String(error);
  // Firestore says `permission-denied`, the Realtime Database says
  // `PERMISSION_DENIED` on the code and a bare "Permission denied" in the
  // message. Flattening the separators matches all three.
  const haystack = `${code} ${message}`.toLowerCase().replace(/[-_]/g, ' ');
  return haystack.includes('permission denied');
}

interface Check {
  label: string;
  /** Whether the rules are supposed to let this through. */
  expect: 'allow' | 'deny';
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

  const presence = ref(rtdb, `presence/${PROBE_ROOM}/${uid}`);
  const ownSeasonRow = doc(db, 'seasons', ANY_SEASON, 'players', uid);

  const validSeasonRow = {
    name: 'Rules check',
    played: 1,
    wins: 1,
    points: 1000,
    best: 1000,
    lastGame: 'rules-check',
    lastPlayed: Date.now(),
  };

  const checks: Check[] = [
    {
      label: 'Firestore   · read a room',
      expect: 'allow',
      hint: 'publish firestore.rules',
      run: () => getDoc(doc(db, 'rooms', 'ZZZZ')),
    },
    {
      label: 'Firestore   · list every room',
      expect: 'deny',
      hint: 'firestore.rules still grants `list` on /rooms — anyone signed in can '
        + 'enumerate every live room, its players and its questions. Republish.',
      run: () => getDocs(query(collection(db, 'rooms'), limit(1))),
    },
    {
      label: 'Firestore   · create a room owned by someone else',
      expect: 'deny',
      hint: 'firestore.rules lets a room be created without its creator in it',
      run: () =>
        setDoc(doc(db, 'rooms', PROBE_ROOM), {
          code: PROBE_ROOM,
          phase: 'lobby',
          players: { 'not-my-uid': { name: 'Probe', joinedAt: Date.now() } },
          packId: null,
          packTitle: null,
          questions: [],
          index: 0,
          questionOpenedAt: null,
          scores: {},
          lastDeltas: {},
          skipped: [],
          gameId: null,
        }),
    },
    {
      label: "Firestore   · write another player's answer",
      expect: 'deny',
      hint: 'firestore.rules lets one player overwrite another player’s answer',
      run: () =>
        setDoc(doc(db, 'rooms', 'ZZZZ', 'answers', 'not-my-uid'), {
          optionIndex: 0,
          elapsedMs: 0,
          questionIndex: 0,
        }),
    },
    {
      label: 'Firestore   · read the season table',
      expect: 'allow',
      hint: 'firestore.rules is missing the seasons/{season}/players block',
      run: () => getDocs(query(collection(db, 'seasons', ANY_SEASON, 'players'), limit(1))),
    },
    {
      // The one path recordGame depends on, exercised end to end. It had never
      // run against a real project before the security review.
      label: 'Firestore   · write your own season row',
      expect: 'allow',
      hint: 'firestore.rules is missing the seasons/{season}/players block — '
        + 'the final screen will fail to bank anybody’s result',
      run: () => setDoc(ownSeasonRow, validSeasonRow),
    },
    {
      label: 'Firestore   · write an impossible season row (wins > played)',
      expect: 'deny',
      hint: 'firestore.rules is missing the season range checks',
      run: () => setDoc(ownSeasonRow, { ...validSeasonRow, played: 1, wins: 99 }),
    },
    {
      label: "Firestore   · write someone else's season row",
      expect: 'deny',
      hint: 'firestore.rules lets anyone rewrite another player’s standings',
      run: () =>
        setDoc(doc(db, 'seasons', ANY_SEASON, 'players', 'not-my-uid'), validSeasonRow),
    },
    {
      label: 'Realtime DB · write presence',
      expect: 'allow',
      hint: 'publish database.rules.json — closed tabs will never be cleaned up',
      run: () => set(presence, { name: 'Rules check', at: Date.now() }),
    },
    {
      label: 'Realtime DB · read presence',
      expect: 'allow',
      hint: 'publish database.rules.json',
      run: () => get(ref(rtdb, `presence/${PROBE_ROOM}`)),
    },
    {
      label: "Realtime DB · write another player's presence",
      expect: 'deny',
      hint: 'database.rules.json lets anyone write presence as somebody else',
      run: () => set(ref(rtdb, `presence/${PROBE_ROOM}/not-my-uid`), { name: 'X', at: Date.now() }),
    },
    {
      label: 'Realtime DB · attach an unexpected field to your presence',
      expect: 'deny',
      hint: 'database.rules.json is missing the `$other` validate — presence '
        + 'entries can carry arbitrary payloads',
      run: () => set(presence, { name: 'Rules check', at: Date.now(), junk: 'x'.repeat(64) }),
    },
    {
      label: 'Realtime DB · read the whole database',
      expect: 'deny',
      hint: 'database.rules.json is missing its root deny',
      run: () => get(ref(rtdb, '/')),
    },
  ];

  let failed = 0;

  for (const check of checks) {
    let outcome: 'allowed' | 'denied' | 'errored' = 'allowed';
    let detail = '';

    try {
      await check.run();
    } catch (error) {
      outcome = isPermissionDenied(error) ? 'denied' : 'errored';
      detail = (error instanceof Error ? error.message : String(error)).split('\n')[0] ?? '';
    }

    const expected = check.expect === 'allow' ? 'allowed' : 'denied';

    if (outcome === expected) {
      console.log(`  PASS  ${check.label}`);
      continue;
    }

    failed += 1;
    console.log(`  FAIL  ${check.label}`);
    if (outcome === 'errored') {
      console.log('        did not complete, so nothing was proved either way');
      console.log(`        ${detail}`);
    } else {
      console.log(`        expected to be ${expected}, was ${outcome}`);
      if (detail) console.log(`        ${detail}`);
      console.log(`        → ${check.hint}`);
    }
  }

  // Best effort. A leftover under the throwaway season id or the probe room is
  // never read by the app, and only exists at all if a check already failed.
  await deleteDoc(ownSeasonRow).catch(() => undefined);
  await remove(presence).catch(() => undefined);

  console.log(
    failed === 0
      ? '\nBoth rulesets are live, and still refusing what they should.'
      : `\n${failed} check(s) failed — republish the rules before playing.`,
  );

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error('check-rules failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
