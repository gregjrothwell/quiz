/**
 * Plays a Share or Shaft final in a live room, end to end.
 *
 *   npm run final-harness
 *
 * Three clients: a host and two answerers. One question, answered so the two
 * answerers finish first and second, then the final — talk, the commitments,
 * the whistle, the reveals, the settle — and the room to `finished`. Every
 * write is the document the app writes, through the same engine functions
 * `useStandoff` calls: `commitmentDoc` on the tap, `revealDoc` after the
 * whistle, `openedPick` on the quizmaster's device before the settle.
 *
 * **Inside the live final it also tries the two moves the rules exist to
 * stop**, at the only moment they would pay: after one finalist has revealed,
 * the other tries to rewrite their commitment, and then to delete it. Both must
 * be refused. `check-rules` makes the same attempts against a probe room; this
 * makes them in a real final, against the published ruleset.
 *
 * **Run it after the paste.** Against a ruleset without the `standoff` phase
 * the final is refused on the write that opens it, and this says so.
 *
 * The expected numbers are written by hand from the table in
 * docs/decisions/share-or-shaft.md, not computed by `settleStandoff`: deriving
 * them from the function under test would only prove the engine agrees with
 * itself.
 *
 * **The host is the app's own** (`src/host/`, run by `nodeHost.ts`; host-loop.md
 * step 3): it beats, reveals on the clock, and moves the final on — ends the
 * talk after its minute, blows the whistle once both have committed, opens the
 * picks and settles. This script presses only Start and Next, and plays the two
 * finalists. So this is the live allow case for the host's real `openPicks`,
 * `closePicks` and `settle`, under the host-only rule. It takes a minute longer
 * than it did when it ended the talk itself.
 *
 * Not part of the build or the test suite: it talks to the live project. It
 * never calls `recordGame`, so nothing lands on the season board. The host keeps
 * the round in `games/`, as the app's does — one document per run.
 */

import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  setDoc,
  Timestamp,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';
// The vault's candidates go over Lite, as the app sends them — see `resolveAnswer`.
import { getFirestore as getLiteFirestore } from 'firebase/firestore/lite';
import { attachDebugAppCheck } from './appCheck';
import { startNodeHost } from './nodeHost';
import { lightLamp } from './lamp';
import type { AnswerDoc } from '../src/engine/answers';
import { reduce } from '../src/engine/reducer';
import { randomRoomCode } from '../src/engine/roomCode';
import {
  commitmentDoc,
  freshNonce,
  hasCommitted,
  revealDoc,
  sealedPickDocFrom,
  type SealedPickDoc,
} from '../src/engine/sealedPick';
import type { StandoffPick } from '../src/engine/standoff';
import { createRoom, type QuizQuestion } from '../src/engine/state';
import { toPersisted, type PersistedRoom } from '../src/lib/roomDoc';

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

const DURATION_SECS = 10;

/** Seeded by `seed-vault` with 'The first one', as `rank-harness` uses it. */
const QUESTION: QuizQuestion = {
  id: 'hq0',
  prompt: 'Harness question 1: which is the first option?',
  options: ['The first one', 'The second one', 'The third one', 'The fourth one'],
  correctIndex: null,
  category: 'General Knowledge',
  difficulty: 'easy',
};

/**
 * Ada first at 1,000 and Bo second at 900, from the rank table. The host
 * answers nothing and sits third on zero. Ada shafts and Bo shares, so by the
 * table Ada takes the whole pot of 1,900 and Bo goes home with nothing.
 */
const ADA = { name: 'Ada', elapsedMs: 1_200, pick: 'shaft' as StandoffPick, before: 1_000, after: 1_900 };
const BO = { name: 'Bo', elapsedMs: 2_400, pick: 'share' as StandoffPick, before: 900, after: 0 };

interface Client {
  name: string;
  uid: string;
  app: FirebaseApp;
  db: Firestore;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const stamp = (): string => new Date().toISOString().slice(11, 23);

async function makeClient(name: string, index: number): Promise<Client> {
  const app = initializeApp(config, `final-${index}`);
  await attachDebugAppCheck(app);
  const credential = await signInAnonymously(getAuth(app));
  return { name, uid: credential.user.uid, app, db: getFirestore(app) };
}

function isPermissionDenied(error: unknown): boolean {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  return code === 'permission-denied';
}

async function main(): Promise<void> {
  console.log(`Standing up three clients against ${config.projectId}…\n`);
  const host = await makeClient('Host', 0);
  const ada = await makeClient(ADA.name, 1);
  const bo = await makeClient(BO.name, 2);
  const clients = [host, ada, bo];

  const code = randomRoomCode();
  const reference = doc(host.db, 'rooms', code);
  const fresh = reduce(createRoom(code), { type: 'join', uid: host.uid, name: host.name, at: Date.now() });
  // Hosted, as the app makes a room since W3: the creator is host.
  await setDoc(reference, {
    ...toPersisted(fresh),
    hostUid: host.uid,
    expiresAt: Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1_000),
  });
  const running = startNodeHost({
    db: host.db,
    lite: getLiteFirestore(host.app),
    code,
    uid: host.uid,
    log: (line) => console.log(`${stamp()}  ${line}`),
  });
  console.log(`${stamp()}  Room ${code} created by Host, who hosts it`);

