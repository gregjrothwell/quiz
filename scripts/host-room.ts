/**
 * Hosts a real room from the command line so the browser app can be watched as
 * an ordinary player. Run with:
 *
 *   npx tsx --env-file=.env.local scripts/host-room.ts
 *
 * It prints a room code, waits for someone to join in a browser, then drives the
 * round — start, reveal, next — logging what it writes and when. The point is to
 * see what a non-quizmaster's screen actually does while somebody else runs the
 * game, which no single-browser session can show.
 *
 * Takes the answer window in seconds, so the configurable one can be watched
 * rather than assumed:
 *
 *   npm run host-room -- 10
 *
 * Not part of the build or the test suite: it talks to the live project.
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { attachDebugAppCheck } from './appCheck';
import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  setDoc,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore';
import { reduce, type Action } from '../src/engine/reducer';
import { liveAnswers, type AnswerDoc } from '../src/engine/answers';
import {
  DEFAULT_DURATION_SECS,
  createRoom,
  currentQuestion,
  isDurationAllowed,
  type QuizQuestion,
  type RoomState,
} from '../src/engine/state';
import { randomRoomCode } from '../src/engine/roomCode';
import { resolveAnswer } from '../src/lib/vault';

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

const DURATION_SECS = Number(process.argv[2] ?? DEFAULT_DURATION_SECS);
if (!isDurationAllowed(DURATION_SECS)) {
  throw new Error(`${process.argv[2]} is not a window the rules will accept`);
}

/**
 * The vault opens strictly *after* the window, and the server measures it from
 * its own clock rather than this one. A second of slack covers the difference.
 *
 * > **Correction, 20 August 2026.** This used to add: *"which is the same margin
 * > the browser gets for free by starting its countdown only once it has seen the
 * > write land."* The browser never got it for free. Latency compensation hands
 * > the quizmaster's device a local snapshot of its own write before the server
 * > has seen it, so its countdown started a hop early and its reveal cleared the
 * > gate by single-digit milliseconds — when it cleared it at all. This script
 * > adding slack while the app did not is what hid the bug: the harness always
 * > passed. The app now waits for the server-confirmed snapshot instead
 * > (`src/engine/revealGate.ts`), which needs no slack to be correct.
 */
const GATE_SLACK_MS = 1_000;

const QUESTIONS: QuizQuestion[] = Array.from({ length: 3 }, (_, i) => ({
  id: `hq${i}`,
  prompt: `Harness question ${i + 1}: which is the first option?`,
  options: ['The first one', 'The second one', 'The third one', 'The fourth one'],
  correctIndex: null,
  category: 'General Knowledge',
  difficulty: 'easy',
}));

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const stamp = (): string => new Date().toISOString().slice(11, 23);

