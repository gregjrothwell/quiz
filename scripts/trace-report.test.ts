import { describe, expect, test } from 'vitest';
import { formatTrace } from './trace-report';
import type { Q1TraceDoc } from '../src/engine/q1Trace';

/** Answered at 7s and never acknowledged. */
const unacked: Q1TraceDoc = {
  gameId: 'g',
  roomCode: '79YX',
  uid: 'u',
  durationMs: 10_000,
  correctionMs: 0,
  priorSamples: 0,
  writes: 1,
  device: 'ios',
  seenAfterOpenMs: 300,
  serverOffsetMs: 100,
  tapElapsedMs: 7_000,
  revealMs: 10_400,
  counted: false,
};

const trace: Q1TraceDoc = { ...unacked, ackMs: 4_700 };

describe('formatTrace', () => {
  test('the line Cass would leave on a lost question one: on time, slow write, not counted', () => {
    const line = formatTrace(trace, 'Cass', '2026-10-22 08:52');

    expect(line).toContain('Cass');
    expect(line).toContain('seen late  0.4s');
    expect(line).toContain('write  4.7s');
    expect(line).toContain('tap  7.0s of 10s');
    expect(line).toContain('fresh tab');
    expect(line).toContain('NOT COUNTED');
    expect(line).toMatch(/→ slow write$/);
  });

  test('says which outcome when there is no answer to time', () => {
    expect(formatTrace({ ...unacked, writes: 0 }, 'Host', 'x')).toContain('no tap');
    expect(formatTrace({ ...trace, refused: 'permission-denied' }, 'Cass', 'x')).toContain(
      'refused permission-denied',
    );
    expect(formatTrace(unacked, 'Cass', 'x')).toContain('never acked');
  });
});
