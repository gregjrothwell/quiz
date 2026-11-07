import { expect, test } from '@playwright/test';
import { collection, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

import { reduce } from '../src/engine/reducer';
import { randomRoomCode } from '../src/engine/roomCode';
import { commitmentDoc, freshNonce, revealDoc } from '../src/engine/sealedPick';
import { finalistsFor, tieAtCut, type StandoffPick } from '../src/engine/standoff';
import { tieWords } from '../src/engine/standoffWords';
import { createRoom, type QuizQuestion } from '../src/engine/state';
import { toPersisted } from '../src/lib/roomDoc';
import { startNodeHost } from '../scripts/nodeHost';
import { isolateFiles } from './isolate';
import { admin, player, seedVault, until } from './nodeClient';

isolateFiles();

/**
 * The real host, with no browser (host-loop.md, C2): `src/host/` run from Node
 * by `scripts/nodeHost.ts`, against the emulators and the repo's own rules, for
 * a whole round — start, every reveal on the clock through the vault, the
 * Share or Shaft final's three moves, and the round kept in `games/`.
 *
 * Two answerers write their answers as the app does; the host answers nothing.
 * The test presses only what a person in the chair presses: Start and Next.
 * Everything else is the host's own doing, and that is what is being proved.
 *
 * Ada answers first and Bo second on every question, so by the rank table Ada
 * holds 3,000 and Bo 2,700. Ada shafts and Bo shares: Ada takes the pot of
 * 5,700 and Bo goes home with nothing (docs/decisions/share-or-shaft.md).
 */

const QUESTIONS: QuizQuestion[] = Array.from({ length: 3 }, (_, index) => ({
  id: `node-round-${String(index)}`,
  prompt: `Node round question ${String(index + 1)}`,
  options: ['The first one', 'The second one', 'The third one', 'The fourth one'],
  correctIndex: null,
  category: 'General Knowledge',
  difficulty: 'easy',
}));

const SEATS = [
  { name: 'Ada', elapsedMs: 1_200, pick: 'shaft' as StandoffPick, after: 5_700 },
  { name: 'Bo', elapsedMs: 2_400, pick: 'share' as StandoffPick, after: 0 },
];

test('the host runs a whole round from Node, final and all, with no browser', async () => {
  test.setTimeout(240_000);

  // #given a room made as the app makes one, hosted by its creator
  const host = await player();
  const seats = await Promise.all(SEATS.map(async (seat) => ({ ...seat, client: await player() })));
  const code = randomRoomCode();
  const joined = reduce(createRoom(code), { type: 'join', uid: host.uid, name: 'Host', at: Date.now() });
  await setDoc(doc(host.db, 'rooms', code), { ...toPersisted({ ...joined, hostUid: host.uid }) });

  const lines: string[] = [];
  const running = startNodeHost({ db: host.db, lite: host.lite, code, uid: host.uid, log: (line) => lines.push(line) });

  try {
    for (const { client, name } of seats) {
      await updateDoc(doc(client.db, 'rooms', code), {
        [`players.${client.uid}`]: { name, joinedAt: Date.now() },
        [`scores.${client.uid}`]: 0,
      });
    }
    await running.until((room) => Object.keys(room.players).length === 3);

    // #when the chair presses Start
    const gameId = `node-${String(Date.now())}`;
    await running.dispatch([
      {
        type: 'selectPack',
        packId: 'general-knowledge',
        packTitle: 'GK',
        questions: QUESTIONS,
        wagerEnabled: false,
        stealEnabled: false,
        standoffEnabled: true,
      },
      { type: 'start', at: Date.now(), gameId, durationSecs: 10 },
    ]);
    await running.until((room) => room.phase === 'question');
    await seedVault(code);

    // #and the players answer every question, and the chair presses Next after each reveal
    for (let index = 0; index < QUESTIONS.length; index += 1) {
      await running.until((room) => room.phase === 'question' && room.index === index);
      for (const { client, elapsedMs } of seats) {
        await setDoc(doc(collection(client.db, 'rooms', code, 'answers'), client.uid), {
          optionIndex: 0,
          elapsedMs,
          questionIndex: index,
          at: serverTimestamp(),
        });
      }
      // #then the host reveals on its own once the clock and the gate allow
      await running.until((room) => room.phase === 'reveal' && room.index === index, 30_000);
      await running.dispatch({ type: 'next', at: Date.now() });
      await running.until((room) => room.phase === 'scoreboard');
      await running.dispatch({ type: 'next', at: Date.now() });
    }

    // #and in the final the host ends the talk on its own, after its minute
    await running.until((room) => room.phase === 'standoff');
    await running.until((room) => room.standoff?.stage === 'pick', 90_000);

    const nonces = new Map(seats.map(({ client }) => [client.uid, freshNonce()]));
    for (const { client, pick } of seats) {
      const written = await commitmentDoc(pick, nonces.get(client.uid) ?? '', gameId, client.uid);
      await setDoc(doc(client.db, 'rooms', code, 'standoff', client.uid), written);
    }
    // #and blows the whistle once both are in
    await running.until((room) => room.standoff?.stage === 'closed', 20_000);
    for (const { client, pick } of seats) {
      await updateDoc(doc(client.db, 'rooms', code, 'standoff', client.uid), revealDoc(pick, nonces.get(client.uid) ?? ''));
    }
    // #and settles once both picks open
    await running.until((room) => room.standoff?.stage === 'revealed', 20_000);
    await running.dispatch({ type: 'next', at: Date.now() });
    await running.until((room) => room.phase === 'finished');

    // #then the room holds the table's numbers, read back past the host's cache
    const ended = (await admin().doc(`rooms/${code}`).get()).data() ?? {};
    const scores = ended.scores as Record<string, number>;
    for (const { client, name, after } of seats) expect(scores[client.uid], name).toBe(after);
    expect(scores[host.uid]).toBe(0);

    // #and the count the final's tie-break reads survived the rules on every reveal
    const count = ended.rightAnswers as Record<string, { right: number; ms: number }> | undefined;
    const counted = seats.filter(({ client }) => (count?.[client.uid]?.right ?? 0) > 0);
    expect(counted.length).toBeGreaterThan(0);

    // #and the host kept the round, every question revealed through the vault
    // Its own move once the host sees `finished`, so wait for it rather than read once.
    const kept = await until(() => admin().doc(`games/${gameId}`).get(), (record) => record.exists);
    expect(kept.exists).toBe(true);
    expect(kept.get('writtenBy')).toBe(host.uid);
    // `reveal` is only written by the device that revealed, so its presence on
    // every question says this host did all three.
    const recorded = kept.get('questions') as { correctIndex: number | null; reveal?: { attempts: number } }[];
    expect(recorded.map((question) => question.correctIndex)).toEqual([0, 0, 0]);
    expect(recorded.map((question) => (question.reveal?.attempts ?? 0) >= 1)).toEqual([true, true, true]);
    console.log(`reveal attempts per question: ${recorded.map((question) => String(question.reveal?.attempts)).join(', ')}`);

    // #and it held the chair throughout
    expect((await admin().doc(`rooms/${code}/host/beat`).get()).exists).toBe(true);
    // The emulator turns some of the vault's four concurrent candidate writes
    // down with "Transaction lock timeout"; the retry ladder is what recovers
    // them (attempts above). Anything else failing is a real failure.
    const unexpected = running.failures().filter((failure) => !/^reveal failed: .*Transaction lock timeout/.test(failure));
    expect(unexpected).toEqual([]);
    console.log(`reveal attempts the emulator's locks refused, all retried: ${String(running.failures().length)}`);
  } finally {
    running.stop();
    console.log(lines.join('\n'));
    for (const { client } of seats) await client.close();
    await host.close();
  }
});

/**
 * A tie for a place in the final, played for real: the count goes through the
 * reducer, the rules and the room, and the host picks the finalists from it.
 *
 *            Ada     Bo      Cy
 *   Q1-5     900     800     1,000   each: Cy first, Ada second, Bo third
 *   Q6       wrong   1,000   wrong
 *   Q7       1,000   wrong   wrong
 *   Total    5,500   5,000   5,000
 *   Right    6       6       5
 *
 * Bo and Cy tie for the second seat. Cy was faster, and the game id is chosen so
 * the coin would pick Cy too, so only "more right first" can put Bo through.
 */
const TIE_QUESTIONS: QuizQuestion[] = Array.from({ length: 7 }, (_, index) => ({
  id: `final-tie-${String(index)}`,
  prompt: `Tied round question ${String(index + 1)}`,
  options: ['The first one', 'The second one', 'The third one', 'The fourth one'],
  correctIndex: null,
  category: 'General Knowledge',
  difficulty: 'easy',
}));

const RIGHT = 0;
const WRONG = 1;
type TiePlan = Record<'Ada' | 'Bo' | 'Cy', readonly [number, number]>;
const SHARED: TiePlan = { Cy: [RIGHT, 1_200], Ada: [RIGHT, 2_400], Bo: [RIGHT, 3_600] };
const TIE_PLAN: TiePlan[] = [
  SHARED,
  SHARED,
  SHARED,
  SHARED,
  SHARED,
  { Ada: [WRONG, 1_200], Bo: [RIGHT, 1_200], Cy: [WRONG, 1_200] },
  { Ada: [RIGHT, 1_200], Bo: [WRONG, 1_200], Cy: [WRONG, 1_200] },
];

test('a tie for the final goes to more right, ahead of the faster player and the coin', async () => {
  test.setTimeout(240_000);

  // #given a hosted room of three answerers
  const host = await player();
  const [ada, bo, cy] = await Promise.all([player(), player(), player()]);
  if (!ada || !bo || !cy) throw new Error('three players were not made');
  const seats = [
    { name: 'Ada' as const, client: ada },
    { name: 'Bo' as const, client: bo },
    { name: 'Cy' as const, client: cy },
  ];
  const code = randomRoomCode();
  const joined = reduce(createRoom(code), { type: 'join', uid: host.uid, name: 'Host', at: Date.now() });
  await setDoc(doc(host.db, 'rooms', code), { ...toPersisted({ ...joined, hostUid: host.uid }) });
  const running = startNodeHost({ db: host.db, lite: host.lite, code, uid: host.uid, log: () => undefined });

  try {
    for (const { client, name } of seats) {
      await updateDoc(doc(client.db, 'rooms', code), {
        [`players.${client.uid}`]: { name, joinedAt: Date.now() },
        [`scores.${client.uid}`]: 0,
      });
    }
    await running.until((room) => Object.keys(room.players).length === 4);

    // #and a game id whose coin, on its own, would pick Cy
    const players = (await running.until(() => true)).players;
    const tiedScores = { [host.uid]: 0, [ada.uid]: 5_500, [bo.uid]: 5_000, [cy.uid]: 5_000 };
    let gameId = '';
    for (let attempt = 0; attempt < 64 && gameId === ''; attempt += 1) {
      const candidate = `final-tie-${String(Date.now())}-${String(attempt)}`;
      if (finalistsFor(players, tiedScores, candidate)?.[1] === cy.uid) gameId = candidate;
    }
    expect(gameId).not.toBe('');

    // #when the round is played to the plan
    await running.dispatch([
      {
        type: 'selectPack',
        packId: 'general-knowledge',
        packTitle: 'GK',
        questions: TIE_QUESTIONS,
        wagerEnabled: false,
        stealEnabled: false,
        standoffEnabled: true,
      },
      { type: 'start', at: Date.now(), gameId, durationSecs: 10 },
    ]);
    await running.until((room) => room.phase === 'question');
    await seedVault(code);

    for (const [index, plan] of TIE_PLAN.entries()) {
      await running.until((room) => room.phase === 'question' && room.index === index);
      for (const { client, name } of seats) {
        const [optionIndex, elapsedMs] = plan[name];
        await setDoc(doc(collection(client.db, 'rooms', code, 'answers'), client.uid), {
          optionIndex,
          elapsedMs,
          questionIndex: index,
          at: serverTimestamp(),
        });
      }
      await running.until((room) => room.phase === 'reveal' && room.index === index, 30_000);
      await running.dispatch({ type: 'next', at: Date.now() });
      await running.until((room) => room.phase === 'scoreboard');
      await running.dispatch({ type: 'next', at: Date.now() });
    }
    await running.until((room) => room.phase === 'standoff');

    // #then the scores tie as planned, read back past the host's cache
    const final = (await admin().doc(`rooms/${code}`).get()).data() ?? {};
    expect(final.scores).toEqual(tiedScores);

    // #and the count on the room says why
    const count = final.rightAnswers as Record<string, { right: number; ms: number }>;
    expect(count[bo.uid]).toEqual({ right: 6, ms: 19_200 });
    expect(count[cy.uid]).toEqual({ right: 5, ms: 6_000 });

    // #and Bo is through, on more right, and the room is told so
    const finalists = (final.standoff as { finalists: [string, string] }).finalists;
    expect(finalists).toEqual([ada.uid, bo.uid]);
    const nameOf = (uid: string): string => players[uid]?.name ?? uid;
    const tie = tieAtCut(players, tiedScores, finalists, count);
    expect(tie?.decidedBy).toBe('right');
    expect(tieWords({ tie, nameOf, youUid: null })).toBe('Bo and Cy tied on 5,000. Bo got more right, 6 to 5.');

    const unexpected = running.failures().filter((failure) => !/^reveal failed: .*Transaction lock timeout/.test(failure));
    expect(unexpected).toEqual([]);
  } finally {
    running.stop();
    for (const { client } of seats) await client.close();
    await host.close();
  }
});

/**
 * PROJ-119: last round's answer must not score in this one.
 *
 * Each player has one answer document, overwritten per question, and question
 * numbers repeat every round. Bo answers the last question of round one and then
 * sits out round two, still seated — a locked phone, so no lobby keep-warm
 * deletes the document. On round two's last question his old document matches
 * the index. Before the fix it scored, right and fast; now its server `at` is
 * before that question's `openedAt` and it is dropped.
 */
// A round of its own each time, as asked-history makes it in a real room. With
// round one's ids replayed, round two's first reveal never came (30s, 7 Nov).
// Cause not established: `resolveAnswer` reads an existing reveal back, so it
// is not simply the reveal being immutable. A PROJ-119 follow-up.
const staleQuestions = (round: number): QuizQuestion[] => Array.from({ length: 2 }, (_, index) => ({
  id: `stale-answer-${String(round)}-${String(index)}`,
  prompt: `Stale answer round ${String(round)} question ${String(index + 1)}`,
  options: ['The first one', 'The second one', 'The third one', 'The fourth one'],
  correctIndex: null,
  category: 'General Knowledge',
  difficulty: 'easy',
}));

test('an answer left from the last round does not score on the same question number in the next', async () => {
  test.setTimeout(240_000);

  // #given a hosted room with Ada and Bo seated
  const host = await player();
  const [ada, bo] = await Promise.all([player(), player()]);
  if (!ada || !bo) throw new Error('two players were not made');
  const code = randomRoomCode();
  const joined = reduce(createRoom(code), { type: 'join', uid: host.uid, name: 'Host', at: Date.now() });
  await setDoc(doc(host.db, 'rooms', code), { ...toPersisted({ ...joined, hostUid: host.uid }) });
  const running = startNodeHost({ db: host.db, lite: host.lite, code, uid: host.uid, log: () => undefined });

  const answer = async (client: typeof ada, questionIndex: number): Promise<void> => {
    await setDoc(doc(collection(client.db, 'rooms', code, 'answers'), client.uid), {
      optionIndex: 0,
      elapsedMs: 1_200,
      questionIndex,
      at: serverTimestamp(),
    });
  };
  const playRound = async (round: number, answerers: (typeof ada)[]): Promise<void> => {
    const gameId = `stale-${String(round)}-${String(Date.now())}`;
    const questions = staleQuestions(round);
    await running.dispatch([
      {
        type: 'selectPack',
        packId: 'general-knowledge',
        packTitle: 'GK',
        questions,
        wagerEnabled: false,
        stealEnabled: false,
        standoffEnabled: false,
      },
      { type: 'start', at: Date.now(), gameId, durationSecs: 10 },
    ]);
    await running.until((room) => room.phase === 'question' && room.gameId === gameId);
    await seedVault(code);
    for (let index = 0; index < questions.length; index += 1) {
      await running.until((room) => room.phase === 'question' && room.index === index);
      for (const client of answerers) await answer(client, index);
      await running.until((room) => room.phase === 'reveal' && room.index === index, 30_000);
      await running.dispatch({ type: 'next', at: Date.now() });
      if (index < questions.length - 1) {
        await running.until((room) => room.phase === 'scoreboard');
        await running.dispatch({ type: 'next', at: Date.now() });
      }
    }
    await running.until((room) => room.phase === 'finished');
  };

  try {
    for (const [client, name] of [[ada, 'Ada'], [bo, 'Bo']] as const) {
      await updateDoc(doc(client.db, 'rooms', code), {
        [`players.${client.uid}`]: { name, joinedAt: Date.now() },
        [`scores.${client.uid}`]: 0,
      });
    }
    await running.until((room) => Object.keys(room.players).length === 3);

    // #and round one, which both answer right
    await playRound(1, [ada, bo]);
    const first = (await admin().doc(`rooms/${code}`).get()).data() ?? {};
    expect((first.scores as Record<string, number>)[bo.uid], 'Bo scored in round one').toBeGreaterThan(0);

    // #when the room goes again and Bo, still seated, answers nothing
    await running.dispatch({ type: 'reset' });
    await running.until((room) => room.phase === 'lobby');
    await playRound(2, [ada]);

    // #then Bo's document still holds round one's last answer — the precondition
    const left = (await admin().doc(`rooms/${code}/answers/${bo.uid}`).get()).data() ?? {};
    expect(left.questionIndex).toBe(1);

    // #and it scored nothing, and was not published as a pick
    const ended = (await admin().doc(`rooms/${code}`).get()).data() ?? {};
    const scores = ended.scores as Record<string, number>;
    expect(scores[ada.uid], 'Ada answered round two').toBeGreaterThan(0);
    expect(scores[bo.uid], 'Bo answered nothing in round two').toBe(0);
    expect(Object.keys((ended.lastPicks ?? {}) as Record<string, unknown>)).not.toContain(bo.uid);

    const unexpected = running.failures().filter((failure) => !/^reveal failed: .*Transaction lock timeout/.test(failure));
    expect(unexpected).toEqual([]);
  } finally {
    running.stop();
    await ada.close();
    await bo.close();
    await host.close();
  }
});
