import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  BEAT_EVERY_MS,
  CLAIM_AFTER_ABSENT_MS,
  CLAIM_AFTER_SILENT_MS,
  planClaim,
  resolveHost,
  successorOnLeave,
} from './host';
import type { Player } from './state';

const players: Record<string, Player> = {
  host: { name: 'Host', joinedAt: 100 },
  ann: { name: 'Ann', joinedAt: 200 },
  bob: { name: 'Bob', joinedAt: 300 },
};

const rules = readFileSync(join(import.meta.dirname, '..', '..', 'firestore.rules'), 'utf8');

describe('resolveHost', () => {
  it('is hostUid when the room names one, whoever has been here longest', () => {
    expect(resolveHost({ hostUid: 'bob', players })).toBe('bob');
  });

  it('is the derived quizmaster in a room made before W3 (AC11)', () => {
    expect(resolveHost({ hostUid: null, players })).toBe('host');
  });
});

describe('successorOnLeave (AC7)', () => {
  it('is the longest-seated of the people left', () => {
    expect(successorOnLeave(players, 'host')).toBe('ann');
  });

  it('is null when nobody is left', () => {
    expect(successorOnLeave({ host: players.host! }, 'host')).toBeNull();
  });
});

describe('planClaim (AC8, AC9)', () => {
  const base = { hostUid: 'host', players, now: 1_000_000, uid: 'ann' };

  it('never claims while the host is present, however long since anything', () => {
    const plan = planClaim({ ...base, present: new Set(['host', 'ann', 'bob']), absentSince: 0 });
    expect(plan).toEqual({ claim: false, absentSince: null });
  });

  it('starts the clock when the host goes missing, and waits it out', () => {
    const first = planClaim({ ...base, present: new Set(['ann', 'bob']), absentSince: null });
    expect(first).toEqual({ claim: false, absentSince: base.now });

    const early = planClaim({
      ...base,
      present: new Set(['ann', 'bob']),
      absentSince: base.now - CLAIM_AFTER_ABSENT_MS + 1,
    });
    expect(early.claim).toBe(false);
  });

  it('the longest-seated present player claims once the host has been missing long enough', () => {
    const absentSince = base.now - CLAIM_AFTER_ABSENT_MS;
    const present = new Set(['ann', 'bob']);
    expect(planClaim({ ...base, present, absentSince }).claim).toBe(true);
    expect(planClaim({ ...base, uid: 'bob', present, absentSince }).claim).toBe(false);
  });

  it('passes over a longer-seated player who is missing too', () => {
    const plan = planClaim({
      ...base,
      uid: 'bob',
      present: new Set(['bob']),
      absentSince: base.now - CLAIM_AFTER_ABSENT_MS,
    });
    expect(plan.claim).toBe(true);
  });

  it('reads an empty presence tree as presence broken, not a deserted room', () => {
    const plan = planClaim({ ...base, present: new Set(), absentSince: 0 });
    expect(plan).toEqual({ claim: false, absentSince: null });
  });

  it('never claims a room made before W3, or from itself', () => {
    const present = new Set(['ann']);
    expect(planClaim({ ...base, hostUid: null, present, absentSince: 0 }).claim).toBe(false);
    expect(planClaim({ ...base, uid: 'host', present, absentSince: 0 }).claim).toBe(false);
  });
});

describe('the heartbeat timing', () => {
  it('matches the claim threshold the rules enforce', () => {
    const match = /function beatSilentMs\(\) \{ return (\d+); \}/.exec(rules);
    expect(match?.[1]).toBe(String(CLAIM_AFTER_SILENT_MS));
  });

  it('leaves a throttled tab room: a beat a minute is still under the threshold', () => {
    // Chrome's intensive throttling runs a hidden tab's chained timers once a
    // minute (MDN setTimeout, last modified 3 Sep 2026).
    expect(CLAIM_AFTER_SILENT_MS - 60_000).toBeGreaterThanOrEqual(BEAT_EVERY_MS);
  });

  it('asks before the rules would allow it, so the claim lands close to the threshold', () => {
    expect(CLAIM_AFTER_ABSENT_MS + BEAT_EVERY_MS).toBeLessThanOrEqual(CLAIM_AFTER_SILENT_MS);
  });
});
