/**
 * Proves the rank bonus in a live room, with a full field of answerers.
 *
 *   npm run rank-harness
 *
 * **This is the oldest unproven claim in the project.** Rank scoring shipped on
 * 20 August 2026 (PR #6) and has been scored in a live room ever since — but
 * only ever with one answerer, and one correct answer can only ever be first.
 * Every bonus below the top, the tie convention and the floor have been carried
 * by unit tests alone. `docs/HANDOVER.md` records the gap as *"still needing a
 * second person"*, and `docs/decisions/scoring.md` as *"the whole point of the
 * change"*.
 *
 * It never needed a second person. It needed a second *client*, and this project
 * already had everything required to make seven of them:
 *
 * - `sync-harness` shows how to stand up N independent Firebase clients, each
 *   with its own anonymous uid, and how to write to a room the way `useRoom`
 *   does — never the whole `players` map, `scores` per field path.
 * - `elapsedMs` is measured on the answering device and the rules bound it only
 *   for sanity (`firestore.rules:309`). So a client may *state* its own time,
 *   which is exactly what makes a deterministic ordering possible. What
 *   `docs/decisions/scoring.md` calls out as the scheme's one weakness is the
 *   thing that makes it testable.
 * - `seed-vault` seeds `hq0`–`hq2` with `'The first one'`, so a harness knows
 *   the correct lectern in advance without ever reading the vault — which no
 *   client can do, and this one does not.
 *
 * So the whole ladder can be put in one question: first, second, third, fourth,
 * a tie sharing a rank, the floor beneath the last bonus, and a wrong answer
 * scoring nothing while still appearing in the tally.
 *
 * **The expected numbers below are written by hand from the published table in
 * `docs/decisions/scoring.md`, not computed by `tallyQuestion`.** Deriving them
 * from the function under test would only prove the engine agrees with itself.
 * What this asks is whether the shipped, live path pays what the document
 * promised the room. After the reveal it plays the round to `finished`, so the
 * fastest-finger rosette can be checked against those same answers — that was
 * the gap the 29 August run left, because it stopped at the reveal.
 *
 * Not part of the build or the test suite: it talks to the live project. The
 * harness itself never calls `recordGame`. A `--browser` run that reaches
 * `finished` will, from the browser, for that one player — that is the cost of
 * seeing the final screen, and the name in the room is what lands on the board.
 */