  const view: { latest: PersistedRoom | null } = { latest: null };
  const stopRoom = onSnapshot(reference, (snapshot) => {
    if (snapshot.exists()) view.latest = snapshot.data() as PersistedRoom;
  });
  const picks: { live: Record<string, SealedPickDoc> } = { live: {} };
  const stopPicks = onSnapshot(collection(host.db, 'rooms', code, 'standoff'), (snapshot) => {
    const next: Record<string, SealedPickDoc> = {};
    for (const document of snapshot.docs) {
      const parsed = sealedPickDocFrom(document.data());
      if (parsed) next[document.id] = parsed;
    }
    picks.live = next;
  });

  const teardown = async (): Promise<void> => {
    running.stop();
    for (const failure of running.failures()) console.log(`  host: ${failure}`);
    stopRoom();
    stopPicks();
    for (const client of clients) await deleteApp(client.app);
  };

  const waitFor = async (what: string, ready: () => boolean, ms = 15_000): Promise<void> => {
    for (let waited = 0; waited < ms; waited += 200) {
      if (ready()) return;
      await sleep(200);
    }
    throw new Error(`timed out waiting for ${what}`);
  };

  await sleep(800);
  await Promise.all(
    [ada, bo].map((client) =>
      updateDoc(doc(client.db, 'rooms', code), {
        [`players.${client.uid}`]: { name: client.name, joinedAt: Date.now() },
        [`scores.${client.uid}`]: 0,
      }),
    ),
  );
  await waitFor('both players in the lobby', () => Object.keys(view.latest?.players ?? {}).length === 3);
  console.log(`${stamp()}  Ada and Bo are in`);

  const gameId = `final-${Date.now()}`;
  await running.dispatch([
    {
      type: 'selectPack',
      packId: 'general-knowledge',
      packTitle: 'GK',
      questions: [QUESTION],
      wagerEnabled: false,
      stealEnabled: false,
      standoffEnabled: true,
    },
    { type: 'start', at: Date.now(), gameId, durationSecs: DURATION_SECS },
  ]);
  console.log(`${stamp()}  >>> question open, Share or Shaft to follow`);

  const finalists = [
    { client: ada, seat: ADA },
    { client: bo, seat: BO },
  ];
  await Promise.all(
    finalists.map(({ client, seat }) => {
      const answer: AnswerDoc = { optionIndex: 0, elapsedMs: seat.elapsedMs, questionIndex: 0 };
      // The lamp beside it, as the app lights it (W3).
      return Promise.all([
        setDoc(doc(collection(client.db, 'rooms', code, 'answers'), client.uid), answer),
        lightLamp(client.app, code, gameId, 0, client.uid),
      ]);
    }),
  );
  // The host reveals on its own once the clock and the vault's gate allow.
  await running.until((room) => room.phase === 'reveal', DURATION_SECS * 1_000 + 30_000);
  await running.dispatch([{ type: 'next', at: Date.now() }]);
  await waitFor('the last scoreboard', () => view.latest?.phase === 'scoreboard');

  console.log(`${stamp()}  >>> WRITING next — into the final`);
  try {
    await running.dispatch([{ type: 'next', at: Date.now() }]);
  } catch (error) {
    await teardown();
    if (isPermissionDenied(error)) {
      console.log('\nThe published rules refuse the `standoff` phase. Paste firestore.rules, then rerun.');
      process.exitCode = 1;
      return;
    }
    throw error;
  }
  await waitFor('the final to open', () => view.latest?.phase === 'standoff');

  const opened = view.latest?.standoff;
  const failures: string[] = [];
  if (!opened) throw new Error('the room is in the final with no standoff on it');
  const expectedPair = [ada.uid, bo.uid];
  if (opened.finalists.join() !== expectedPair.join()) {
    failures.push(`finalists were ${opened.finalists.join(', ')}, not Ada then Bo`);
  }
  if (opened.stakes[ada.uid] !== ADA.before || opened.stakes[bo.uid] !== BO.before) {
    failures.push(`stakes were ${JSON.stringify(opened.stakes)}, not 1,000 and 900`);
  }
  console.log(`${stamp()}  Final open: Ada ${opened.stakes[ada.uid]} v Bo ${opened.stakes[bo.uid]}, host third`);

  // The host ends the talk once its minute is up.
  await waitFor('the host to open the picks', () => view.latest?.standoff?.stage === 'pick', 90_000);

