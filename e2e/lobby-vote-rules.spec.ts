import { expect, test } from '@playwright/test';
import { get, increment, ref, remove, set, update } from 'firebase/database';
import { doc, getDoc, setDoc, Timestamp, updateDoc } from 'firebase/firestore';

import { planJoin } from '../src/engine/join';
import { reduce } from '../src/engine/reducer';
import { randomRoomCode } from '../src/engine/roomCode';
import { createRoom, type QuizQuestion } from '../src/engine/state';
import {
  highlightFor,
  lobbyVotePath,
  readLobbyVote,
  VOTE_GEN_PATTERN,
  voteGenOf,
} from '../src/engine/packVote';
import { toPersisted, toRoomState, toUpdate } from '../src/lib/roomDoc';
import { isolateFiles } from './isolate';
import { player } from './nodeClient';

isolateFiles();

/**
 * PROJ-34. The lobby vote on the Realtime Database, against the repo's rules.
 * A tap is not a write to the room document. `start` mints `voteGen` on that
 * document and the previous generation is left in place, unread.
 * docs/decisions/lobby-vote.md.
 */

const QUESTIONS: QuizQuestion[] = [
  {
    id: 'vote-gen-q',
    prompt: 'A question, so the round can start',
    options: ['A', 'B', 'C', 'D'],
    correctIndex: null,
    category: 'General Knowledge',
    difficulty: 'easy',
  },
];

async function denied(attempt: Promise<unknown>): Promise<boolean> {
  try {
    await attempt;
    return false;
  } catch (cause) {
    const text = String((cause as { code?: unknown }).code ?? cause).toLowerCase();
    return text.includes('permission');
  }
}

