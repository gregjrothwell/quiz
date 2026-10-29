import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useQuestionClock } from './useQuestionClock';

/*
  PROJ-78: one answer in 6,704 was stamped 0ms (room Y86U). The face ticks
  every 100ms and an answer took the last tick's reading, so a press before the
  first tick read 0, and every answer read up to 100ms fast. `elapsedNow` is
  read at the press.
*/
describe('useQuestionClock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test('a press before the first tick is timed, not zero', () => {
    const { result } = renderHook(() => useQuestionClock(true, 0, 10_000, 1_000_000));
    act(() => {
      vi.setSystemTime(1_000_040);
    });
    expect(result.current.elapsedMs).toBe(0);
    expect(result.current.elapsedNow()).toBe(40);
  });

  test('a press between ticks is timed at the press', () => {
    const { result } = renderHook(() => useQuestionClock(true, 0, 10_000, 1_000_000));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    act(() => {
      vi.setSystemTime(1_000_370);
    });
    expect(result.current.elapsedMs).toBe(300);
    expect(result.current.elapsedNow()).toBe(370);
  });

  test('counts from the room origin, not from when this device saw it', () => {
    const { result } = renderHook(() => useQuestionClock(true, 0, 10_000, 999_800));
    expect(result.current.elapsedNow()).toBe(200);
  });

  test('never past the window, and nothing while closed', () => {
    const open = renderHook(() => useQuestionClock(true, 0, 10_000, 1_000_000));
    act(() => {
      vi.setSystemTime(1_010_050);
    });
    expect(open.result.current.elapsedNow()).toBe(10_000);

    const closed = renderHook(() => useQuestionClock(false, 0, 10_000, 1_000_000));
    expect(closed.result.current.elapsedNow()).toBe(0);
  });

  test('a new question does not inherit the last one', () => {
    const { result, rerender } = renderHook(
      ({ index, origin }: { index: number; origin: number }) => useQuestionClock(true, index, 10_000, origin),
      { initialProps: { index: 0, origin: 1_000_000 } },
    );
    act(() => {
      vi.setSystemTime(1_005_000);
    });
    rerender({ index: 1, origin: 1_005_000 });
    act(() => {
      vi.setSystemTime(1_005_030);
    });
    expect(result.current.elapsedNow()).toBe(30);
  });
});
