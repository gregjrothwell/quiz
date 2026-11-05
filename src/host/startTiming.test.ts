import { describe, expect, test } from 'vitest';
import type { PackPorts } from './ports';
import { createStartTimer } from './startTiming';

/** Ports whose calls take as long as the test says, on a hand-driven clock. */
function harness(takes: { pack?: Record<string, number>; asked?: Record<string, number>; askedFails?: boolean }) {
  let clock = 1_000_000;
  const ports: PackPorts = {
    loadPack: (packId) => {
      clock += takes.pack?.[packId] ?? 0;
      return Promise.resolve([]);
    },
    loadAsked: (packId) => {
      clock += takes.asked?.[packId] ?? 0;
      return takes.askedFails ? Promise.reject(new Error('offline')) : Promise.resolve({ known: false } as never);
    },
    recordAsked: () => Promise.resolve(),
  };
  return {
    timer: createStartTimer(() => clock, ports),
    pass: (ms: number) => {
      clock += ms;
    },
  };
}

describe('createStartTimer', () => {
  test('one pack: each step of Start the show to the room write', async () => {
    // #given a press, then a pack fetch, a history read, the season rows, and the write
    const { timer, pass } = harness({ pack: { music: 400 }, asked: { music: 150 } });

    // #when each step runs
    await timer.ports.loadPack('music');
    await timer.ports.loadAsked('music');
    timer.dealt();
    pass(300);
    timer.formRead();
    pass(50);
    timer.written();

    // #then the trace can say which of them took the time
    expect(timer.timing()).toEqual({ dealMs: 550, packMs: 400, askedMs: 150, formMs: 300, dealWriteMs: 50 });
  });

  test('a Random Round: the slowest of each, because they run side by side', async () => {
    const { timer } = harness({ pack: { screens: 200, tunes: 900 }, asked: { screens: 500, tunes: 100 } });

    await timer.ports.loadPack('screens');
    await timer.ports.loadPack('tunes');
    await timer.ports.loadAsked('screens');
    await timer.ports.loadAsked('tunes');

    expect(timer.timing()).toMatchObject({ packMs: 900, askedMs: 500 });
  });

  test('a history read that fails still reports its time and still rejects, as the deal expects', async () => {
    const { timer } = harness({ asked: { music: 2_000 }, askedFails: true });

    await expect(timer.ports.loadAsked('music')).rejects.toThrow('offline');

    expect(timer.timing().askedMs).toBe(2_000);
  });

  test('a step that never ran is absent rather than zero', () => {
    const { timer } = harness({});

    expect(timer.timing()).toEqual({});
  });

  test('what it wraps is otherwise left alone', async () => {
    const { timer } = harness({});

    await expect(timer.ports.loadPack('music')).resolves.toEqual([]);
    expect(timer.ports.recordAsked).toBeTypeOf('function');
  });
});
