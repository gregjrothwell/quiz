/**
 * Drives a real room with N independent Firebase clients, to see what the game
 * actually does with more than one person in it. Run with:
 *
 *   npx tsx --env-file=.env.local scripts/sync-harness.ts [players]
 *
 * Each client is a separate FirebaseApp with its own anonymous uid, mirroring
 * exactly what useRoom does — one room-document listener, one answers listener,
 * and the same read-modify-write dispatch. It reports how long each client takes
 * to see a phase change, and whether anybody gets dropped from the room.
 *
 * Not part of the build or the test suite: it talks to the live project.
 */

import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  setDoc,
  serverTimestamp,
  updateDoc,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';
import { reduce, type Action } from '../src/engine/reducer';
import { createRoom, type RoomState } from '../src/engine/state';
import { randomRoomCode } from '../src/engine/roomCode';
import type { QuizQuestion } from '../src/engine/state';

/** Reads a required value from .env.local, so a missing one fails with a name. */
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

type PersistedRoom = Omit<RoomState, 'answers'>;

function toPersisted(state: RoomState): PersistedRoom {
  const persisted: Record<string, unknown> = { ...state };
  delete persisted.answers;
  return persisted as unknown as PersistedRoom;
}

/**
 * Mirrors useRoom.toUpdate: never write `players`, merge `scores` per player,
 * and let the server stamp `openedAt` when a question opens — the rules reject
 * anything else, so a harness that skipped it would fail on permissions rather
 * than measuring what it came to measure.
 */
function toUpdate(state: RoomState): Record<string, unknown> {
  const update: Record<string, unknown> = { ...toPersisted(state) };
  delete update.players;
  delete update.scores;
  for (const [uid, score] of Object.entries(state.scores)) {
    update[`scores.${uid}`] = score;
  }
  if (state.phase === 'question') update.openedAt = serverTimestamp();
  return update;
}

const QUESTIONS: QuizQuestion[] = Array.from({ length: 3 }, (_, i) => ({
  id: `q${i}`,
  prompt: `Harness question ${i + 1}?`,
  options: ['A', 'B', 'C', 'D'],
  correctIndex: null,
  category: 'General Knowledge',
  difficulty: 'easy',
}));

