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
