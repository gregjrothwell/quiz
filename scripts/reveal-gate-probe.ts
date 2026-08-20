/**
 * Measures when the vault's reveal gate actually opens, against the two clocks a
 * client could anchor to. Run with:
 *
 *   npm run reveal-probe [secs]
 *
 * **Why this exists.** The reveal is refused until the *server* agrees the answer
 * window has passed — `request.time > openedAt + durationSecs * 1000`, a strict
 * comparison on a clock no client can read. Everything about whether a round
 * feels instant or stalls turns on which local moment the client counts its
 * window from, and that is a question about network timing that no unit test can
 * answer. This asks the live project.
 *
 * It writes one candidate rather than the four `resolveAnswer` fires, and it
 * writes the answer the vault already holds for the harness question. So the only
 * clause that can refuse it is `windowClosed()` — a refusal here is the gate and
 * nothing else, which is the whole point of the measurement.
 *
 * Not part of the build or the test suite: it talks to the live project. Costs
 * one room, a handful of writes and no meaningful reads.
 */

import { deleteApp, initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  terminate,
  Timestamp,
  updateDoc,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';
import { attachDebugAppCheck } from './appCheck';
import { reduce, type Action } from '../src/engine/reducer';
import {
  DEFAULT_DURATION_SECS,
  createRoom,
  isDurationAllowed,
  type QuizQuestion,
  type RoomState,
} from '../src/engine/state';
import { randomRoomCode } from '../src/engine/roomCode';
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

const DURATION_SECS = Number(process.argv[2] ?? DEFAULT_DURATION_SECS);
if (!isDurationAllowed(DURATION_SECS)) {
  throw new Error(`${process.argv[2]} is not a window the rules will accept`);
}
const DURATION_MS = DURATION_SECS * 1_000;

/**
 * Shifts the moment the probe asks, relative to where today's client would.
 *
 * The headline question is a yes or no — is a reveal fired one window after the
 * *pending local* snapshot accepted or refused? A single run only ever answers
 * that for one offset, and an acceptance says nothing about how close it came.
 * Running again at -100 or -200 brackets the margin, which is the number that
 * decides whether this is a design with slack or a coin flip.
 *
 *   npm run reveal-probe -- 15 -200
 */
const OFFSET_MS = Number(process.argv[3] ?? 0);

/** Matches the entry `seed-vault` writes for the harness, so the answer is right. */
const HARNESS_ANSWER = 'The first one';

const QUESTION: QuizQuestion = {
  id: 'hq0',
  prompt: 'Harness question 1: which is the first option?',
  options: ['The first one', 'The second one', 'The third one', 'The fourth one'],
  correctIndex: null,
  category: 'General Knowledge',
  difficulty: 'easy',
};

type PersistedRoom = Omit<RoomState, 'answers'>;

function toPersisted(state: RoomState): PersistedRoom {
  const persisted: Record<string, unknown> = { ...state };
  delete persisted.answers;
  return persisted as unknown as PersistedRoom;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function isPermissionDenied(cause: unknown): boolean {
  return (
    typeof cause === 'object'
    && cause !== null
    && 'code' in cause
    && String((cause as { code: unknown }).code) === 'permission-denied'
  );
}

/**
 * One candidate write, with the answer the vault holds. Returns true if the gate
 * let it through. Deletes what it wrote, because these documents are immutable
 * once created and the probe needs to be able to ask again.
 */
async function gateIsOpen(db: Firestore, code: string): Promise<boolean> {
  const reference = doc(db, 'rooms', code, 'reveal', QUESTION.id);
  try {
    await setDoc(reference, { answer: HARNESS_ANSWER });
  } catch (cause) {
    if (isPermissionDenied(cause)) return false;
    throw cause;
  }
  await deleteDoc(reference);
  return true;
}

interface Marks {
  /** When the open write was issued, from this process's clock. */
  issuedAt: number;
  /** First snapshot carrying the open question — the pending local write. */
  localAt: number | null;
  /** First snapshot carrying it that the server has acknowledged. */
  confirmedAt: number | null;
  /** The server's own `openedAt`, in its own clock. Informational only. */
  openedAt: number | null;
}

function ms(from: number, to: number | null): string {
  return to === null ? '     —' : `${String(Math.round(to - from)).padStart(5, ' ')}ms`;
}

async function main(): Promise<void> {
  const app = initializeApp(config, 'reveal-gate-probe');
  await attachDebugAppCheck(app);
  const auth = getAuth(app);
  const credential = await signInAnonymously(auth);
  const db = getFirestore(app);
  const uid = credential.user.uid;

  const code = randomRoomCode();
  const reference = doc(db, 'rooms', code);
  const view: { latest: PersistedRoom | null } = { latest: null };

  const fresh = reduce(createRoom(code), { type: 'join', uid, name: 'Probe', at: Date.now() });
  await setDoc(reference, {
    ...toPersisted(fresh),
    expiresAt: Timestamp.fromMillis(Date.now() + 60 * 60 * 1_000),
  });

  const marks: Marks = { issuedAt: 0, localAt: null, confirmedAt: null, openedAt: null };

  // `includeMetadataChanges` is the whole instrument. Without it the server's
  // acknowledgement of a write this process made is invisible, which is exactly
  // the moment being measured.
  const stop = onSnapshot(reference, { includeMetadataChanges: true }, (snapshot) => {
    if (!snapshot.exists()) return;
    const data = snapshot.data() as PersistedRoom & { openedAt?: Timestamp };
    view.latest = data;
    if (data.phase !== 'question') return;
    const now = Date.now();
    if (snapshot.metadata.hasPendingWrites) {
      marks.localAt ??= now;
      return;
    }
    marks.confirmedAt ??= now;
    if (data.openedAt) marks.openedAt ??= data.openedAt.toMillis();
  });

  // Let the room settle before the write whose timing is being measured.
  await sleep(1_500);

  const current: RoomState = { ...(view.latest as PersistedRoom), code, answers: {} };
  const actions: Action[] = [
    { type: 'selectPack', packId: 'general-knowledge', packTitle: 'GK', questions: [QUESTION] },
    { type: 'start', at: Date.now(), gameId: `probe-${Date.now()}`, durationSecs: DURATION_SECS },
  ];
  const next = actions.reduce(reduce, current);

  console.log(`\n  Room ${code}, ${DURATION_SECS}s window. Opening the question…\n`);
  marks.issuedAt = Date.now();
  await updateDoc(reference, {
    ...toPersisted(next),
    openedAt: serverTimestamp(),
  } as Partial<DocumentData>);

  if (marks.localAt === null) marks.localAt = marks.issuedAt;

  // The moment today's client would fire: its countdown started at the pending
  // local snapshot, so it expires one window after that and not a millisecond later.
  const localAnchorFires = marks.localAt + DURATION_MS + OFFSET_MS;
  await sleep(Math.max(0, localAnchorFires - Date.now()));

  const askedAt = Date.now();
  const firstTry = await gateIsOpen(db, code);

  /*
    If it was refused, keep asking until it is not — and record when each attempt
    was *issued*, never when it came back. The gate is judged against
    `request.time`, so the issue time is the one the server ruled on; a completion
    timestamp folds the round trip in and overstates the edge by an RTT. The first
    version of this script did exactly that and reported a gate 170ms later than
    it was.

    No sleep between attempts: the round trip is already the sampling interval,
    and the edge comes back bracketed between the last refusal and the first
    acceptance rather than pretending to a precision it does not have.
  */
  let acceptedAt: number | null = firstTry ? askedAt : null;
  let lastRefusedAt: number | null = firstTry ? null : askedAt;
  for (let attempts = 0; acceptedAt === null && attempts < 40; attempts += 1) {
    const issuedAt = Date.now();
    if (await gateIsOpen(db, code)) acceptedAt = issuedAt;
    else lastRefusedAt = issuedAt;
  }

  /*
    Phase B — the app's own reveal, timed leg by leg.

    `resolveAnswer` fires all four candidates at once, so three of them come back
    PERMISSION_DENIED every single time a question is revealed. That is by design.
    What is not known is whether those three denials cost the *next* write
    anything: a denied write tears its gRPC stream down, and if the room update
    that follows has to wait for a new one, the vault would be adding a fixed toll
    to every question in every round. The control is the same write again with no
    denials in front of it.
  */
  const beforeResolve = Date.now();
  const correctIndex = await resolveAnswer(db, code, QUESTION);
  const afterResolve = Date.now();

  const revealed = reduce({ ...next, code, answers: {} }, {
    type: 'reveal',
    correctIndex,
    questionId: QUESTION.id,
  });
  await updateDoc(reference, toPersisted(revealed) as Partial<DocumentData>);
  const afterDispatch = Date.now();

  // Control: the identical write, with nothing denied before it.
  const beforeControl = Date.now();
  await updateDoc(reference, toPersisted(revealed) as Partial<DocumentData>);
  const afterControl = Date.now();

  stop();

  const t = marks.issuedAt;
  console.log('  Measured from the moment the open write was issued:\n');
  console.log(`    open write issued            ${ms(t, t)}`);
  console.log(`    local snapshot (pending)     ${ms(t, marks.localAt)}   <- today's countdown starts here`);
  console.log(`    server-confirmed snapshot    ${ms(t, marks.confirmedAt)}   <- anchoring here instead`);
  console.log(`    asked at                     ${ms(t, askedAt)}   ${firstTry ? 'ACCEPTED' : 'REFUSED'}`);
  /*
    `openedAt` is the server's clock; everything else here is this machine's. The
    difference between them is not latency, it is **skew**, and it is the number
    that decides whether the gate is a coin flip or a certainty. A host laptop
    running a few hundred milliseconds fast relative to Google's servers fires its
    reveal early on every single question of every single round — which is a
    deterministic failure that looks exactly like a flaky one.
  */
  if (marks.openedAt !== null) {
    const skew = marks.openedAt - marks.issuedAt;
    console.log(`    server openedAt - local t0   ${String(skew).padStart(5, ' ')}ms   `
      + '<- latency plus clock skew, and the two cannot be separated here');
  }
  if (!firstTry) {
    console.log(`    last refusal issued at       ${ms(t, lastRefusedAt)}`);
    console.log(`    first acceptance issued at   ${ms(t, acceptedAt)}`);
  }
  console.log('');

  const anchorGain = marks.confirmedAt === null ? null : marks.confirmedAt - marks.localAt;
  if (anchorGain !== null) {
    console.log(`    Anchoring on the confirmed snapshot would have asked ${anchorGain}ms later.`);
  }
  if (!firstTry && acceptedAt !== null) {
    console.log(`    Today's anchor missed the gate by up to ${acceptedAt - askedAt}ms, and`);
    console.log('    each miss costs a full REVEAL_RETRY_MS before the next attempt.');
  }

  console.log('  The app\'s own reveal, from the moment its clock expired:\n');
  console.log(`    resolveAnswer (4 writes, 3 denied)   ${String(afterResolve - beforeResolve).padStart(5, ' ')}ms`);
  console.log(`    room update straight after it        ${String(afterDispatch - afterResolve).padStart(5, ' ')}ms`);
  console.log(`    the same room update, nothing denied ${String(afterControl - beforeControl).padStart(5, ' ')}ms   <- control`);
  console.log(`    total before the replay even starts  ${String(afterDispatch - beforeResolve).padStart(5, ' ')}ms`);
  console.log('');

  // Firestore's connection keeps the event loop alive, so a probe that has said
  // its piece would otherwise hang until somebody noticed and killed it.
  await terminate(db);
  await deleteApp(app);
}

main().catch((error: unknown) => {
  console.error('reveal-gate-probe failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
