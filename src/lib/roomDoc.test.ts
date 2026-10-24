import { deleteField } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';

import { createRoom } from '../engine/state';
import { toPersisted, toRoomState, toUpdate } from './roomDoc';

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