  // Each finalist commits exactly as `useStandoff.pick` does.
  const nonces = new Map([
    [ada.uid, freshNonce()],
    [bo.uid, freshNonce()],
  ]);
  await Promise.all(
    finalists.map(async ({ client, seat }) => {
      const written = await commitmentDoc(seat.pick, nonces.get(client.uid) ?? '', gameId, client.uid);
      await setDoc(doc(client.db, 'rooms', code, 'standoff', client.uid), written);
    }),
  );
  await waitFor('both commitments', () =>
    expectedPair.every((uid) => hasCommitted(picks.live[uid], gameId)),
  );
  console.log(`${stamp()}  Both locked in. Neither document holds a pick:`);
  for (const uid of expectedPair) {
    const held = picks.live[uid];
    const leaked = held && ('pick' in held || /share|shaft/.test(JSON.stringify(held)));
    if (leaked) failures.push(`a commitment carries the pick before the whistle: ${JSON.stringify(held)}`);
    console.log(`    ${uid === ada.uid ? 'Ada' : 'Bo '} ${JSON.stringify(held)}`);
  }

  // The host blows the whistle once both have committed.
  await waitFor('the whistle', () => view.latest?.standoff?.stage === 'closed');
  const sealed = view.latest?.standoff?.sealed ?? [];
  if (sealed.join() !== expectedPair.join()) failures.push(`the whistle sealed ${sealed.join(', ')}, not Ada then Bo`);

  // Ada opens first. Bo can now read it — which is the moment a re-commit pays.
  // The host settles five seconds after the whistle whether or not Bo has
  // opened (`REVEAL_GRACE_MS`), so the three attempts below must fit inside
  // that. They are three writes; if the settle beats Bo, the run says so below.
  await updateDoc(doc(ada.db, 'rooms', code, 'standoff', ada.uid), revealDoc(ADA.pick, nonces.get(ada.uid) ?? ''));
  await waitFor("Ada's reveal", () => picks.live[ada.uid]?.pick !== undefined);
  console.log(`${stamp()}  Ada has revealed. Bo tries to change his mind:`);

  const cheat = await commitmentDoc('shaft', freshNonce(), gameId, bo.uid);
  const attempts: Array<[string, () => Promise<unknown>]> = [
    ['rewrite his commitment', () => setDoc(doc(bo.db, 'rooms', code, 'standoff', bo.uid), cheat)],
    ['hop to another game and back', () =>
      setDoc(doc(bo.db, 'rooms', code, 'standoff', bo.uid), { ...cheat, gameId: `${gameId}-elsewhere` })],
    ['delete it mid-final', () => deleteDoc(doc(bo.db, 'rooms', code, 'standoff', bo.uid))],
  ];
  for (const [label, attempt] of attempts) {
    try {
      await attempt();
      failures.push(`Bo could ${label} after reading Ada's reveal`);
      console.log(`    ✗ ${label}: ALLOWED`);
    } catch (error) {
      if (!isPermissionDenied(error)) throw error;
      console.log(`    ✓ ${label}: refused`);
    }
  }

  await updateDoc(doc(bo.db, 'rooms', code, 'standoff', bo.uid), revealDoc(BO.pick, nonces.get(bo.uid) ?? ''));
  await waitFor("Bo's reveal", () => picks.live[bo.uid]?.pick !== undefined);

  // The host opens both against their commitments and settles.
  await waitFor('the settle', () => view.latest?.standoff?.stage === 'revealed');
  await running.dispatch([{ type: 'next', at: Date.now() }]);
  await waitFor('finished', () => view.latest?.phase === 'finished');

  // From the server, past the cache: the cache holds this process's own writes.
  const ended = (await getDocFromServer(reference)).data() as PersistedRoom | undefined;
  if (!ended) throw new Error('the room vanished');
  const expect = [
    ['Ada', ended.scores[ada.uid], ADA.after],
    ['Bo', ended.scores[bo.uid], BO.after],
    ['Host', ended.scores[host.uid], 0],
  ] as const;
  console.log(`\n${stamp()}  What the room holds at the whistle, read back from the server`);
  for (const [name, got, want] of expect) {
    const ok = got === want;
    if (!ok) failures.push(`${name} finished on ${got ?? 'nothing'}, the table says ${want}`);
    console.log(`    ${name.padEnd(5)} expected ${String(want).padStart(5)}  holds ${String(got ?? '—').padStart(5)}  ${ok ? '✓' : '✗'}`);
  }
  const recorded = ended.standoff?.picks ?? {};
  if (recorded[ada.uid] !== ADA.pick || recorded[bo.uid] !== BO.pick) {
    failures.push(`the room recorded ${JSON.stringify(recorded)}, not shaft and share`);
  }
  if (ended.phase !== 'finished') failures.push(`the room ended in ${ended.phase}, not finished`);

  await teardown();

  if (failures.length > 0) {
    console.log('\nTHE FINAL DOES NOT HOLD:');
    for (const failure of failures) console.log(`  ✗ ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `\nShare or Shaft holds in room ${code}: Ada shafted, Bo shared, Ada took all 1,900 and\n`
      + 'Bo went home with nothing — paid by the live project and read back from the server.\n'
      + 'After Ada revealed, Bo could not rewrite, hop or delete his commitment.',
  );
}

main()
  .catch((error: unknown) => {
    console.error('\nfinal-harness failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  // The lamps' Realtime Database connection outlives `deleteApp` and holds the
  // event loop open, `goOffline` or not (measured 15 Oct 2026), so the run
  // ends here, with its exit code, as `check-rules` does.
  .finally(() => process.exit());
