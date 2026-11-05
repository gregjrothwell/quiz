import { describe, expect, test } from 'vitest';
import { WARM_EVERY_MS, warmDelayMs } from './keepWarm';

describe('warmDelayMs', () => {
  test('never warmed on this page: due now, so a second round in the same tab starts warm', () => {
    expect(warmDelayMs({ lastSentAt: null, now: 1_000_000 })).toBe(0);
  });

  test('sent 10s ago: due when the interval is up', () => {
    expect(warmDelayMs({ lastSentAt: 1_000_000, now: 1_010_000 })).toBe(WARM_EVERY_MS - 10_000);
  });

  test('overdue, as a tab coming back from hidden is: due now, not negative', () => {
    expect(warmDelayMs({ lastSentAt: 1_000_000, now: 1_500_000 })).toBe(0);
  });

  test('a clock moved backwards never waits longer than one interval', () => {
    expect(warmDelayMs({ lastSentAt: 1_000_000, now: 900_000 })).toBe(WARM_EVERY_MS);
  });

  test('the interval beats the 60s after which the SDK closes an idle write stream', () => {
    expect(WARM_EVERY_MS).toBeLessThan(60_000);
  });
});