import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { attachDebugAppCheck } from './appCheck';
import {
  collection,
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
import { reduce, type Action } from '../src/engine/reducer';
import { liveAnswers, type AnswerDoc } from '../src/engine/answers';
import { awardsFor, type QuestionRecord } from '../src/engine/awards';
import { tallyQuestion } from '../src/engine/scoring';
import { createRoom, currentQuestion, type QuizQuestion, type RoomState } from '../src/engine/state';
import { joinLink, randomRoomCode } from '../src/engine/roomCode';
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

/**
 * Waits for a browser to join before starting, so the room's *screen* can be
 * watched paying the ladder rather than only its documents.
 *
 *   npm run rank-harness -- --browser
 */
const WAIT_FOR_BROWSER = process.argv.includes('--browser');

/**
 * The window this round runs on. Ten seconds, the app's default — long enough
 * that every seat's stated `elapsedMs` sits inside it, which matters because
 * `submitAnswer` refuses anything past the window (`useRoom.ts:764`) and a
 * harness that wrote what the app would refuse would be proving the wrong path.
 *
 * Thirty when a browser is playing, purely so a human has time to read the
 * question and press something. **It cannot change any of the expected numbers
 * below, and that is itself a claim worth landing:** the bonus ranks the correct
 * answers against each other rather than against the clock, so a ten-second
 * round and a thirty-second one pay identically (`scoring.ts:44`).
 */
const DURATION_SECS = WAIT_FOR_BROWSER ? 30 : 10;

/**
 * The vault opens strictly *after* the window, measured on the server's clock
 * rather than this one. The same second of slack `host-room` uses.
 */
const GATE_SLACK_MS = 1_000;

/**
 * The question. Id and options match `scripts/host-room.ts`, because the vault
 * is seeded against exactly those strings — `HARNESS_ANSWERS` in
 * `scripts/seed-vault.ts` maps `hq0` to `'The first one'`.
 *
 * So **lectern 0 is the correct one, by construction**, and this file can state
 * the right answer up front without reading a vault it is not allowed to read.
 * The reveal still goes through `resolveAnswer` like any other client, and the
 * run fails if the vault comes back with anything but 0.
 */
const QUESTION: QuizQuestion = {
  id: 'hq0',
  prompt: 'Harness question 1: which is the first option?',
  options: ['The first one', 'The second one', 'The third one', 'The fourth one'],
  correctIndex: null,
  category: 'General Knowledge',
  difficulty: 'easy',
};

/** The lectern the vault will confirm. */
const CORRECT_OPTION = 0;

interface Seat {
  name: string;
  /** Which lectern this player presses. */
  option: number;
  /** What their device claims it took them. Chosen, so the order is exact. */
  elapsedMs: number;
  /**
   * From the table in docs/decisions/scoring.md — 500 for a correct answer plus
   * 500/400/300/200 by position, 100 from fifth. Written out by hand on purpose.
   */
  expected: number;
  /** Why this seat is in the room. */
  proves: string;
}

/**
 * One question, the whole ladder.
 *
 * The two at 4,800ms are the interesting pair. `tallyQuestion` shares a rank
 * between equal times and resumes the next distinct time at the count already
 * awarded, so they are both fourth at 700 and Gus is *sixth* rather than fifth
 * — which is the convention `standings()` uses, and the one acceptance
 * criterion no room with a single answerer could ever show.
 */
const CAST: Seat[] = [
  { name: 'Ada', option: CORRECT_OPTION, elapsedMs: 1_200, expected: 1000, proves: 'first correct answer takes the top bonus' },
  { name: 'Bo', option: CORRECT_OPTION, elapsedMs: 2_400, expected: 900, proves: 'second takes 400' },
  { name: 'Cyd', option: 2, elapsedMs: 3_000, expected: 0, proves: 'a wrong answer scores nothing, and is still in the tally' },
  { name: 'Dev', option: CORRECT_OPTION, elapsedMs: 3_600, expected: 800, proves: 'third takes 300' },
  { name: 'Eli', option: CORRECT_OPTION, elapsedMs: 4_800, expected: 700, proves: 'fourth takes 200' },
  { name: 'Fay', option: CORRECT_OPTION, elapsedMs: 4_800, expected: 700, proves: 'a tie shares the rank rather than splitting it' },
  { name: 'Gus', option: CORRECT_OPTION, elapsedMs: 7_500, expected: 600, proves: 'the next distinct time resumes at the count awarded — sixth, so the floor' },
];

type PersistedRoom = Omit<RoomState, 'answers'>;

function toPersisted(state: RoomState): PersistedRoom {
  const persisted: Record<string, unknown> = { ...state };
  delete persisted.answers;
  return persisted as unknown as PersistedRoom;
}

/**
 * Mirrors `useRoom.toUpdate`, and `sync-harness` before it: never write the
 * whole `players` map, merge `scores` per player, and let the server stamp
 * `openedAt` when a question opens. The first of those is a rule of this
 * project rather than a rule of Firestore — a phase transition that wrote the
 * map back is the race that dropped players mid-start.
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

interface Client {
  name: string;
  uid: string;
  app: FirebaseApp;
  db: Firestore;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const stamp = (): string => new Date().toISOString().slice(11, 23);

async function makeClient(name: string, index: number): Promise<Client> {
  const app = initializeApp(config, `rank-${index}`);
  await attachDebugAppCheck(app);
  const credential = await signInAnonymously(getAuth(app));
  return { name, uid: credential.user.uid, app, db: getFirestore(app) };
}

async function main(): Promise<void> {
  console.log(`Standing up ${CAST.length + 1} clients against ${config.projectId}…\n`);

  const host = await makeClient('Host', 0);
  const players = await Promise.all(CAST.map((seat, i) => makeClient(seat.name, i + 1)));

  const code = randomRoomCode();
  const reference = doc(host.db, 'rooms', code);

  const fresh = reduce(createRoom(code), {
    type: 'join',
    uid: host.uid,
    name: host.name,
    at: Date.now(),
  });
  // The same day-long `expiresAt` the other harnesses write, so a run cannot
  // leave a room behind that nothing will ever reap.
  await setDoc(reference, {
    ...toPersisted(fresh),
    expiresAt: Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1_000),
  });
  console.log(`${stamp()}  Room ${code} created by Host`);

  // The host's own view, kept current the way the app keeps it — the dispatch
  // folds actions over the latest snapshot rather than over anything local.
  const view: { latest: PersistedRoom | null } = { latest: null };
  const stopRoom = onSnapshot(reference, (snapshot) => {
    if (snapshot.exists()) view.latest = snapshot.data() as PersistedRoom;
  });

  /*
    The answers, and the host must listen to them.

    **This file folded its first reveal without them and scored the room
    nothing**, which is precisely the bug `host-room` carried until 29 August
    2026 — the reveal is folded on the quizmaster's device, so a host that never
    read the subcollection scores a room in which nobody answered. It went
    unnoticed there for weeks because a harness that pays nobody looks exactly
    like a quiet room.

    It was caught here in the first run, and by the cross-check rather than by
    the report: Gus re-derived the full ladder from the server's answers while
    the room's own `lastDeltas` came back empty. Two readings that cannot both be
    true is a finding, and this one was the harness's.
  */
  /** The browser player, when there is one. Filled in once they join. */
  const browser: { uid: string | null; name: string } = { uid: null, name: '' };

  const answers: { live: Record<string, AnswerDoc> } = { live: {} };
  const stopAnswers = onSnapshot(collection(host.db, 'rooms', code, 'answers'), (snapshot) => {
    const next: Record<string, AnswerDoc> = {};
    for (const document of snapshot.docs) next[document.id] = document.data() as AnswerDoc;
    answers.live = next;
  });

  const dispatch = async (actions: Action[]): Promise<RoomState | null> => {
    const latest = view.latest;
    if (!latest) return null;
    // `liveAnswers` rather than the raw documents, so this harness cannot score
    // a round differently from the browsers watching it.
    const current: RoomState = {
      ...latest,
      code,
      answers: liveAnswers(latest.players, latest.index, answers.live),
    };
    const next = actions.reduce(reduce, current);
    await updateDoc(reference, toUpdate(next) as Partial<DocumentData>);
    return next;
  };

  await sleep(800);

  console.log(`${stamp()}  ${players.length} players joining…`);
  await Promise.all(
    players.map((client) =>
      updateDoc(doc(client.db, 'rooms', code), {
        [`players.${client.uid}`]: { name: client.name, joinedAt: Date.now() },
        [`scores.${client.uid}`]: 0,
      }),
    ),
  );
  await sleep(1_500);
  console.log(`${stamp()}  Host sees ${Object.keys(view.latest?.players ?? {}).length} in the lobby`);

  if (WAIT_FOR_BROWSER) {
    const expected = CAST.length + 1;
    console.log(`\n=======================================`);
    console.log(`  JOIN THIS ROOM:  ${code}`);
    console.log(`  ${joinLink('https://gregjrothwell.github.io', '/quiz/', code)}`);
    console.log(`=======================================\n`);
    console.log(`${stamp()}  Waiting for a browser to make it ${expected + 1}…`);

    for (let waited = 0; waited < 180_000; waited += 1_000) {
      if (Object.keys(view.latest?.players ?? {}).length > expected) break;
      await sleep(1_000);
    }

    const joined = Object.entries(view.latest?.players ?? {}).find(
      ([uid]) => uid !== host.uid && !players.some((client) => client.uid === uid),
    );
    if (!joined) {
      console.log('Nobody joined in the browser — giving up rather than proving half of it.');
      stopRoom();
      stopAnswers();
      for (const client of [host, ...players]) await deleteApp(client.app);
      process.exitCode = 1;
      return;
    }
    browser.uid = joined[0];
    browser.name = joined[1].name;
    console.log(`${stamp()}  ${browser.name} joined in a browser. Starting in 3s…`);
    await sleep(3_000);
  }

  console.log(`\n${stamp()}  >>> WRITING start (${DURATION_SECS}s window)`);
  await dispatch([
    { type: 'selectPack', packId: 'general-knowledge', packTitle: 'GK', questions: [QUESTION] },
    { type: 'start', at: Date.now(), gameId: `rank-${Date.now()}`, durationSecs: DURATION_SECS },
  ]);

  // Every seat answers at once, each stating its own time. The document is
  // exactly what `submitAnswer` writes: option, elapsed, and the question index
  // that stops a stale answer scoring twice.
  console.log(`${stamp()}  Seven lecterns go down…`);
  await Promise.all(
    players.map((client, i) => {
      const seat = CAST[i];
      if (!seat) throw new Error(`no seat for client ${i}`);
      const answer: AnswerDoc = {
        optionIndex: seat.option,
        elapsedMs: seat.elapsedMs,
        questionIndex: 0,
      };
      return setDoc(doc(collection(client.db, 'rooms', code, 'answers'), client.uid), answer);
    }),
  );
  for (const seat of CAST) {
    const lectern = seat.option === CORRECT_OPTION ? 'correct' : 'wrong  ';
    console.log(`    ${seat.name.padEnd(4)} ${lectern}  at ${String(seat.elapsedMs).padStart(5)}ms`);
  }

  // Past this room's own gate, so the vault will answer.
  await sleep(DURATION_SECS * 1_000 + GATE_SLACK_MS);

  const open = view.latest ? currentQuestion({ ...view.latest, code, answers: {} }) : null;
  if (!open) throw new Error('no open question to reveal');

  console.log(`\n${stamp()}  >>> ASKING the vault`);
  const correctIndex = await resolveAnswer(host.db, code, open);
  console.log(`${stamp()}      the vault says ${correctIndex} — "${open.options[correctIndex]}"`);

  console.log(`${stamp()}  >>> WRITING reveal`);
  await dispatch([{ type: 'reveal', correctIndex, questionId: open.id }]);

  /*
    Everything from here reads from the *server*, not from the local snapshot
    and not from the state the reveal returned.

    `getDocFromServer` rather than `getDoc` on purpose. The client SDK will
    happily serve a cached document, and the cache here holds this process's own
    writes — so the ordinary read could confirm what this script hoped for
    without a single byte having survived the trip. Reading past the cache is
    what makes this evidence rather than an echo.
  */
  await sleep(1_500);
  const settled = await getDocFromServer(reference);
  const room = settled.data() as PersistedRoom | undefined;
  if (!room) throw new Error('the room vanished');

  const deltas = room.lastDeltas;
  const scores = room.scores;
  const byUid = new Map(players.map((client, i) => [client.uid, CAST[i]] as const));

  console.log(`\n${stamp()}  What the room paid, read back from the server`);
  console.log(`\n  ${'Seat'.padEnd(5)}${'lectern'.padEnd(9)}${'elapsed'.padStart(8)}${'expected'.padStart(10)}${'paid'.padStart(7)}${'score'.padStart(7)}`);
  console.log(`  ${'─'.repeat(51)}`);

  const failures: string[] = [];

  for (const [uid, seat] of byUid) {
    if (!seat) continue;
    const paid = deltas[uid];
    const score = scores[uid];
    const ok = paid === seat.expected && score === seat.expected;
    if (!ok) {
      failures.push(
        `${seat.name}: expected ${seat.expected}, the room paid ${paid ?? 'nothing at all'}` +
          (score === seat.expected ? '' : ` and banked ${score ?? 'nothing'}`),
      );
    }
    const lectern = seat.option === CORRECT_OPTION ? 'correct' : 'wrong';
    console.log(
      `  ${seat.name.padEnd(5)}${lectern.padEnd(9)}${`${seat.elapsedMs}ms`.padStart(8)}` +
        `${String(seat.expected).padStart(10)}${String(paid ?? '—').padStart(7)}` +
        `${String(score ?? '—').padStart(7)}  ${ok ? '✓' : '✗'}  ${seat.proves}`,
    );
  }

  // The quizmaster answered nothing, so they must be *absent* from the deltas
  // rather than present with a zero. That distinction is what `verdictFor`
  // reads to tell an honest wrong answer from an answer the room never saw, so
  // a zero here would be a real defect wearing a harmless number.
  if (host.uid in deltas) {
    failures.push(`Host answered nothing and should be absent from the deltas, but was paid ${deltas[host.uid]}`);
  } else {
    console.log(`\n  Host answered nothing and is absent from the deltas, not zero in them ✓`);
  }

  /*
    Acceptance criterion 6: every device computes identical deltas from the same
    reveal. Re-derived here on a client that did *not* fold it, from the answers
    as that client reads them off the server — `liveAnswers` then `tallyQuestion`,
    the same two functions the browsers use.
  */
  const verifier = players[players.length - 1];
  if (!verifier) throw new Error('no verifier client');
  const answerDocs = await getDocsFromServer(collection(verifier.db, 'rooms', code, 'answers'));
  const seen: Record<string, AnswerDoc> = {};
  for (const document of answerDocs.docs) seen[document.id] = document.data() as AnswerDoc;

  const rederived = tallyQuestion({
    correctIndex,
    answers: liveAnswers(room.players, room.index, seen),
  });

  const agrees =
    Object.keys(rederived).length === Object.keys(deltas).length &&
    Object.entries(rederived).every(([uid, delta]) => deltas[uid] === delta);

  if (agrees) {
    console.log(
      `  ${verifier.name} re-derived the same ${Object.keys(rederived).length} deltas from the server's answers ✓`,
    );
  } else {
    failures.push(
      `${verifier.name} re-derived ${JSON.stringify(rederived)} against the room's ${JSON.stringify(deltas)}`,
    );
  }

  /*
    The browser player, if one was in the room.

    Reported rather than asserted in general, because a human presses when they
    press. The one case worth asserting is the one this run engineers on
    purpose: answering correctly *after* every seat puts them seventh among the
    correct answers, and seventh is past the last bonus, so the floor pays 600.
    That is the same number Gus takes — from a real browser, over reCAPTCHA
    attestation rather than a debug token, with a real `elapsedMs` measured by
    the device rather than stated by this file.
  */
  if (browser.uid) {
    const paid = deltas[browser.uid];
    const answer = seen[browser.uid];
    const slowest = Math.max(...CAST.map((seat) => seat.elapsedMs));

    if (!answer) {
      console.log(`\n  ${browser.name} was in the room but answered nothing.`);
    } else {
      const correct = answer.optionIndex === correctIndex;
      const lastOfAll = correct && answer.elapsedMs > slowest;
      const label = correct ? 'correct' : 'wrong';
      console.log(
        `\n  ${browser.name} answered ${label} in a browser at ${answer.elapsedMs}ms and was paid ${paid ?? '—'}`,
      );
      if (lastOfAll && paid !== 600) {
        failures.push(
          `${browser.name} answered correctly after every seat, so is seventh and should take the floor — 600, not ${paid ?? 'nothing'}`,
        );
      } else if (lastOfAll) {
        console.log('    — seventh among the correct answers, so the floor. 600 ✓');
      } else {
        console.log('    — reported, not asserted: they pressed when they pressed.');
      }
    }
  }

  // The vault's own record of the reveal, which any member may read back.
  const proof = await getDocFromServer(doc(host.db, 'rooms', code, 'reveal', open.id));
  const asserted = (proof.data() as { answer?: unknown } | undefined)?.answer;
  console.log(`  The reveal document says "${String(asserted)}", and it is immutable ✓`);

  /*
    The rank bonus is a per-question claim. Fastest finger is a *round* claim,
    and the final screen withholds it unless this device saw every question
    (`sawWholeGame`). A one-question pack is enough: Ada at 1,200ms is the
    quickest correct answer of the night, and the rosette has to name her on
    the same screen that has her at 1,000 — that agreement is what 29 August
    left outstanding, because this harness used to stop at the reveal.
  */
  const adaIndex = CAST.findIndex((seat) => seat.name === 'Ada');
  const ada = players[adaIndex];
  if (!ada) throw new Error('Ada is missing from the cast');

  const log: QuestionRecord[] = [
    {
      index: 0,
      correctIndex,
      answers: liveAnswers(room.players, room.index, seen),
      deltas,
    },
  ];
  const awards = awardsFor(log, Object.keys(room.players));
  const finger = awards.find((award) => award.id === 'fastest');
  const namedAda =
    finger?.id === 'fastest' &&
    finger.uids.length === 1 &&
    finger.uids[0] === ada.uid &&
    finger.elapsedMs === 1_200;

  if (namedAda) {
    console.log('  Fastest finger is Ada at 1,200ms, from the same answers the bonuses used ✓');
  } else {
    const who = finger?.id === 'fastest' ? finger.uids.join(',') : 'nobody';
    const when = finger?.id === 'fastest' ? `${finger.elapsedMs}ms` : '—';
    failures.push(`fastest finger should be Ada at 1,200ms; the log named ${who} at ${when}`);
  }

  if (failures.length > 0) {
    stopRoom();
    stopAnswers();
    for (const client of [host, ...players]) await deleteApp(client.app);
    console.log('\nTHE LADDER DOES NOT HOLD:');
    for (const failure of failures) console.log(`  ✗ ${failure}`);
    process.exitCode = 1;
    return;
  }

  const waitForPhase = async (phase: RoomState['phase']): Promise<void> => {
    for (let waited = 0; waited < 10_000; waited += 200) {
      if (view.latest?.phase === phase) return;
      await sleep(200);
    }
    throw new Error(`room never reached ${phase} (was ${view.latest?.phase ?? 'nothing'})`);
  };

  console.log(`\n${stamp()}  >>> WRITING next (to standings)`);
  await dispatch([{ type: 'next', at: Date.now() }]);
  await waitForPhase('scoreboard');

  console.log(`${stamp()}  >>> WRITING next (to finished)`);
  await dispatch([{ type: 'next', at: Date.now() }]);
  await waitForPhase('finished');

  const ended = await getDocFromServer(reference);
  if (ended.data()?.phase !== 'finished') {
    throw new Error(`server phase is ${String(ended.data()?.phase)}, not finished`);
  }
  console.log(`${stamp()}  Room ${code} is finished. Ada at 1,000 and fastest finger at 1.2s.`);
  console.log('    On screen: “Fastest finger” / Ada / “In on the buzzer at 1.2 seconds.”');

  if (WAIT_FOR_BROWSER) {
    console.log('\n  Holding the final screen for 45s so it can be photographed…');
    await sleep(45_000);
  }

  stopRoom();
  stopAnswers();
  for (const client of [host, ...players]) await deleteApp(client.app);

  console.log(
    `\nThe rank bonus holds in room ${code}: 1000 / 900 / 800 / 700 / 700 / 600 and a zero,\n` +
      'paid by the live project, read back from the server, and re-derived by a second client.\n' +
      'Fastest finger is Ada at 1.2s, on the same answers, with the round at finished.',
  );
}

main().catch((error: unknown) => {
  console.error('\nrank-harness failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
