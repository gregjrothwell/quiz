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
  test('the quizmaster\'s line says where Start the show spent its time', () => {
    const line = formatTrace(
      { ...trace, dealMs: 1_200, packMs: 800, askedMs: 300, formMs: 400, dealWriteMs: 90 },
      'Greg',
      'x',
    );

    expect(line).toContain('start: deal 1.2s (pack 0.8s, history 0.3s), rows 0.4s, write 0.1s');
    expect(line).toMatch(/→ slow write$/);
  });

  test('says how long ago the write path was warmed, and when it never was', () => {
    expect(formatTrace({ ...trace, warmAgoMs: 30_000 }, 'Cass', 'x')).toContain('warmed 30.0s before');
    expect(formatTrace(trace, 'Cass', 'x')).not.toContain('warmed');
    expect(formatTrace(trace, 'Cass', 'x')).not.toContain('start:');
  });

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
