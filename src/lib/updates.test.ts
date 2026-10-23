import { describe, expect, it } from 'vitest';
import { hasUnseen, updatesNotice, UPDATES, type Update } from './updates';

const two: Update[] = [
  { date: '2026-10-22', lines: ['b'] },
  { date: '2026-10-21', lines: ['a'] },
];

describe('hasUnseen', () => {
  it('is true for a browser that has never opened the page', () => {
    expect(hasUnseen(two, null)).toBe(true);
  });

  it('is true when a newer entry has gone out since', () => {
    expect(hasUnseen(two, '2026-10-21')).toBe(true);
  });

  it('is false once the newest entry has been seen', () => {
    expect(hasUnseen(two, '2026-10-22')).toBe(false);
  });

  it('is false with nothing to show', () => {
    expect(hasUnseen([], null)).toBe(false);
  });
});

describe('updatesNotice', () => {
  it('leads with the newest line until that entry has been opened', () => {
    expect(updatesNotice(two, null)).toEqual({ unseen: true, teaser: 'b' });
    expect(updatesNotice(two, '2026-10-21')).toEqual({ unseen: true, teaser: 'b' });
    expect(updatesNotice(two, '2026-10-22')).toEqual({ unseen: false, teaser: null });
  });

  it('says nothing when the newest entry has no line', () => {
    expect(updatesNotice([{ date: '2026-10-22', lines: [] }], null)).toEqual({
      unseen: true,
      teaser: null,
    });
  });
});

describe('UPDATES', () => {
  it('runs newest first, one entry per date, each saying something', () => {
    const dates = UPDATES.map((u) => u.date);
    expect([...dates].sort().reverse()).toEqual(dates);
    expect(new Set(dates).size).toBe(dates.length);
    for (const u of UPDATES) {
      expect(u.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(u.lines.length).toBeGreaterThan(0);
    }
  });
});
