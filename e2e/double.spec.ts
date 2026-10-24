import { expect, test } from '@playwright/test';
import { collection, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

import { reduce } from '../src/engine/reducer';
import { randomRoomCode } from '../src/engine/roomCode';
import { commitmentDoc, freshNonce, revealDoc } from '../src/engine/sealedPick';
import type { StandoffPick } from '../src/engine/standoff';
import { createRoom, type QuizQuestion } from '../src/engine/state';
import { toPersisted } from '../src/lib/roomDoc';
import { startNodeHost } from '../scripts/nodeHost';
import { isolateFiles } from './isolate';
import { admin, player, seedVault, type Player } from './nodeClient';

isolateFiles();

/**
 * The Double, end to end: two rounds in one room, one final on the whole
 * morning (docs/decisions/morning-double.md, AC3, AC4, AC9, AC10, AC14).
 *
 * The real host from Node, as `node-round.spec.ts` runs it, against the
 * emulators and the repo's own rules. Two answerers; the host answers nothing.
 *
 * Round one: Ada answers first on every question and Bo second, so by the
 * rank table Ada holds 3,000 and Bo 2,700. Round two the other way round: Bo
 * 3,000, Ada 2,700. The morning is 5,700 each, a pot of 11,400.
 *
 * Ada shafts and Bo shares. Ada's morning becomes 11,400, so her round two
 * banks 11,400 less round one's 3,000: 8,400. Bo's becomes 0, so his round
 * two banks 0 less 2,700: −2,700. Round one is never touched.
 */

function questions(round: string): QuizQuestion[] {
  return Array.from({ length: 3 }, (_, index) => ({
    id: `double-${round}-${String(index)}`,
    prompt: `Double ${round} question ${String(index + 1)}`,
    options: ['The first one', 'The second one', 'The third one', 'The fourth one'],
    correctIndex: null,
    category: 'General Knowledge',
    difficulty: 'easy',
  }));
}

interface Seat {
  name: string;
  pick: StandoffPick;
  client: Player;
}

test('a double: half-time banks round one, and the final stakes the whole morning', async () => {
  test.setTimeout(360_000);

  // #given a room made as the app makes one, hosted by its creator, with Ada and Bo in it
  const host = await player();
  const ada: Seat = { name: 'Ada', pick: 'shaft', client: await player() };
  const bo: Seat = { name: 'Bo', pick: 'share', client: await player() };
  const seats = [ada, bo];
  const code = randomRoomCode();
  const joined = reduce(createRoom(code), { type: 'join', uid: host.uid, name: 'Host', at: Date.now() });
  await setDoc(doc(host.db, 'rooms', code), { ...toPersisted({ ...joined, hostUid: host.uid }) });

  const lines: string[] = [];
  const running = startNodeHost({ db: host.db, lite: host.lite, code, uid: host.uid, log: (line) => lines.push(line) });

  /** One round, chosen and started by the chair, with `first` answering ahead of `second` throughout. */
  async function playRound(gameId: string, round: QuizQuestion[], first: Seat, second: Seat): Promise<void> {
    await running.dispatch([
      {
        type: 'selectPack',
        packId: 'general-knowledge',
        packTitle: 'GK',
        questions: round,
        wagerEnabled: false,
        stealEnabled: false,
        standoffEnabled: true,
        doubleEnabled: true,
      },
      { type: 'start', at: Date.now(), gameId, durationSecs: 10 },
    ]);
    await running.until((room) => room.phase === 'question' && room.gameId === gameId);
    await seedVault(code);

    for (let index = 0; index < round.length; index += 1) {
      await running.until((room) => room.phase === 'question' && room.index === index);
      for (const [seat, elapsedMs] of [[first, 1_200], [second, 2_400]] as const) {
        await setDoc(doc(collection(seat.client.db, 'rooms', code, 'answers'), seat.client.uid), {
          optionIndex: 0,
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
  }

  try {
    for (const { client, name } of seats) {
      await updateDoc(doc(client.db, 'rooms', code), {
        [`players.${client.uid}`]: { name, joinedAt: Date.now() },
        [`scores.${client.uid}`]: 0,
      });
    }
    await running.until((room) => Object.keys(room.players).length === 3);

    // #when round one is played, with Share or Shaft on
    const one = `double-one-${String(Date.now())}`;
    await playRound(one, questions('one'), ada, bo);

    // #then it stops at half-time, with no final, holding round one's own scores
    await running.until((room) => room.phase === 'finished');
    const paused = (await admin().doc(`rooms/${code}`).get()).data() ?? {};
    expect(paused.standoff ?? null).toBeNull();
    expect((paused.scores as Record<string, number>)[ada.client.uid]).toBe(3_000);
    expect((paused.scores as Record<string, number>)[bo.client.uid]).toBe(2_700);

    // #and round one is kept as an ordinary round, with no link
    const keptOne = await admin().doc(`games/${one}`).get();
    expect(keptOne.exists).toBe(true);
    expect(keptOne.get('doubleOf')).toBeUndefined();

    // #when the chair presses Round two, and round two is played the other way round
    await running.dispatch({ type: 'roundTwo' });
    await running.until((room) => room.phase === 'lobby' && room.double?.gameId === one);
    const two = `double-two-${String(Date.now())}`;
    await playRound(two, questions('two'), bo, ada);

    // #then the final opens on the whole morning: 5,700 each in the pot
    await running.until((room) => room.phase === 'standoff');
    const opened = (await admin().doc(`rooms/${code}`).get()).data() ?? {};
    const stakes = (opened.standoff as { stakes: Record<string, number> }).stakes;
    expect(stakes).toEqual({ [ada.client.uid]: 5_700, [bo.client.uid]: 5_700 });

    // #when Ada shafts and Bo shares
    await running.until((room) => room.standoff?.stage === 'pick', 90_000);
    const nonces = new Map(seats.map(({ client }) => [client.uid, freshNonce()]));
    for (const { client, pick } of seats) {
      const written = await commitmentDoc(pick, nonces.get(client.uid) ?? '', two, client.uid);
      await setDoc(doc(client.db, 'rooms', code, 'standoff', client.uid), written);
    }
    await running.until((room) => room.standoff?.stage === 'closed', 20_000);
    for (const { client, pick } of seats) {
      await updateDoc(doc(client.db, 'rooms', code, 'standoff', client.uid), revealDoc(pick, nonces.get(client.uid) ?? ''));
    }
    await running.until((room) => room.standoff?.stage === 'revealed', 20_000);
    await running.dispatch({ type: 'next', at: Date.now() });
    await running.until((room) => room.phase === 'finished');

    // #then round two holds the settled morning less round one, read back past the host's cache
    const ended = (await admin().doc(`rooms/${code}`).get()).data() ?? {};
    const scores = ended.scores as Record<string, number>;
    expect(scores[ada.client.uid], 'Ada').toBe(8_400);
    expect(scores[bo.client.uid], 'Bo').toBe(-2_700);
    expect(scores[host.uid]).toBe(0);

    // #and round two is kept naming round one, and round one is unchanged
    const keptTwo = await admin().doc(`games/${two}`).get();
    expect(keptTwo.exists).toBe(true);
    expect(keptTwo.get('doubleOf')).toBe(one);
    const oneAgain = await admin().doc(`games/${one}`).get();
    expect(oneAgain.get('scores')).toEqual(keptOne.get('scores'));

    const unexpected = running.failures().filter((failure) => !/^reveal failed: .*Transaction lock timeout/.test(failure));
    expect(unexpected).toEqual([]);
  } finally {
    running.stop();
    console.log(lines.join('\n'));
    for (const { client } of seats) await client.close();
    await host.close();
  }
});
