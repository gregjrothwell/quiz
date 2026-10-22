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
 * `--pack sleeves` plays two real sleeves instead of the harness questions:
 * the first with its song, which should start at once (half the clock until
 * 30 September 2026), and the second with the song taken off, which should
 * play silent as a sleeve always did. Both are published ids, so the vault
 * already holds their answers. See docs/decisions/sleeves-song.md.
 *
 *   npm run host-room -- 10 --pack sleeves
 *
 * `--pack catchphrase` plays two published Catchphrase puzzles. A browser in
 * the room should show each picture alone until halfway, then the options. New
 * ids stall at the reveal until `seed-vault` has run, which is what this
 * proves before a deploy. See docs/decisions/catchphrase.md.
 *
 *   npm run host-room -- 10 --pack catchphrase
 *
 * `--pack blanks` does the same with the first two Blankety Blank questions, so
 * a reveal proves the vault holds their answers before the pack deploys. See
 * docs/decisions/blankety-blank.md.
 *
 *   npm run host-room -- 10 --pack blanks
 *
 * `--pack prices` does the same for The Price Was Right. Greg plays it blind,
 * so read only the reveal's right/wrong, not the options, if he is watching.
 *
 *   npm run host-room -- 10 --pack prices
 *
 * `--last` plays the last two questions of the pack instead of the first two.
 * A batch appends, so the first two are old ids the vault already held; only
 * the last two prove a fresh batch was seeded before it deploys.
 *
 *   npm run host-room -- 10 --pack prices --last
 *
 * `--pack tags` is The Price is Right, also blind: a picture and four prices.
 *
 *   npm run host-room -- 10 --pack tags
 *
 * Safe for blind packs: Lite logs every refused reveal candidate with its
 * payload (the option text), and four candidates means three refusals a
 * question. Its log level is turned down to errors below, so the options never
 * reach the terminal; a real failure still throws out of `resolveAnswer`.
 *
 * Not part of the build or the test suite: it talks to the live project.
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { attachDebugAppCheck } from './appCheck';
import { startNodeHost } from './nodeHost';
import { collection, doc, getFirestore, onSnapshot, Timestamp, setDoc } from 'firebase/firestore';
// The vault's candidates go over Lite, as the app sends them — see `resolveAnswer`.
import { getFirestore as getLiteFirestore, setLogLevel as setLiteLogLevel } from 'firebase/firestore/lite';
import { reduce } from '../src/engine/reducer';
import { liveAnswers, type AnswerDoc } from '../src/engine/answers';
import {
  DEFAULT_DURATION_SECS,
  buildQuizQuestions,
  createRoom,
  isDurationAllowed,
  type QuizQuestion,
} from '../src/engine/state';
import { randomRoomCode } from '../src/engine/roomCode';
import type { SealedQuestion } from '../src/questions/types';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { toPersisted, type PersistedRoom } from '../src/lib/roomDoc';

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

const DURATION_SECS = Number(process.argv[2] ?? DEFAULT_DURATION_SECS);
if (!isDurationAllowed(DURATION_SECS)) {
  throw new Error(`${process.argv[2]} is not a window the rules will accept`);
}

/*
  No gate slack here any more. This script used to sleep out the window plus a
  second and reveal by hand, and that second is what hid the browser's gate bug
  until 20 August 2026: the harness always passed. Since step 3 of
  host-loop.md the reveal is the app's own (`src/host/`, run by `nodeHost.ts`),
  which waits for the server-confirmed question like the browser does.
*/

const QUESTIONS: QuizQuestion[] = Array.from({ length: 3 }, (_, i) => ({
  id: `hq${i}`,
  prompt: `Harness question ${i + 1}: which is the first option?`,
  options: ['The first one', 'The second one', 'The third one', 'The fourth one'],
  correctIndex: null,
  category: 'General Knowledge',
  difficulty: 'easy',
}));

/** Two published sleeves: one keeps its song, one has it taken off. */
function sleeveQuestions(): QuizQuestion[] {
  const pack = JSON.parse(
    readFileSync(join(import.meta.dirname, '..', 'public', 'packs', 'sleeves.json'), 'utf8'),
  ) as { questions: SealedQuestion[] };
  const withSong = pack.questions.filter((question) => question.previewUrl !== undefined);
  if (withSong.length < 2) throw new Error('sleeves.json has fewer than two sleeves with a song');
  const [sung, silenced] = buildQuizQuestions(withSong.slice(0, 2), 2);
  if (!sung || !silenced) throw new Error('could not build two sleeve questions');
  const silent: QuizQuestion = { ...silenced };
  delete silent.previewUrl;
  delete silent.previewStart;
  delete silent.previewSeconds;
  return [sung, silent];
}

