import { expect, test } from '@playwright/test';
import { collection, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

import { reduce } from '../src/engine/reducer';
import { randomRoomCode } from '../src/engine/roomCode';
import { commitmentDoc, freshNonce, revealDoc } from '../src/engine/sealedPick';
import type { StandoffPick } from '../src/engine/standoff';
import { createRoom, type QuizQuestion } from '../src/engine/state';
import { toPersisted } from '../src/lib/roomDoc';
import { startNodeHost } from '../scripts/nodeHost';
import { admin, player, seedVault } from './nodeClient';

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

    // #and the host kept the round, every question revealed through the vault
    const kept = await admin().doc(`games/${gameId}`).get();
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
