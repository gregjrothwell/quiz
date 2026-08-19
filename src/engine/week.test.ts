import { describe, expect, test } from 'vitest';
import { weekId } from './week';

/** Local midday, so nothing here is sitting on a boundary by accident. */
function on(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12, 0, 0);
}

describe('weekId', () => {
  test('names the week a midweek game falls in', () => {
    // #given a Wednesday in August 2026
    // #when the week is named
    // #then it is the thirty-fourth of the year, zero-padded so ids sort
    expect(weekId(on(2026, 8, 19))).toBe('week-2026-W34');
  });

  test('pads a single-digit week so the ids sort as strings', () => {
    // #given Monday 26 January 2026
    // #when the week is named
    // #then it is W05 and not W5 — these are read back in order
    expect(weekId(on(2026, 1, 26))).toBe('week-2026-W05');
  });

  test('keeps a whole Monday-to-Sunday week together', () => {
    // #given every day of one week in August 2026
    const monday = weekId(on(2026, 8, 17));
    const sunday = weekId(on(2026, 8, 23));

    // #when they are named
    // #then Monday opens the week and Sunday closes it
    expect(monday).toBe('week-2026-W34');
    expect(sunday).toBe('week-2026-W34');
  });

  test('starts a new week on Monday, not on Sunday', () => {
    // #given the Sunday that ends a week and the Monday that follows it
    // #when both are named
    // #then they are different weeks — the failure a naive day-of-year
    // division makes, and the one nobody notices until a Sunday quiz
    expect(weekId(on(2026, 8, 23))).toBe('week-2026-W34');
    expect(weekId(on(2026, 8, 24))).toBe('week-2026-W35');
  });

  test('puts the end of December into next year when the week straddles', () => {
    // #given Tuesday 31 December 2024, which is in the week of 2 January 2025
    // #when it is named
    // #then it belongs to 2025 week 1, not to 2024 — the year in the id is the
    // ISO week year and not the calendar one
    expect(weekId(on(2024, 12, 31))).toBe('week-2025-W01');
  });

  test('puts the start of January into last year when the week straddles', () => {
    // #given Friday 1 January 2027, whose week began on Monday 28 December
    // #when it is named
    // #then it belongs to 2026 week 53 — a 53-week year, which is the case that
    // breaks any implementation assuming 52
    expect(weekId(on(2027, 1, 1))).toBe('week-2026-W53');
  });

  test('opens the year at week 1 when 1 January is a Monday', () => {
    // #given Monday 1 January 2024
    // #when it is named
    // #then the year opens on its own week 1 with nothing carried over
    expect(weekId(on(2024, 1, 1))).toBe('week-2024-W01');
  });

  test('survives the clocks going forward and back', () => {
    // #given the Sundays the UK clocks change in 2026, and the Mondays after
    // #when each is named
    // #then each change lands in the week it should, rather than an hour of
    // drift rounding a whole week away
    expect(weekId(on(2026, 3, 29))).toBe('week-2026-W13');
    expect(weekId(on(2026, 3, 30))).toBe('week-2026-W14');
    expect(weekId(on(2026, 10, 25))).toBe('week-2026-W43');
    expect(weekId(on(2026, 10, 26))).toBe('week-2026-W44');
  });

  test('never disagrees with itself across a whole year', () => {
    // #given every day of 2026 in order
    let previous = weekId(on(2026, 1, 1));
    let changes = 0;

    for (let day = new Date(2026, 0, 1); day.getFullYear() === 2026; day.setDate(day.getDate() + 1)) {
      const id = weekId(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12));

      // #then the id only ever changes on a Monday, and never mid-week
      if (id !== previous) {
        expect(day.getDay()).toBe(1);
        changes += 1;
        previous = id;
      }
    }

    // #and a year contains either 52 or 53 Mondays' worth of changes
    expect(changes).toBeGreaterThanOrEqual(51);
    expect(changes).toBeLessThanOrEqual(53);
  });
});