const LAST = process.argv.includes('--last');

/** Two questions of a published pack — the first two, or the last two with `--last`. */
function twoOf(file: 'catchphrase.json' | 'blanks.json' | 'prices.json' | 'tags.json'): QuizQuestion[] {
  const pack = JSON.parse(
    readFileSync(join(import.meta.dirname, '..', 'public', 'packs', file), 'utf8'),
  ) as { questions: SealedQuestion[] };
  const built = buildQuizQuestions(LAST ? pack.questions.slice(-2) : pack.questions.slice(0, 2), 2);
  if (built.length < 2) throw new Error(`${file} has fewer than two questions`);
  return built;
}

const packArg = process.argv.indexOf('--pack');
const PACK = packArg > 0 ? process.argv[packArg + 1] : undefined;
if (
  PACK !== undefined
  && PACK !== 'sleeves'
  && PACK !== 'catchphrase'
  && PACK !== 'blanks'
  && PACK !== 'prices'
  && PACK !== 'tags'
) {
  throw new Error(`--pack takes sleeves, catchphrase, blanks, prices or tags, not ${PACK}`);
}
if (LAST && (PACK === undefined || PACK === 'sleeves')) {
  throw new Error('--last needs --pack catchphrase, blanks, prices or tags');
}
const ROUND =
  PACK === 'sleeves'
    ? { packId: 'sleeves' as const, packTitle: 'Sleeves', questions: sleeveQuestions() }
    : PACK === 'catchphrase'
      ? { packId: 'catchphrase' as const, packTitle: 'Catchphrase', questions: twoOf('catchphrase.json') }
      : PACK === 'blanks'
        ? { packId: 'blanks' as const, packTitle: 'Blankety Blank', questions: twoOf('blanks.json') }
        : PACK === 'prices'
          ? { packId: 'prices' as const, packTitle: 'The Price Was Right', questions: twoOf('prices.json') }
          : PACK === 'tags'
            ? { packId: 'tags' as const, packTitle: 'The Price is Right', questions: twoOf('tags.json') }
            : { packId: 'general-knowledge' as const, packTitle: 'GK', questions: QUESTIONS };

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const stamp = (): string => new Date().toISOString().slice(11, 23);

async function main(): Promise<void> {
  // Lite warns on every refused write with the request body, which for a reveal
  // candidate is the option itself. Three of four refuse by design, so warnings
  // here are noise at best and a blind pack's options at worst. Errors still log.
  setLiteLogLevel('error');
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
  // Hosted, as the app makes a room since W3: this process is host and beats,
  // or a browser that joins may claim the chair after 75 s.
  await setDoc(reference, {
    ...toPersisted(fresh),
    hostUid: uid,
    expiresAt: Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1_000),
  });
  // The host's duties — beat, reveal on the clock — are the app's own, from
  // `src/host/`. This script only presses what a person in the chair presses.
  const host = startNodeHost({
    db,
    lite: getLiteFirestore(app),
    code,
    uid,
    log: (line) => console.log(`${stamp()}  ${line}`),
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
  await host.dispatch([
    { type: 'selectPack', ...ROUND, wagerEnabled: false, stealEnabled: false },
    { type: 'start', at: Date.now(), gameId: `host-${Date.now()}`, durationSecs: DURATION_SECS },
  ]);

  // The host reveals once the clock and the vault's gate allow.
  const revealed = await host.until((room) => room.phase === 'reveal', DURATION_SECS * 1_000 + 30_000);

  // What the reveal actually did, which is the thing this harness could never
  // report. Read off the state the reveal produced rather than off the next
  // snapshot, which has not necessarily landed yet. A zero here now means
  // nobody answered, rather than meaning nothing was read.
  const named = Object.entries(revealed.lastDeltas)
    .map(([player, delta]) => `${revealed.players[player]?.name ?? player} +${delta}`)
    .join(', ');
  console.log(`${stamp()}      scored: ${named || 'nobody'}`);

  await sleep(8000);
  console.log(`${stamp()}  >>> WRITING next (to standings)`);
  await host.dispatch([{ type: 'next', at: Date.now() }]);

  await sleep(8000);
  console.log(`${stamp()}  >>> WRITING next (to question 2)`);
  await host.dispatch([{ type: 'next', at: Date.now() }]);

  await sleep(15_000);
  host.stop();
  for (const failure of host.failures()) console.log(`  host: ${failure}`);
  console.log('Done.');
}

main().catch((error: unknown) => {
  console.error('host-room failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