interface Client {
  name: string;
  uid: string;
  db: Firestore;
  app: FirebaseApp;
  /** Latest snapshot this client has received. */
  seen: PersistedRoom | null;
  /** Phase transitions observed, with the time they landed. */
  log: { phase: string; players: number; at: number }[];
  stop: () => void;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function makeClient(index: number): Promise<Client> {
  const app = initializeApp(config, `harness-${index}`);
  const auth = getAuth(app);
  const credential = await signInAnonymously(auth);
  return {
    name: `P${index}`,
    uid: credential.user.uid,
    app,
    db: getFirestore(app),
    seen: null,
    log: [],
    stop: () => undefined,
  };
}

function watch(client: Client, code: string): void {
  client.stop = onSnapshot(
    doc(client.db, 'rooms', code),
    (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data() as PersistedRoom;
      const last = client.log.at(-1);
      const players = Object.keys(data.players).length;
      client.seen = data;
      if (!last || last.phase !== data.phase || last.players !== players) {
        client.log.push({ phase: data.phase, players, at: Date.now() });
      }
    },
    (cause) => {
      console.error(`  ${client.name} listener error: ${cause.message}`);
    },
  );
}

/**
 * Mirrors useRoom.dispatch: fold actions over the client's own view, write it
 * back.
 *
 * `view` is passed in rather than read here, because the real thing works the
 * same way: `handleStart` closes over the room from the render it was created
 * in, then awaits `loadPackQuestions` — a network fetch — before dispatching.
 * Everything that joins during that fetch is missing from the snapshot being
 * written back.
 */
async function dispatch(
  client: Client,
  code: string,
  actions: Action[],
  view?: PersistedRoom,
): Promise<void> {
  const seen = view ?? client.seen;
  if (!seen) throw new Error(`${client.name} has no room snapshot yet`);
  const current: RoomState = { ...seen, code, answers: {} };
  const next = actions.reduce(reduce, current);

  // `LEGACY_WRITE=1` restores the write that caused the bug — the whole document
  // including `players` — so the difference can be demonstrated rather than
  // asserted.
  const payload: Record<string, unknown> =
    process.env.LEGACY_WRITE === '1'
      ? // Still stamped, or the legacy write would be refused on permissions and
        // demonstrate nothing about the bug it exists to show.
        { ...toPersisted(next), ...(next.phase === 'question' ? { openedAt: serverTimestamp() } : {}) }
      : toUpdate(next);
  await updateDoc(doc(client.db, 'rooms', code), payload as Partial<DocumentData>);
}

async function joinRoom(client: Client, code: string): Promise<void> {
  const snapshot = await getDoc(doc(client.db, 'rooms', code));
  const existing = (snapshot.data() as PersistedRoom).players[client.uid];
  await updateDoc(doc(client.db, 'rooms', code), {
    [`players.${client.uid}`]: existing ?? { name: client.name, joinedAt: Date.now() },
    [`scores.${client.uid}`]: 0,
  });
}

async function main(): Promise<void> {
  const count = Number(process.argv[2] ?? 10);
  console.log(`Bringing up ${count} clients against ${config.projectId}…\n`);

  const clients = await Promise.all(
    Array.from({ length: count }, (_, i) => makeClient(i)),
  );

  // Host creates the room.
  const host = clients[0];
  if (!host) throw new Error('no clients');
  const code = randomRoomCode();
  const fresh = reduce(createRoom(code), {
    type: 'join',
    uid: host.uid,
    name: host.name,
    at: Date.now(),
  });
  await setDoc(doc(host.db, 'rooms', code), toPersisted(fresh));
  console.log(`Room ${code} created by ${host.name}`);

  for (const client of clients) watch(client, code);
  await sleep(600);

  // Half the room joins early, the way people do when the code is read out.
  const early = clients.slice(1, Math.ceil(count / 2));
  const late = clients.slice(Math.ceil(count / 2));

  console.log(`\n${early.length} players joining early…`);
  await Promise.all(early.map((client) => joinRoom(client, code)));
  await sleep(2500);
  console.log(`Host sees ${Object.keys(host.seen?.players ?? {}).length} players in the lobby`);

  // The host takes its snapshot, then spends a moment loading the pack — and the
  // rest of the room joins during exactly that window. This is the race a phase
  // transition loses when it writes the whole `players` map back.
  const staleView = host.seen;
  if (!staleView) throw new Error('host has no snapshot');

  console.log(`\nHost begins starting the round (snapshot taken)…`);
  console.log(`${late.length} more join while the pack loads…`);
  await Promise.all(late.map((client) => joinRoom(client, code)));
  await sleep(800);

  console.log('Host writes the round it prepared.');
  const startedAt = Date.now();
  await dispatch(
    host,
    code,
    [
      { type: 'selectPack', packId: 'general-knowledge', packTitle: 'GK', questions: QUESTIONS },
      { type: 'start', at: Date.now(), gameId: 'harness-game' },
    ],
    staleView,
  );

  await sleep(4000);

  console.log('\nWho saw the question, and how long it took:');
  let missed = 0;
  for (const client of clients) {
    const entry = client.log.find((e) => e.phase === 'question');
    const inRoom = client.seen?.players[client.uid] ? '' : '  ← DROPPED FROM ROOM';
    if (entry) {
      console.log(`  ${client.name.padEnd(4)} +${String(entry.at - startedAt).padStart(5)}ms${inRoom}`);
    } else {
      missed += 1;
      console.log(`  ${client.name.padEnd(4)} never saw it${inRoom}`);
    }
  }

  const finalPlayers = Object.keys(host.seen?.players ?? {}).length;
  console.log(`\nPlayers left in the room after start: ${finalPlayers}/${count}`);
  console.log(`Clients that never saw the question: ${missed}/${count}`);

  for (const client of clients) {
    client.stop();
    await deleteApp(client.app);
  }
}

main().catch((error: unknown) => {
  console.error('\nharness failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
