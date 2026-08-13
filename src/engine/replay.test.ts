import { describe, expect, test } from 'vitest';
import { REPLAY_SHAPE, arrivalsBy, replayDurationMs, replayTimeline } from './replay';
import type { Answer } from './state';

function answer(optionIndex: number, elapsedMs: number): Answer {
  return { optionIndex, elapsedMs };
}

describe('replayTimeline', () => {
  test('orders arrivals by how quickly they answered', () => {
    // #given three players who answered in a different order to their uids
    const answers = {
      priya: answer(2, 8_900),
      greg: answer(1, 1_200),
      sam: answer(1, 4_000),
    };

    // #when the timeline is built
    const order = replayTimeline(answers).map((arrival) => arrival.uid);

    // #then the fastest is first
    expect(order).toEqual(['greg', 'sam', 'priya']);
  });

  test('breaks ties on uid so every device replays the same order', () => {
    // #given two players whose answers landed on the same millisecond
    const answers = { sam: answer(0, 3_000), alex: answer(1, 3_000) };

    // #when the timeline is built
    const order = replayTimeline(answers).map((arrival) => arrival.uid);

    // #then the order is stable rather than left to object key order
    expect(order).toEqual(['alex', 'sam']);
  });

  test('opens on the lead-in, so the replay does not start mid-motion', () => {
    // #given any set of answers
    const answers = { greg: answer(0, 1_200), sam: answer(1, 9_000) };

    // #when the timeline is built
    const [first] = replayTimeline(answers);

    // #then the first arrival waits out the lead-in
    expect(first?.atMs).toBe(REPLAY_SHAPE.leadMs);
  });

  test('spends the whole window when the answers are far apart', () => {
    // #given a question where one player answered long after the others
    const answers = { greg: answer(0, 1_000), priya: answer(2, 9_000) };

    // #when the timeline is built
    const arrivals = replayTimeline(answers);

    // #then the straggler lands at the far end of the spread
    expect(arrivals[1]?.atMs).toBe(REPLAY_SHAPE.leadMs + REPLAY_SHAPE.spreadMs);
  });

  test('keeps a photo finish tight rather than stretching it', () => {
    // #given four players separated by 200ms in total
    const answers = {
      greg: answer(0, 3_000),
      sam: answer(0, 3_100),
      priya: answer(1, 3_150),
      alex: answer(0, 3_200),
    };

    // #when the timeline is built
    const arrivals = replayTimeline(answers);
    const window = (arrivals[3]?.atMs ?? 0) - (arrivals[0]?.atMs ?? 0);

    // #then they arrive within a fraction of the spread, because that is what
    // happened — stretching it would misrepresent a scoreline decided on those
    // 200ms
    expect(window).toBeCloseTo(
      (200 / REPLAY_SHAPE.fullSpreadFromMs) * REPLAY_SHAPE.spreadMs,
      5,
    );
    expect(window).toBeLessThan(REPLAY_SHAPE.spreadMs / 4);
  });

  test('lands everybody together when the times are identical', () => {
    // #given a room that all answered on the same millisecond
    const answers = { greg: answer(0, 2_000), sam: answer(1, 2_000) };

    // #when the timeline is built
    const times = replayTimeline(answers).map((arrival) => arrival.atMs);

    // #then nothing is spread out, and no division by a zero span occurs
    expect(times).toEqual([REPLAY_SHAPE.leadMs, REPLAY_SHAPE.leadMs]);
  });

  test('carries the pick and the real time through untouched', () => {
    // #given one answer
    const answers = { greg: answer(3, 4_321) };

    // #when the timeline is built
    const [arrival] = replayTimeline(answers);

    // #then the replay can label it without going back to the room
    expect(arrival).toMatchObject({ uid: 'greg', optionIndex: 3, elapsedMs: 4_321 });
  });

  test('returns nothing when nobody answered', () => {
    // #given a question the whole room sat out
    const answers = {};

    // #when the timeline is built
    const arrivals = replayTimeline(answers);

    // #then there is nothing to replay
    expect(arrivals).toEqual([]);
  });
});

describe('replayDurationMs', () => {
  test('holds the reveal until the last arrival plus a tail', () => {
    // #given a timeline ending at the far end of the spread
    const arrivals = replayTimeline({ greg: answer(0, 1_000), priya: answer(2, 9_000) });

    // #when the hold is calculated
    const held = replayDurationMs(arrivals, 700);

    // #then it covers the whole replay and the beat after it
    expect(held).toBe(REPLAY_SHAPE.leadMs + REPLAY_SHAPE.spreadMs + REPLAY_SHAPE.tailMs);
  });

  test('falls back to the plain hush when nobody answered', () => {
    // #given no arrivals
    const arrivals: ReturnType<typeof replayTimeline> = [];

    // #when the hold is calculated
    const held = replayDurationMs(arrivals, 700);

    // #then the reveal keeps its original pause rather than a longer one that
    // would read as the app having stalled
    expect(held).toBe(700);
  });

  test('ends sooner for a tight race, because there is nothing to watch', () => {
    // #given a photo finish
    const tight = replayTimeline({ greg: answer(0, 3_000), sam: answer(1, 3_050) });

    // #when its hold is compared against a drawn-out one
    const spread = replayTimeline({ greg: answer(0, 1_000), sam: answer(1, 9_000) });

    // #then the tight race gets out of the way
    expect(replayDurationMs(tight, 700)).toBeLessThan(replayDurationMs(spread, 700));
  });
});

describe('arrivalsBy', () => {
  test('reveals arrivals as their moment passes', () => {
    // #given a timeline spread across the window
    const arrivals = replayTimeline({ greg: answer(0, 1_000), priya: answer(2, 9_000) });

    // #when the replay is part way through
    const landed = arrivalsBy(arrivals, REPLAY_SHAPE.leadMs);

    // #then only the first has landed
    expect(landed.map((arrival) => arrival.uid)).toEqual(['greg']);
  });

  test('has everybody landed once the replay has run', () => {
    // #given the same timeline
    const arrivals = replayTimeline({ greg: answer(0, 1_000), priya: answer(2, 9_000) });

    // #when the replay reaches its end
    const landed = arrivalsBy(arrivals, REPLAY_SHAPE.leadMs + REPLAY_SHAPE.spreadMs);

    // #then nobody is left out
    expect(landed).toHaveLength(2);
  });
});
