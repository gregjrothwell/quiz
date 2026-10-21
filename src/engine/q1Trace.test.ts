import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import {
  TRACE_KEYS,
  createQ1Tracer,
  deviceFrom,
  explainTrace,
  parseTrace,
  type Q1TraceDoc,
  type SeenQuestion,
} from './q1Trace';

/** A tracer with a hand-driven clock and the writes it made. */
function harness() {
  let clock = 1_000_000;
  const written: Q1TraceDoc[] = [];
  const tracer = createQ1Tracer({ now: () => clock, write: (trace) => written.push(trace) });
  return {
    tracer,
    written,
    at: (ms: number) => {
      clock = ms;
    },
  };
}

function seen(overrides: Partial<SeenQuestion> = {}): SeenQuestion {
  return {
    gameId: 'game-1',
    roomCode: 'ABCD',
    uid: 'cass',
    index: 0,
    durationMs: 10_000,
    openedAtMs: 999_500,
    arrivedAt: 1_000_000,
    serverOffsetMs: 200,
    priorDeltas: {},
    visibleSince: 940_000,
    device: 'ios',
    network: '4g',
    ...overrides,
  };
}

const REVEAL = { gameId: 'game-1', phase: 'reveal', index: 0 } as const;

describe('createQ1Tracer', () => {
  test('a counted answer: one trace, written once the reveal is seen and the write has settled', () => {
    // #given a device that sees question one, taps, and is acknowledged
    const { tracer, written, at } = harness();
    tracer.sawQuestion(seen());
    at(1_004_000);
    const token = tracer.tapped({ gameId: 'game-1', index: 0, elapsedMs: 4_000 });
    at(1_004_300);
    if (token === null) throw new Error('question one should be traced');
    tracer.settled(token);

    // #when the reveal arrives with this player scored
    at(1_010_400);
    tracer.sawRoom({ ...REVEAL, scoredUids: ['cass', 'steve'] });

    // #then exactly what the device saw, relative to its own arrival
    expect(written).toEqual([
      {
        gameId: 'game-1',
        roomCode: 'ABCD',
        uid: 'cass',
        durationMs: 10_000,
        correctionMs: 0,
        priorSamples: 0,
        writes: 1,
        device: 'ios',
        network: '4g',
        seenAfterOpenMs: 500,
        serverOffsetMs: 200,
        visibleForMs: 60_000,
        tapMs: 4_000,
        tapElapsedMs: 4_000,
        ackMs: 300,
        revealMs: 10_400,
        counted: true,
      },
    ]);
  });

  test('the case this exists for: answered, not counted, and the write still in flight at the reveal', () => {
    // #given a tap at 7s whose write has not been acknowledged by the reveal
    const { tracer, written, at } = harness();
    tracer.sawQuestion(seen());
    at(1_007_000);
    const token = tracer.tapped({ gameId: 'game-1', index: 0, elapsedMs: 7_000 });
    at(1_010_400);
    tracer.sawRoom({ ...REVEAL, scoredUids: ['steve'] });

    // #then nothing is written yet — the ack is half the answer
    expect(written).toEqual([]);

    // #when the write lands, late
    at(1_011_900);
    if (token === null) throw new Error('question one should be traced');
    tracer.settled(token);

    // #then the trace says so
    expect(written).toHaveLength(1);
    expect(written[0]).toMatchObject({ ackMs: 4_900, counted: false, revealMs: 10_400, writes: 1 });
  });

  test('a refused write carries its code', () => {
    const { tracer, written, at } = harness();
    tracer.sawQuestion(seen());
    const token = tracer.tapped({ gameId: 'game-1', index: 0, elapsedMs: 3_000 });
    at(1_000_200);
    if (token === null) throw new Error('question one should be traced');
    tracer.settled(token, 'permission-denied');
    tracer.sawRoom({ ...REVEAL, scoredUids: [] });

    expect(written[0]).toMatchObject({ refused: 'permission-denied', ackMs: 200, counted: false });
  });

  test('no tap at all is still a trace — the silent player is half the evidence', () => {
    const { tracer, written } = harness();
    tracer.sawQuestion(seen());
    tracer.sawRoom({ ...REVEAL, scoredUids: ['steve'] });

    expect(written).toHaveLength(1);
    expect(written[0]).toMatchObject({ writes: 0, counted: false });
    expect(written[0]).not.toHaveProperty('tapMs');
    expect(written[0]).not.toHaveProperty('ackMs');
  });

  test('a tap the client dropped says why', () => {
    const { tracer, written } = harness();
    tracer.sawQuestion(seen());
    tracer.dropped({ gameId: 'game-1', index: 0, reason: 'window' });
    tracer.sawRoom({ ...REVEAL, scoredUids: [] });

    expect(written[0]).toMatchObject({ dropped: 'window', writes: 0 });
  });

  test('a change of mind: the last write is the one timed, an earlier ack is ignored', () => {
    const { tracer, written, at } = harness();
    tracer.sawQuestion(seen());
    at(1_002_000);
    const first = tracer.tapped({ gameId: 'game-1', index: 0, elapsedMs: 2_000 });
    at(1_005_000);
    const second = tracer.tapped({ gameId: 'game-1', index: 0, elapsedMs: 5_000 });
    at(1_005_100);
    if (first === null || second === null) throw new Error('question one should be traced');
    tracer.settled(first);
    tracer.sawRoom({ ...REVEAL, scoredUids: ['cass'] });

    // #then still waiting on the second
    expect(written).toEqual([]);

    at(1_005_400);
    tracer.settled(second);
    expect(written[0]).toMatchObject({ writes: 2, tapMs: 5_000, tapElapsedMs: 5_000, ackMs: 400 });
  });

  test('a write that never settles is written anyway once the room moves past question one', () => {
    const { tracer, written, at } = harness();
    tracer.sawQuestion(seen());
    tracer.tapped({ gameId: 'game-1', index: 0, elapsedMs: 6_000 });
    at(1_010_400);
    tracer.sawRoom({ ...REVEAL, scoredUids: [] });
    expect(written).toEqual([]);

    // #when question two opens
    at(1_016_000);
    tracer.sawRoom({ gameId: 'game-1', phase: 'question', index: 1, scoredUids: [] });

    // #then the trace goes without an ack
    expect(written).toHaveLength(1);
    expect(written[0]).toMatchObject({ writes: 1, revealMs: 10_400, counted: false });
    expect(written[0]).not.toHaveProperty('ackMs');
  });

  test('a device that never saw the reveal is written when question two arrives, with no verdict', () => {
    const { tracer, written, at } = harness();
    tracer.sawQuestion(seen());
    at(1_016_000);
    tracer.sawRoom({ gameId: 'game-1', phase: 'question', index: 1, scoredUids: [] });

    expect(written).toHaveLength(1);
    expect(written[0]).toMatchObject({ revealMs: 16_000 });
    expect(written[0]).not.toHaveProperty('counted');
  });

  test('later questions are never traced, and question one only once per round', () => {
    const { tracer, written } = harness();
    tracer.sawQuestion(seen({ index: 3 }));
    expect(tracer.tapped({ gameId: 'game-1', index: 3, elapsedMs: 1_000 })).toBeNull();

    tracer.sawQuestion(seen());
    tracer.sawRoom({ ...REVEAL, scoredUids: [] });
    // #when the same round's question one is seen again (a snapshot replayed)
    tracer.sawQuestion(seen());
    tracer.sawRoom({ ...REVEAL, scoredUids: [] });

    expect(written).toHaveLength(1);
  });

  test('another round in the same room is traced afresh', () => {
    const { tracer, written } = harness();
    tracer.sawQuestion(seen());
    tracer.sawRoom({ ...REVEAL, scoredUids: [] });
    tracer.sawQuestion(seen({ gameId: 'game-2' }));
    tracer.sawRoom({ gameId: 'game-2', phase: 'reveal', index: 0, scoredUids: [] });

    expect(written.map((trace) => trace.gameId)).toEqual(['game-1', 'game-2']);
  });

  test('a round with no game id is not traced: there is nothing to key it by', () => {
    const { tracer, written } = harness();
    tracer.sawQuestion(seen({ gameId: null }));
    tracer.sawRoom({ gameId: null, phase: 'reveal', index: 0, scoredUids: [] });
    expect(written).toEqual([]);
  });

  test('leaving mid-question writes what is known', () => {
    const { tracer, written } = harness();
    tracer.sawQuestion(seen());
    tracer.leave();
    expect(written).toHaveLength(1);
    expect(written[0]).not.toHaveProperty('revealMs');
  });

  test('the clock correction and the samples it had are the ones useRoom would use', () => {
    // #given a tab that held two readings from an earlier round, the best 300ms
    const { tracer, written } = harness();
    tracer.sawQuestion(
      seen({
        priorDeltas: { 'game-0:0': 900, 'game-0:1': 300 },
        openedAtMs: 995_000,
        arrivedAt: 1_000_000,
      }),
    );
    tracer.sawRoom({ ...REVEAL, scoredUids: [] });

    // #then the origin is openedAt + 300, so the clock was put back 4,700ms
    expect(written[0]).toMatchObject({ priorSamples: 2, correctionMs: 4_700, seenAfterOpenMs: 5_000 });
  });

  test('a hidden page has no visible time, and readings are clamped to what the rules accept', () => {
    const { tracer, written } = harness();
    tracer.sawQuestion(seen({ visibleSince: null, serverOffsetMs: 9e12, network: 'x'.repeat(40) }));
    tracer.sawRoom({ ...REVEAL, scoredUids: [] });

    expect(written[0]).not.toHaveProperty('visibleForMs');
    expect(written[0]?.serverOffsetMs).toBe(86_400_000);
    expect(written[0]?.network).toHaveLength(16);
  });
});

