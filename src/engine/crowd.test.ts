import { describe, expect, it } from 'vitest';
import { CROWD_LIMIT, visibleCrowd } from './crowd';

interface Pick {
  uid: string;
  isYou: boolean;
  snap: boolean;
}

function picks(count: number, overrides: Partial<Record<number, Partial<Pick>>> = {}): Pick[] {
  return Array.from({ length: count }, (_, index) => ({
    uid: `p${index}`,
    isYou: false,
    snap: false,
    ...overrides[index],
  }));
}

describe('visibleCrowd', () => {
  it('shows everybody up to the limit, so every room played so far looks as it did', () => {
    const all = picks(CROWD_LIMIT);
    expect(visibleCrowd(all)).toEqual({ shown: all, hidden: 0 });
  });

  it('keeps the first arrivals and counts the rest once a lectern is crowded', () => {
    const all = picks(26);
    const { shown, hidden } = visibleCrowd(all);
    expect(shown.map((pick) => pick.uid)).toEqual(all.slice(0, CROWD_LIMIT - 1).map((pick) => pick.uid));
    expect(hidden).toBe(26 - (CROWD_LIMIT - 1));
  });

  it('never hides your own chip, however late you landed', () => {
    const { shown, hidden } = visibleCrowd(picks(26, { 20: { isYou: true } }));
    expect(shown.map((pick) => pick.uid)).toContain('p20');
    expect(shown[shown.length - 1]?.uid).toBe('p20');
    expect(hidden).toBe(26 - CROWD_LIMIT);
  });

  it('never hides a snap guess, because the marker is a deterrent only if it is seen', () => {
    const { shown, hidden } = visibleCrowd(picks(26, { 24: { snap: true } }));
    expect(shown.map((pick) => pick.uid)).toContain('p24');
    expect(hidden).toBe(26 - CROWD_LIMIT);
  });

  it('keeps arrival order among the chips it shows', () => {
    const { shown } = visibleCrowd(picks(30, { 25: { snap: true }, 18: { isYou: true } }));
    const order = shown.map((pick) => Number(pick.uid.slice(1)));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('shows nobody on an empty lectern', () => {
    expect(visibleCrowd(picks(0))).toEqual({ shown: [], hidden: 0 });
  });
});
