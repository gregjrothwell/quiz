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
 * Not part of the build or the test suite: it talks to the live project. It
 * never calls `recordGame`, so nothing lands on the season board.
 */

import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  getDocsFromServer,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';
import { attachDebugAppCheck } from './appCheck';
import { liveAnswers, type AnswerDoc } from '../src/engine/answers';
import { reduce, type Action } from '../src/engine/reducer';
import { randomRoomCode } from '../src/engine/roomCode';
import {
  commitmentDoc,
  freshNonce,
  hasCommitted,
  openedPick,
  revealDoc,
  sealedPickDocFrom,
  type SealedPickDoc,
} from '../src/engine/sealedPick';
import type { StandoffPick } from '../src/engine/standoff';
import { createRoom, currentQuestion, type QuizQuestion, type RoomState } from '../src/engine/state';
import { resolveAnswer } from '../src/lib/vault';

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
const GATE_SLACK_MS = 1_000;

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

type PersistedRoom = Omit<RoomState, 'answers'>;

/** Mirrors `useRoom.toUpdate`: never the whole `players` map, `scores` per field. */
function toUpdate(state: RoomState): Record<string, unknown> {
  const update: Record<string, unknown> = { ...state };
  delete update.answers;
  delete update.players;
  delete update.scores;
  for (const [uid, score] of Object.entries(state.scores)) update[`scores.${uid}`] = score;
  if (state.phase === 'question') update.openedAt = serverTimestamp();
  return update;
}

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
  const persisted: Record<string, unknown> = { ...fresh };
  delete persisted.answers;
  await setDoc(reference, {
    ...persisted,
    expiresAt: Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1_000),
  });
  console.log(`${stamp()}  Room ${code} created by Host`);

  const view: { latest: PersistedRoom | null } = { latest: null };
  const stopRoom = onSnapshot(reference, (snapshot) => {
    if (snapshot.exists()) view.latest = snapshot.data() as PersistedRoom;
  });
  const answers: { live: Record<string, AnswerDoc> } = { live: {} };
  const stopAnswers = onSnapshot(collection(host.db, 'rooms', code, 'answers'), (snapshot) => {
    answers.live = Object.fromEntries(snapshot.docs.map((d) => [d.id, d.data() as AnswerDoc]));
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
    stopRoom();
    stopAnswers();
    stopPicks();
    for (const client of clients) await deleteApp(client.app);
  };

  const dispatch = async (actions: Action[]): Promise<RoomState> => {
    const latest = view.latest;
    if (!latest) throw new Error('no room to fold over');
    const current: RoomState = {
      ...latest,
      code,
      answers: liveAnswers(latest.players, latest.index, answers.live),
    };
    const next = actions.reduce(reduce, current);
    await updateDoc(reference, toUpdate(next) as Partial<DocumentData>);
    return next;
  };

  const waitFor = async (what: string, ready: () => boolean): Promise<void> => {
    for (let waited = 0; waited < 15_000; waited += 200) {
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
  await dispatch([
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
      return setDoc(doc(collection(client.db, 'rooms', code, 'answers'), client.uid), answer);
    }),
  );
  await sleep(DURATION_SECS * 1_000 + GATE_SLACK_MS);

  const open = view.latest ? currentQuestion({ ...view.latest, code, answers: {} }) : null;
  if (!open) throw new Error('no open question to reveal');
  const correctIndex = await resolveAnswer(host.db, code, open);
  await dispatch([{ type: 'reveal', correctIndex, questionId: open.id }]);
  await dispatch([{ type: 'next', at: Date.now() }]);
  await waitFor('the last scoreboard', () => view.latest?.phase === 'scoreboard');

  console.log(`${stamp()}  >>> WRITING next — into the final`);
  try {
    await dispatch([{ type: 'next', at: Date.now() }]);
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

  await dispatch([{ type: 'openPicks' }]);
  await waitFor('the pick stage', () => view.latest?.standoff?.stage === 'pick');

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

  await dispatch([{ type: 'closePicks', sealed: expectedPair }]);
  await waitFor('the whistle', () => view.latest?.standoff?.stage === 'closed');

  // Ada opens first. Bo can now read it — which is the moment a re-commit pays.
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

  // The quizmaster's device opens both against their commitments.
  const server = await getDocsFromServer(collection(host.db, 'rooms', code, 'standoff'));
  const onServer = Object.fromEntries(server.docs.map((d) => [d.id, sealedPickDocFrom(d.data()) ?? undefined]));
  const verified: Record<string, StandoffPick | null> = {};
  for (const uid of expectedPair) verified[uid] = await openedPick(onServer[uid], gameId, uid);
  console.log(`${stamp()}  Opened: Ada ${verified[ada.uid] ?? 'nothing'}, Bo ${verified[bo.uid] ?? 'nothing'}`);

  await dispatch([{ type: 'settle', picks: verified }]);
  await waitFor('the reveal', () => view.latest?.standoff?.stage === 'revealed');
  await dispatch([{ type: 'next', at: Date.now() }]);
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

main().catch((error: unknown) => {
  console.error('\nfinal-harness failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
