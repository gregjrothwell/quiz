import { describe, expect, test, vi } from 'vitest';
import { RELOAD_GAP_MS, reloadForStaleChunk, type ReloadStore } from './staleChunk';

function memoryStore(): ReloadStore {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

describe('reloadForStaleChunk', () => {
  test('reloads the first time a chunk is missing', () => {
    const reload = vi.fn();
    expect(reloadForStaleChunk(() => memoryStore(), 1_000, reload)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  test('does not reload again straight after, so a chunk that is really gone cannot loop', () => {
    const store = memoryStore();
    const reload = vi.fn();
    reloadForStaleChunk(() => store, 1_000, reload);
    expect(reloadForStaleChunk(() => store, 1_000 + RELOAD_GAP_MS - 1, reload)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  test('reloads again for a later deploy', () => {
    const store = memoryStore();
    const reload = vi.fn();
    reloadForStaleChunk(() => store, 1_000, reload);
    expect(reloadForStaleChunk(() => store, 1_000 + RELOAD_GAP_MS, reload)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  test('treats an unreadable stamp as no earlier reload', () => {
    const store = memoryStore();
    store.setItem('vibequiz.chunkReloadAt', 'not a number');
    const reload = vi.fn();
    expect(reloadForStaleChunk(() => store, 1_000, reload)).toBe(true);
  });

  test('does not reload when storage is refused, since nothing could stop a loop', () => {
    const reload = vi.fn();
    const refusing = (): ReloadStore => {
      throw new Error('access denied');
    };
    expect(reloadForStaleChunk(refusing, 1_000, reload)).toBe(false);

    const unwritable: ReloadStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota exceeded');
      },
    };
    expect(reloadForStaleChunk(() => unwritable, 1_000, reload)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
