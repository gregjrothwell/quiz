import { deleteField, Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';

import type { AnswerDoc } from '../engine/answers';
import { createRoom } from '../engine/state';
import { answerDocFrom, liveAnswersFromRoom, openedAtMillis, toPersisted, toRoomState, toUpdate } from './roomDoc';

describe('the lobby vote is not on the room document', () => {
  it('a create does not write the vote, and a document that still has one reads as nobody voting', () => {
    expect(toPersisted(createRoom('ABCD'))).not.toHaveProperty('packVotes');
    expect(toPersisted(createRoom('ABCD'))).not.toHaveProperty('voteTaps');
    expect(toPersisted(createRoom('ABCD'))).not.toHaveProperty('browsing');

    const data = {
      ...toPersisted(createRoom('ABCD')),
      packVotes: { guest: 'flags' },
      voteTaps: { guest: 2 },
      browsing: 'screens',
    };
    const state = toRoomState('ABCD', data, {});
    expect(state.packVotes).toEqual({});
    expect(state.voteTaps).toEqual({});
    expect(state.browsing).toBeNull();
  });

  it('crossing the lobby mints a generation and does not write the vote maps', () => {
    const before = {
      ...createRoom('ABCD'),
      packVotes: { guest: 'flags' as const },
      voteTaps: { guest: 1 },
      browsing: 'flags' as const,
    };
    const leaving = toUpdate(
      { ...before, phase: 'question', questionOpenedAt: 1, gameId: 'g', packVotes: {}, voteTaps: {}, browsing: null },
      before,
      () => 'gen-next',
    );
    expect(leaving.voteGen).toBe('gen-next');
    expect(leaving).not.toHaveProperty('packVotes');
    expect(leaving).not.toHaveProperty('voteTaps');
    expect(leaving).not.toHaveProperty('browsing');

    const entering = toUpdate(
      { ...before, phase: 'lobby', packVotes: {}, voteTaps: {}, browsing: null },
      { ...before, phase: 'finished' },
      () => 'gen-after',
    );
    expect(entering.voteGen).toBe('gen-after');
  });

  it('a dispatch that stays in the lobby does not mint a generation', () => {
    const lobby = createRoom('ABCD');
    expect(toUpdate(lobby, lobby, () => 'gen-next')).not.toHaveProperty('voteGen');
    expect(toUpdate(lobby, null, () => 'gen-next')).not.toHaveProperty('voteGen');
  });
});

describe('the room document and W3', () => {
  it('reads a room made before W3 as having no host, so it keeps the derived quizmaster', () => {
    const legacy = { ...toPersisted(createRoom('ABCD')) } as Record<string, unknown>;
    delete legacy.hostUid;
    delete legacy.lastPicks;
    const state = toRoomState('ABCD', legacy, {});
    expect(state.hostUid).toBeNull();
    expect(state.lastPicks).toEqual({});
  });

  it('reads the published picks through the answer guard', () => {
    const data = {
      ...toPersisted(createRoom('ABCD')),
      hostUid: 'host',
      lastPicks: {
        ann: { optionIndex: 2, elapsedMs: 900, wager: 50 },
        junk: { optionIndex: 'B' },
      },
    };
    const state = toRoomState('ABCD', data, {});
    expect(state.hostUid).toBe('host');
    expect(state.lastPicks).toEqual({ ann: { optionIndex: 2, elapsedMs: 900, wager: 50 } });
  });

  it('never writes hostUid from a phase transition, so a stale fold cannot move the chair', () => {
    const before = { ...createRoom('ABCD'), hostUid: 'host' };
    const after = { ...before, phase: 'scoreboard' as const, hostUid: 'someone-else' };
    expect(toUpdate(after, before)).not.toHaveProperty('hostUid');
  });

  it('creates with the host named, which is what the create rule checks', () => {
    expect(toPersisted({ ...createRoom('ABCD'), hostUid: 'me' }).hostUid).toBe('me');
  });

  it('leaves the chaser card off a normal write, and deletes it when the question opens', () => {
    const lobby = createRoom('ABCD');
    expect(toUpdate(lobby, null)).not.toHaveProperty('chaserIntro');

    const waiting = { ...lobby, chaserEnabled: true, chaserIntro: { at: 1_000, durationSecs: 10 } };
    expect(toUpdate(waiting, lobby).chaserIntro).toEqual({ at: 1_000, durationSecs: 10 });

    const opened = { ...waiting, phase: 'question' as const, chaserIntro: null, questionOpenedAt: 5_000, gameId: 'g' };
    expect(toUpdate(opened, waiting).chaserIntro).toEqual(deleteField());

    const legacy = { ...toPersisted(lobby) } as Record<string, unknown>;
    delete legacy.chaserIntro;
    expect(toRoomState('ABCD', legacy, {}).chaserIntro).toBeNull();
    expect(toRoomState('ABCD', { ...legacy, chaserIntro: { at: 1_000, durationSecs: 10 } }, {}).chaserIntro).toEqual({
      at: 1_000,
      durationSecs: 10,
    });
    expect(toRoomState('ABCD', { ...legacy, chaserIntro: { durationSecs: 10 } }, {}).chaserIntro).toEqual({
      at: 0,
      durationSecs: 10,
    });
    expect(toRoomState('ABCD', { ...legacy, chaserIntro: { durationSecs: 1 } }, {}).chaserIntro).toBeNull();
  });
});

describe('the Ladder notice on the room document', () => {
  const line = 'Out of hard questions in this pack — using medium';

  it('omits the field when the round climbed, so the write matches a room from before it', () => {
    expect(toPersisted(createRoom('ABCD'))).not.toHaveProperty('ladderNotices');
  });

  it('round-trips the lines, and drops anything that is not a short sentence', () => {
    const saved = toPersisted({ ...createRoom('ABCD'), ladderNotices: [line] });
    const read = toRoomState('ABCD', { ...saved, ladderNotices: [line, 4, 'x'.repeat(161)] }, {});
    expect(read.ladderNotices).toEqual([line]);
  });

  it('clears a notice from the previous round, because an update merges', () => {
    const before = { ...createRoom('ABCD'), ladderNotices: [line] };
    const after = { ...before, ladderNotices: [] as const };
    expect(toUpdate(after, before).ladderNotices).toEqual(deleteField());
  });
});

describe('the room document and the Double', () => {
  const HALF = { gameId: 'round-one', scores: { ann: 6_000, bob: 3_000 } };

  it('reads a room from before the Double as not one', () => {
    const legacy = { ...toPersisted(createRoom('ABCD')) } as Record<string, unknown>;
    delete legacy.doubleEnabled;
    delete legacy.double;
    const state = toRoomState('ABCD', legacy, {});
    expect(state.doubleEnabled).toBe(false);
    expect(state.double).toBeNull();
  });

  it('round-trips round one, so a reload or a new host keeps the morning (AC8)', () => {
    const room = { ...createRoom('ABCD'), doubleEnabled: true, double: HALF };
    const state = toRoomState('ABCD', { ...toPersisted(room) }, {});
    expect(state.doubleEnabled).toBe(true);
    expect(state.double).toEqual(HALF);
  });

  it('drops a first half that is not one, rather than trusting it', () => {
    for (const junk of ['x', { gameId: 4, scores: {} }, { gameId: 'g', scores: { ann: 'lots' } }, { gameId: 'g' }]) {
      const data = { ...toPersisted(createRoom('ABCD')), double: junk };
      expect(toRoomState('ABCD', data, {}).double).toBeNull();
    }
  });

  it('Round two writes the first half and never the players map', () => {
    const before = { ...createRoom('ABCD'), phase: 'finished' as const, doubleEnabled: true };
    const after = { ...before, phase: 'lobby' as const, double: HALF };
    const update = toUpdate(after, before);
    expect(update).toHaveProperty('double', HALF);
    expect(update).not.toHaveProperty('players');
  });

  // As `chaserIntro` is: an ordinary round must not grow a field the
  // host-writes recording has never had.
  it('an ordinary transition does not write a first half', () => {
    const before = createRoom('ABCD');
    expect(toUpdate({ ...before, phase: 'question' }, before)).not.toHaveProperty('double');
  });

  // `updateDoc` merges, so a key left off keeps its old value — and the next
  // round would think it was round two of a double that is over.
  it('Another round after a double deletes the first half', () => {
    const before = { ...createRoom('ABCD'), phase: 'finished' as const, doubleEnabled: true, double: HALF };
    const after = { ...before, phase: 'lobby' as const, doubleEnabled: false, double: null };
    expect(toUpdate(after, before).double).toEqual(deleteField());
  });
});

describe('answers scored from the room snapshot', () => {
  it('scores an answer from the server openedAt, and keeps one with no stamp', () => {
    const players = {
      greg: { name: 'Greg', joinedAt: 1 },
      sam: { name: 'Sam', joinedAt: 2 },
      alex: { name: 'Alex', joinedAt: 3 },
      jo: { name: 'Jo', joinedAt: 4 },
    };
    const openedAt = Timestamp.fromMillis(5_000);
    const room = {
      players,
      index: 0,
      // The writer's own clock. Scoring must not read it.
      questionOpenedAt: 9_000,
      openedAt,
    };
    const before: AnswerDoc = { optionIndex: 1, elapsedMs: 900, questionIndex: 0, at: 4_999 };
    const onOpen: AnswerDoc = { optionIndex: 2, elapsedMs: 400, questionIndex: 0, at: 5_000 };
    const after: AnswerDoc = { optionIndex: 0, elapsedMs: 800, questionIndex: 0, at: 5_400 };
    const pending = answerDocFrom({ optionIndex: 3, elapsedMs: 100, questionIndex: 0, at: null });
    expect(pending).toEqual({ optionIndex: 3, elapsedMs: 100, questionIndex: 0 });
    if (!pending) throw new Error('a pending stamp should still parse');

    expect(liveAnswersFromRoom(room, { greg: before, sam: onOpen, alex: after, jo: pending })).toEqual({
      sam: { optionIndex: 2, elapsedMs: 400, at: 5_000 },
      alex: { optionIndex: 0, elapsedMs: 800, at: 5_400 },
      jo: { optionIndex: 3, elapsedMs: 100 },
    });

    // A pending open is not a Timestamp, so nothing is dropped on it.
    expect(openedAtMillis({ openedAt: null })).toBeNull();
    expect(openedAtMillis({ questionOpenedAt: 9_000 })).toBeNull();
    expect(liveAnswersFromRoom({ ...room, openedAt: null }, { greg: before })).toEqual({
      greg: { optionIndex: 1, elapsedMs: 900, at: 4_999 },
    });

    // A resolved stamp on the answer document is milliseconds before it is scored.
    const stamped = answerDocFrom({
      optionIndex: 1,
      elapsedMs: 900,
      questionIndex: 0,
      at: Timestamp.fromMillis(5_400),
    });
    expect(stamped?.at).toBe(5_400);
    if (!stamped) throw new Error('a resolved stamp should parse');
    expect(liveAnswersFromRoom(room, { sam: stamped })).toEqual({
      sam: { optionIndex: 1, elapsedMs: 900, at: 5_400 },
    });
  });
});