async function main(): Promise<void> {
  const app = initializeApp(config, 'host');
  await attachDebugAppCheck(app);
  const auth = getAuth(app);
  const credential = await signInAnonymously(auth);
  const db = getFirestore(app);
  const uid = credential.user.uid;

  const code = randomRoomCode();
  const reference = doc(db, 'rooms', code);

  // A holder rather than a bare `let`: TypeScript's control-flow analysis does
  // not see the assignment inside the snapshot callback, so a plain variable
  // narrows to `never` at every read below.
  const view: { latest: PersistedRoom | null } = { latest: null };
  const answers: { live: Record<string, AnswerDoc> } = { live: {} };
  const fresh = reduce(createRoom(code), { type: 'join', uid, name: 'Host', at: Date.now() });
  // See the note in sync-harness: a day, so a hosted test room reaps itself
  // rather than joining the pile nothing can reach.
  await setDoc(reference, {
    ...toPersisted(fresh),
    expiresAt: Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1_000),
  });

  onSnapshot(reference, (snapshot) => {
    if (!snapshot.exists()) return;
    const data = snapshot.data() as PersistedRoom;
    view.latest = data;
    const names = Object.values(data.players).map((p) => p.name).join(', ');
    console.log(`${stamp()}  phase=${data.phase} index=${data.index} players=[${names}]`);
  });

  // **The harness had never read this**, and it folded every reveal with an
  // empty answers map as a result — so a browser that answered perfectly well
  // was told "your answer didn't reach the room in time", and nobody could ever
  // score. The filtering is `liveAnswers`, the same function the app uses, so
  // the harness cannot score a round differently from the browsers watching it.
  onSnapshot(collection(db, 'rooms', code, 'answers'), (snapshot) => {
    const next: Record<string, AnswerDoc> = {};
    for (const document of snapshot.docs) next[document.id] = document.data() as AnswerDoc;
    answers.live = next;

    const room = view.latest;
    if (!room) return;
    const counted = Object.keys(liveAnswers(room.players, room.index, next)).length;
    console.log(`${stamp()}  answers for question ${room.index + 1}: ${counted}`);
  });

  console.log(`\n=======================================`);
  console.log(`  JOIN THIS ROOM:  ${code}`);
  console.log(`=======================================\n`);

  /**
   * The room as the engine wants it, with the answers the app would count.
   *
   * One helper for both callers, because the reveal and the dispatch have to
   * agree about what is in the room — the reveal reads the question and the
   * dispatch scores it, and those disagreeing is how a round scores nothing.
   */
  const stateNow = (): RoomState | null => {
    const latest = view.latest;
    if (!latest) return null;
    return { ...latest, code, answers: liveAnswers(latest.players, latest.index, answers.live) };
  };

  const dispatch = async (actions: Action[]): Promise<RoomState | null> => {
    const current = stateNow();
    if (!current) return null;
    const next = actions.reduce(reduce, current);
    const update: Record<string, unknown> = { ...toPersisted(next) };
    // The vault's time gate is measured from the server's own record of when a
    // question went live, and the rules insist this field *is* that record.
    if (next.phase === 'question' && current.index !== next.index) {
      update.openedAt = serverTimestamp();
    } else if (next.phase === 'question' && current.phase !== 'question') {
      update.openedAt = serverTimestamp();
    }
    await updateDoc(reference, update as Partial<DocumentData>);
    return next;
  };

  // Wait for a browser to join.
  for (let waited = 0; waited < 120_000; waited += 1000) {
    if (view.latest && Object.keys(view.latest.players).length > 1) break;
    await sleep(1000);
  }

  if (!view.latest || Object.keys(view.latest.players).length < 2) {
    console.log('Nobody joined — giving up.');
    return;
  }

  console.log(`\n${stamp()}  Somebody joined. Starting in 3s…`);
  await sleep(3000);

  console.log(`${stamp()}  >>> WRITING start`);
  await dispatch([
    { type: 'selectPack', packId: 'general-knowledge', packTitle: 'GK', questions: QUESTIONS },
    { type: 'start', at: Date.now(), gameId: `host-${Date.now()}`, durationSecs: DURATION_SECS },
  ]);

  // Past this room's own gate, so the vault will answer.
  await sleep(DURATION_SECS * 1000 + GATE_SLACK_MS);
  console.log(`${stamp()}  >>> ASKING the vault`);
  const open = stateNow();
  const asked = open ? currentQuestion(open) : null;
  if (!asked) throw new Error('No open question to reveal');
  const correctIndex = await resolveAnswer(db, code, asked);
  console.log(`${stamp()}  >>> WRITING reveal (answer ${correctIndex})`);
  const revealed = await dispatch([{ type: 'reveal', correctIndex, questionId: asked.id }]);

  // What the reveal actually did, which is the thing this harness could never
  // report. Read off the state the reveal produced rather than off the next
  // snapshot, which has not necessarily landed yet. A zero here now means
  // nobody answered, rather than meaning nothing was read.
  const named = Object.entries(revealed?.lastDeltas ?? {})
    .map(([uid, delta]) => `${revealed?.players[uid]?.name ?? uid} +${delta}`)
    .join(', ');
  console.log(`${stamp()}      scored: ${named || 'nobody'}`);

  await sleep(8000);
  console.log(`${stamp()}  >>> WRITING next (to standings)`);
  await dispatch([{ type: 'next', at: Date.now() }]);

  await sleep(8000);
  console.log(`${stamp()}  >>> WRITING next (to question 2)`);
  await dispatch([{ type: 'next', at: Date.now() }]);

  await sleep(15_000);
  console.log('Done.');
}

main().catch((error: unknown) => {
  console.error('host-room failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
