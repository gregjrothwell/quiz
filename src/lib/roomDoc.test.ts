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