test('a vote lands on the Realtime Database, not the room, and a start leaves it behind', async () => {
  const host = await player();
  const guest = await player();
  try {
    const code = randomRoomCode();
    const fresh = reduce(createRoom(code), { type: 'join', uid: host.uid, name: 'Host', at: Date.now() });
    await setDoc(doc(host.db, 'rooms', code), {
      ...toPersisted({ ...fresh, hostUid: host.uid }),
      expiresAt: Timestamp.fromMillis(Date.now() + 60 * 60 * 1000),
    });
    // #given the guest votes the way the client does: one update, vote and tap
    const gen0 = lobbyVotePath(code, '0');
    await update(ref(guest.rtdb), {
      [`${gen0}/packVotes/${guest.uid}`]: 'sleeves',
      [`${gen0}/voteTaps/${guest.uid}`]: increment(1),
    });

    // #then the host's listener would see it, and the room document would not
    const seen = readLobbyVote((await get(ref(host.rtdb, gen0))).val());
    expect(seen.packVotes).toEqual({ [guest.uid]: 'sleeves' });
    expect(seen.voteTaps).toEqual({ [guest.uid]: 1 });
    const room = await getDoc(doc(host.db, 'rooms', code));
    expect(room.data()).not.toHaveProperty('packVotes');
    expect(room.data()).not.toHaveProperty('voteTaps');
    expect(room.data()).not.toHaveProperty('browsing');

    // #and they cannot write the host's vote, a long id, or a tap count they choose
    expect(await denied(set(ref(guest.rtdb, `${gen0}/packVotes/${host.uid}`), 'flags'))).toBe(true);
    expect(await denied(set(ref(guest.rtdb, `${gen0}/packVotes/${guest.uid}`), 'x'.repeat(65)))).toBe(true);
    expect(await denied(set(ref(guest.rtdb, `${gen0}/voteTaps/${guest.uid}`), 5))).toBe(true);
    expect(await denied(remove(ref(guest.rtdb, `${gen0}/voteTaps/${guest.uid}`)))).toBe(true);

    // #when they take it back, the vote goes and the tap stays counted
    await update(ref(guest.rtdb), {
      [`${gen0}/packVotes/${guest.uid}`]: null,
      [`${gen0}/voteTaps/${guest.uid}`]: increment(1),
    });
    const taken = readLobbyVote((await get(ref(host.rtdb, gen0))).val());
    expect(taken.packVotes).toEqual({});
    expect(taken.voteTaps).toEqual({ [guest.uid]: 2 });

    // #and a highlight is their own slot. The host's slot is the one the room shows.
    await set(ref(guest.rtdb, `${gen0}/browsing/${guest.uid}`), 'tunes');
    await set(ref(host.rtdb, `${gen0}/browsing/${host.uid}`), 'flags');
    expect(await denied(set(ref(guest.rtdb, `${gen0}/browsing/${host.uid}`), 'screens'))).toBe(true);
    const highlighted = readLobbyVote((await get(ref(host.rtdb, gen0))).val());
    expect(highlightFor(highlighted.browsingBy, host.uid)).toBe('flags');
    expect(highlightFor(highlighted.browsingBy, guest.uid)).toBe('tunes');

    // #and nobody can delete the generation, or vote under an id the rules refuse
    expect(await denied(remove(ref(guest.rtdb, gen0)))).toBe(true);
    expect(
      await denied(set(ref(guest.rtdb, `${lobbyVotePath(code, 'x'.repeat(41))}/packVotes/${guest.uid}`), 'sleeves')),
    ).toBe(true);

    // #when the host starts, the phase write mints a generation and does not touch the vote
    const current = toRoomState(code, (await getDoc(doc(host.db, 'rooms', code))).data() ?? {}, {});
    const started = reduce(
      reduce(current, {
        type: 'selectPack',
        packId: 'general-knowledge',
        packTitle: 'General Knowledge',
        questions: QUESTIONS,
        wagerEnabled: false,
        stealEnabled: false,
      }),
      { type: 'start', at: Date.now(), gameId: 'vote-gen-game', durationSecs: 10 },
    );
    await updateDoc(doc(host.db, 'rooms', code), toUpdate(started, current, () => 'gen-after-start'));

    const after = (await getDoc(doc(host.db, 'rooms', code))).data() ?? {};
    expect(after).not.toHaveProperty('packVotes');
    expect(voteGenOf(after['voteGen'])).toBe('gen-after-start');
    expect(VOTE_GEN_PATTERN.test(String(after['voteGen']))).toBe(true);

    // A lone mint, which is what a reset writes when the rest of the document is unchanged.
    await updateDoc(doc(host.db, 'rooms', code), { voteGen: 'gen-rules-check' });
    expect(voteGenOf((await getDoc(doc(host.db, 'rooms', code))).data()?.['voteGen'])).toBe('gen-rules-check');

    const playing = toRoomState(code, (await getDoc(doc(guest.db, 'rooms', code))).data() ?? {}, {});
    const joined = planJoin({
      players: playing.players,
      scores: playing.scores,
      phase: playing.phase,
      uid: guest.uid,
      name: 'Guest',
      playerId: guest.uid,
      squad: '',
      restored: null,
      now: Date.now(),
    });
    await updateDoc(doc(guest.db, 'rooms', code), {
      [`players.${guest.uid}`]: joined.entry,
      ...(joined.score === null ? {} : { [`scores.${guest.uid}`]: joined.score }),
    });
    // The generation just left still holds the highlight. Nothing deleted it.
    expect(highlightFor(readLobbyVote((await get(ref(host.rtdb, gen0))).val()).browsingBy, host.uid)).toBe('flags');
    // The generation the room now names is empty.
    expect(readLobbyVote((await get(ref(host.rtdb, lobbyVotePath(code, 'gen-after-start')))).val()).packVotes).toEqual(
      {},
    );

    // #and a member cannot mint one, and the host cannot write one the rules refuse
    expect(await denied(updateDoc(doc(guest.db, 'rooms', code), { voteGen: 'guest-cleared-it' }))).toBe(true);
    expect(await denied(updateDoc(doc(host.db, 'rooms', code), { voteGen: 'x'.repeat(41) }))).toBe(true);
    expect(await denied(updateDoc(doc(host.db, 'rooms', code), { voteGen: 'has a space' }))).toBe(true);
  } finally {
    await host.close();
    await guest.close();
  }
});