describe('deviceFrom', () => {
  test.each([
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15', 'ios'],
    ['Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/129.0', 'android'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15', 'mac'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/129.0', 'windows'],
    ['Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/129.0', 'linux'],
    ['curl/8.7.1', 'other'],
  ])('%s → %s', (userAgent, device) => {
    expect(deviceFrom(userAgent)).toBe(device);
  });
});

describe('explainTrace', () => {
  const base: Q1TraceDoc = {
    gameId: 'g',
    roomCode: 'ABCD',
    uid: 'u',
    durationMs: 10_000,
    correctionMs: 0,
    priorSamples: 0,
    writes: 1,
    device: 'ios',
  };

  test('late delivery: the device saw the question seconds after the server opened it', () => {
    expect(explainTrace({ ...base, seenAfterOpenMs: 4_500, serverOffsetMs: 200, ackMs: 150 })).toEqual({
      seenLagMs: 4_700,
      reading: 'late delivery',
    });
  });

  test('slow write: on time, but the answer took seconds to be acknowledged', () => {
    expect(explainTrace({ ...base, seenAfterOpenMs: 100, serverOffsetMs: 50, ackMs: 4_700 }).reading).toBe(
      'slow write',
    );
  });

  test('a write that never settled counts as slow', () => {
    expect(explainTrace({ ...base, seenAfterOpenMs: 100, serverOffsetMs: 50 }).reading).toBe('slow write');
  });

  test('both, neither, and unknown without an offset or a write', () => {
    expect(explainTrace({ ...base, seenAfterOpenMs: 3_000, serverOffsetMs: 0, ackMs: 3_000 }).reading).toBe('both');
    expect(explainTrace({ ...base, seenAfterOpenMs: 100, serverOffsetMs: 0, ackMs: 100 }).reading).toBe('neither');
    expect(explainTrace({ ...base, writes: 0 }).reading).toBe('unknown');
  });
});

