import { describe, expect, it } from 'vitest';
import {
  REVEAL_GATE_SLACK_MS,
  msUntilRevealGate,
  revealBackoffMs,
  revealGateIsOpen,
} from './revealGate';

const DURATION_MS = 15_000;

describe('revealGateIsOpen', () => {
  it('refuses to ask before the server has acknowledged the question', () => {
    // The quizmaster's device spends one round trip in exactly this state, and
    // it is the state in which today's app asks and gets refused.
    expect(
      revealGateIsOpen({ confirmedAt: null, durationMs: DURATION_MS, now: 1_000_000 }),
    ).toBe(false);
  });

  it('is shut for the whole window after the confirmation', () => {
    const confirmedAt = 1_000_000;
    expect(revealGateIsOpen({ confirmedAt, durationMs: DURATION_MS, now: confirmedAt })).toBe(false);
    expect(
      revealGateIsOpen({ confirmedAt, durationMs: DURATION_MS, now: confirmedAt + DURATION_MS - 1 }),
    ).toBe(false);
  });

  it('opens a window plus the slack after the confirmation, and not before', () => {
    const confirmedAt = 1_000_000;
    const opens = confirmedAt + DURATION_MS + REVEAL_GATE_SLACK_MS;
    expect(revealGateIsOpen({ confirmedAt, durationMs: DURATION_MS, now: opens - 1 })).toBe(false);
    expect(revealGateIsOpen({ confirmedAt, durationMs: DURATION_MS, now: opens })).toBe(true);
  });

  it('is still shut at the moment the local countdown expires, when the two differ', () => {
    /*
      The whole bug, as an assertion. The pending local snapshot arrives first
      and the countdown starts from it; the server-confirmed one arrives a round
      trip later. Measured live on 20 August 2026: 6ms and 85ms after the write
      was issued. A reveal fired on the local anchor is asking 79ms before this
      helper would let it — and live, asking 100ms early was refused.
    */
    const localAt = 1_000_006;
    const confirmedAt = 1_000_085;
    const localExpiry = localAt + DURATION_MS;
    expect(revealGateIsOpen({ confirmedAt, durationMs: DURATION_MS, now: localExpiry })).toBe(false);
  });

  it('honours a window the room actually carries, not a fixed one', () => {
    const confirmedAt = 1_000_000;
    const now = confirmedAt + 5_000 + REVEAL_GATE_SLACK_MS;
    expect(revealGateIsOpen({ confirmedAt, durationMs: 5_000, now })).toBe(true);
    expect(revealGateIsOpen({ confirmedAt, durationMs: 20_000, now })).toBe(false);
  });

  it('needs no slack to be correct, because the ordering does the work', () => {
    // Stated as a test so nobody "fixes" a refused reveal by growing the slack:
    // at zero it is still open exactly one window after the confirmation.
    const confirmedAt = 1_000_000;
    const now = confirmedAt + DURATION_MS;
    expect(revealGateIsOpen({ confirmedAt, durationMs: DURATION_MS, now, slackMs: 0 })).toBe(true);
  });
});

describe('msUntilRevealGate', () => {
  it('has nothing to count from before the confirmation', () => {
    expect(msUntilRevealGate({ confirmedAt: null, durationMs: DURATION_MS, now: 1 })).toBeNull();
  });

  it('counts down to the moment the gate opens', () => {
    const confirmedAt = 1_000_000;
    expect(msUntilRevealGate({ confirmedAt, durationMs: DURATION_MS, now: confirmedAt })).toBe(
      DURATION_MS + REVEAL_GATE_SLACK_MS,
    );
  });

  it('never goes negative once the gate is open', () => {
    const confirmedAt = 1_000_000;
    const now = confirmedAt + DURATION_MS + REVEAL_GATE_SLACK_MS + 5_000;
    expect(msUntilRevealGate({ confirmedAt, durationMs: DURATION_MS, now })).toBe(0);
  });

  it('agrees with revealGateIsOpen at the boundary', () => {
    const confirmedAt = 1_000_000;
    const opens = confirmedAt + DURATION_MS + REVEAL_GATE_SLACK_MS;
    for (const now of [opens - 1, opens, opens + 1]) {
      const gate = { confirmedAt, durationMs: DURATION_MS, now };
      expect(msUntilRevealGate(gate) === 0).toBe(revealGateIsOpen(gate));
    }
  });
});

describe('revealBackoffMs', () => {
  it('retries quickly first, because a miss is one network hop and not a second', () => {
    expect(revealBackoffMs(0)).toBe(300);
    expect(revealBackoffMs(1)).toBe(600);
    expect(revealBackoffMs(2)).toBe(1_200);
  });

  it('settles on a steady wait rather than growing without limit', () => {
    expect(revealBackoffMs(3)).toBe(1_500);
    expect(revealBackoffMs(50)).toBe(1_500);
  });

  it('never asks for a negative wait', () => {
    expect(revealBackoffMs(-1)).toBe(300);
  });

  it('recovers faster than the flat 1500ms it replaces, over the first three tries', () => {
    const escalating = revealBackoffMs(0) + revealBackoffMs(1) + revealBackoffMs(2);
    expect(escalating).toBeLessThan(3 * 1_500);
  });
});
