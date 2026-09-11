import { describe, expect, it, vi } from 'vitest';
import { TimeoutError, withTimeout } from './withTimeout';

describe('withTimeout', () => {
  it('passes a value through when the work finishes in time', async () => {
    await expect(withTimeout(Promise.resolve(3), 50, 'The reveal')).resolves.toBe(3);
  });

  it('passes a rejection through unchanged, so a refusal still reads as a refusal', async () => {
    const refused = Object.assign(new Error('denied'), { code: 'permission-denied' });
    await expect(withTimeout(Promise.reject(refused), 50, 'The reveal')).rejects.toBe(refused);
  });

  /**
   * The case the reveal was losing to. A Firestore write that cannot reach the
   * server neither resolves nor rejects — it queues — so before this the `catch`
   * in `App` never ran and the round sat on "Revealing…" indefinitely.
   */
  it('rejects with a TimeoutError when the work never settles', async () => {
    vi.useFakeTimers();
    try {
      const pending = new Promise<number>(() => {
        // Never settles, exactly like a queued write with no connection.
      });
      const raced = withTimeout(pending, 4_000, 'The reveal');
      const caught = raced.catch((cause: unknown) => cause);

      await vi.advanceTimersByTimeAsync(4_000);

      const cause = await caught;
      expect(cause).toBeInstanceOf(TimeoutError);
      expect((cause as Error).message).toContain('The reveal');
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears its timer once the work settles, so nothing fires afterwards', async () => {
    vi.useFakeTimers();
    try {
      const clear = vi.spyOn(globalThis, 'clearTimeout');
      await withTimeout(Promise.resolve('done'), 4_000, 'The reveal');
      expect(clear).toHaveBeenCalled();
      // Nothing left to run: an uncleared timer would still be pending here.
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
