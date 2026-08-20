import { describe, expect, test } from 'vitest';
import {
  MAX_CORRECTION_MS,
  estimateSkew,
  questionOriginMs,
  rememberDelta,
} from './roomClock';

describe('rememberDelta', () => {
  test('keeps one reading per question', () => {
    // #given readings from three questions
    let held = rememberDelta({}, 'g:0', 120);
    held = rememberDelta(held, 'g:1', 80);
    held = rememberDelta(held, 'g:2', 400);

    // #then each is held under its own key
    expect(held).toEqual({ 'g:0': 120, 'g:1': 80, 'g:2': 400 });
  });

  test('keeps the first reading for a question, not the latest', () => {
    // #given a question that updates again after it opened
    const held = rememberDelta(rememberDelta({}, 'g:0', 90), 'g:0', 5_000);

    // #then the first stands. A later update to the same question says nothing
    // about how long that question took to arrive.
    expect(held).toEqual({ 'g:0': 90 });
  });
});

describe('estimateSkew', () => {
  test('takes the smallest reading of the round', () => {
    // #given three readings, each of which is skew plus some latency
    const held = { 'g:0': 300, 'g:1': 95, 'g:2': 180 };

    // #when the skew is estimated
    const skew = estimateSkew(held);

    // #then the least-delayed one is the closest to pure skew, because latency
    // is never negative
    expect(skew).toBe(95);
  });

  test('estimates from a single reading, which is question one', () => {
    // #given the only reading of the round so far
    // #then it estimates itself: skew plus that question's latency, which is the
    // origin the device already had. Question one is uncorrected, by arithmetic
    // rather than by a special case.
    expect(estimateSkew({ 'g:0': 240 })).toBe(240);
  });

  test('a worse reading never worsens the estimate', () => {
    // #given a good reading followed by a badly delayed one
    const before = estimateSkew({ 'g:0': 95 });
    const after = estimateSkew({ 'g:0': 95, 'g:1': 4_000 });

    // #then the estimate only ever sharpens
    expect({ before, after }).toEqual({ before: 95, after: 95 });
  });

  test('no readings yields no estimate', () => {
    // #then the caller is told it cannot correct, rather than handed a zero it
    // would treat as a measurement
    expect(estimateSkew({})).toBeNull();
  });

  test('handles a device whose clock is behind the server', () => {
    // #given negative readings, which mean the local clock runs behind
    // #then the estimate is negative too and nothing clamps it to zero
    expect(estimateSkew({ 'g:0': -1_400, 'g:1': -1_250 })).toBe(-1_400);
  });
});

describe('questionOriginMs', () => {
  test('translates the server stamp onto this clock', () => {
    // #given a question the server opened at 1000, on a device 250ms ahead
    const origin = questionOriginMs({ openedAtMs: 1_000, skewMs: 250, arrivedAt: 1_400 });

    // #then the question opened at 1250 by this device's reckoning
    expect(origin).toBe(1_250);
  });

  test('is never later than the snapshot actually arrived', () => {
    // #given an estimate that would put the question's opening *after* the
    // moment this device heard about it — impossible, and the shape of every
    // way this arithmetic can go wrong
    const origin = questionOriginMs({ openedAtMs: 1_000, skewMs: 900, arrivedAt: 1_400 });

    // #then it is pinned to the arrival, which is today's behaviour. The
    // correction may only ever take time away from a device, never give it
    // more than it already had.
    expect(origin).toBe(1_400);
  });

  test('ignores a correction too large to be a clock offset', () => {
    // #given a reading that would drag the origin most of a minute earlier,
    // which is a clock that jumped rather than a network that was slow
    const origin = questionOriginMs({
      openedAtMs: 1_000,
      skewMs: -MAX_CORRECTION_MS - 1,
      arrivedAt: 1_400,
    });

    // #then the device keeps its own arrival rather than trusting it
    expect(origin).toBe(1_400);
  });

  test('accepts a correction just inside the bound', () => {
    const origin = questionOriginMs({
      openedAtMs: 1_000,
      skewMs: -MAX_CORRECTION_MS,
      arrivedAt: 1_400,
    });

    expect(origin).toBe(1_000 - MAX_CORRECTION_MS);
  });

  test('has no origin without a server stamp', () => {
    // #given a room whose `openedAt` has not landed, or a device that has never
    // measured itself
    // #then there is nothing to correct with, and the caller keeps its own
    expect([
      questionOriginMs({ openedAtMs: null, skewMs: 100, arrivedAt: 1_400 }),
      questionOriginMs({ openedAtMs: 1_000, skewMs: null, arrivedAt: 1_400 }),
      questionOriginMs({ openedAtMs: 1_000, skewMs: 100, arrivedAt: null }),
    ]).toEqual([null, null, null]);
  });
});

describe('what this is worth on a real reading', () => {
  test('the player who lost a question gets the room’s clock back', () => {
    // #given the 17 August round: the host's snapshot at +6ms and this player's
    // five seconds later, on a device whose clock happens to match the server
    const held = rememberDelta(rememberDelta({}, 'g:0', 5_000), 'g:1', 85);
    const skew = estimateSkew(held);

    // #when a question opens at 1000 and reaches this device at 6000
    const origin = questionOriginMs({ openedAtMs: 1_000, skewMs: skew, arrivedAt: 6_000 });

    // #then it counts from 1085 rather than from 6000 — so a ten-second window
    // has about five seconds left on this screen, which is what the room has,
    // instead of ten seconds that end in the lecterns going dead.
    expect(origin).toBe(1_085);
  });
});