describe('parseTrace', () => {
  test('reads back what the tracer writes, and refuses anything else', () => {
    const { tracer, written } = harness();
    tracer.sawQuestion(seen());
    tracer.sawRoom({ ...REVEAL, scoredUids: ['cass'] });
    const trace = written[0];

    expect(parseTrace({ ...trace, at: { seconds: 1 } })).toEqual(trace);
    expect(parseTrace({ ...trace, device: 'toaster' })).toBeNull();
    expect(parseTrace({ ...trace, writes: '1' })).toBeNull();
    expect(parseTrace(null)).toBeNull();
  });
});

describe('the rules and the trace agree', () => {
  // Offline, so drift fails in the run that caused it — the same reason the
  // duration tests in state.test.ts read the rules file.
  test('firestore.rules allows exactly the trace keys, plus the server stamp', () => {
    const rules = readFileSync('firestore.rules', 'utf8');
    const block = rules.slice(rules.indexOf('match /q1Traces/{traceId}'));
    const listed = /hasOnly\(\[([^\]]+)\]\)/.exec(block)?.[1] ?? '';
    const keys = listed.split(',').map((key) => key.trim().replace(/'/g, ''));

    expect(keys.sort()).toEqual([...TRACE_KEYS, 'at'].sort());
  });
});
