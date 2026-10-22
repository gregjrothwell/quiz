import { describe, expect, test } from 'vitest';
import {
  RIG_CUES,
  RIG_EVERY_MS,
  cueIsOn,
  cueTimes,
  reportRig,
  rigRunFrom,
} from './rigProbe';

const START = 1_000_000;
const TIMES = cueTimes(START);

/** Every cue painted by each device at `cue time + offset`. */
function paintedAt(offsets: Record<string, number>): Record<number, Record<string, number>> {
  return Object.fromEntries(
    TIMES.map((at, cue) => [cue, Object.fromEntries(Object.entries(offsets).map(([uid, offset]) => [uid, at + offset]))]),
  );
}

describe('cueTimes', () => {
  test('ten cues two seconds apart from the start', () => {
    expect(TIMES).toHaveLength(RIG_CUES);
    expect(TIMES[1]! - TIMES[0]!).toBe(RIG_EVERY_MS);
    expect(TIMES[0]).toBe(START);
  });

  test('alternate on and off, so every cue is a change', () => {
    expect([0, 1, 2, 3].map(cueIsOn)).toEqual([true, false, true, false]);
  });
});

describe('reportRig', () => {
  test('a tight room passes: everyone within 50 ms of the median', () => {
    const report = reportRig(paintedAt({ a: 10, b: 30, c: 45, d: 20 }), TIMES);
    expect(report.pass).toBe(true);
    expect(report.cuesPassed).toBe(10);
    expect(report.cues[0]).toMatchObject({ devices: 4, spreadMs: 35, withinShare: 1 });
    expect(report.cues[0]!.lateMs).toBe(25);
  });

  test('one phone 300 ms behind in a room of four fails the 90% line', () => {
    const report = reportRig(paintedAt({ a: 10, b: 20, c: 30, slow: 300 }), TIMES);
    expect(report.cues[0]!.withinShare).toBe(0.75);
    expect(report.pass).toBe(false);
  });

  test('one straggler in a room of ten still passes', () => {
    const offsets = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`p${String(i)}`, 10 + i]));
    const report = reportRig(paintedAt({ ...offsets, slow: 400 }), TIMES);
    expect(report.cues[0]!.withinShare).toBe(0.9);
    expect(report.pass).toBe(true);
  });

  test('passes on nine cues of ten, not on eight', () => {
    const tight = paintedAt({ a: 0, b: 10, c: 20 });
    const loose = { a: 0, b: 400, c: 800 };
    const nine = { ...tight, 9: Object.fromEntries(Object.entries(loose).map(([u, o]) => [u, TIMES[9]! + o])) };
    expect(reportRig(nine, TIMES).pass).toBe(true);
    const eight = { ...nine, 8: Object.fromEntries(Object.entries(loose).map(([u, o]) => [u, TIMES[8]! + o])) };
    expect(reportRig(eight, TIMES).pass).toBe(false);
  });

  test('one device proves nothing: a cue it alone painted fails', () => {
    const report = reportRig(paintedAt({ only: 5 }), TIMES);
    expect(report.cuesPassed).toBe(0);
    expect(report.pass).toBe(false);
  });

  test('a cue nobody painted is empty, not perfect', () => {
    expect(reportRig({}, TIMES).cues[3]).toEqual({ cue: 3, devices: 0, spreadMs: 0, lateMs: 0, withinShare: 0 });
  });
});

describe('rigRunFrom', () => {
  test('reads a run and refuses anything else', () => {
    expect(rigRunFrom({ id: 'r1', startAt: 5, by: 'u' })).toEqual({ id: 'r1', startAt: 5, by: 'u' });
    expect(rigRunFrom({ id: 'r1', startAt: '5', by: 'u' })).toBeNull();
    expect(rigRunFrom(null)).toBeNull();
  });
});
