import { describe, expect, it } from 'vitest';
import { isNewRound, NEW_UNTIL, todayIso } from './newRounds';

describe('isNewRound', () => {
  it('shows the sticker through the last day, then drops it', () => {
    expect(isNewRound('survey', '2026-11-05')).toBe(true);
    expect(isNewRound('survey', '2026-11-06')).toBe(false);
  });

  it('leaves a round with no date alone', () => {
    expect(isNewRound('sleeves', '2026-10-23')).toBe(false);
    expect(isNewRound(null, '2026-10-23')).toBe(false);
  });

  it('dates the four rounds that are actually new', () => {
    expect(NEW_UNTIL).toEqual({
      random: '2026-10-26',
      artists: '2026-10-26',
      tags: '2026-11-04',
      survey: '2026-11-05',
    });
  });
});

describe('todayIso', () => {
  it('uses the London calendar, including the hour BST rolls the date', () => {
    // 23:30 UTC on 23 Oct is 00:30 on the 24th in London (BST, UTC+1).
    expect(todayIso(new Date('2026-10-23T22:30:00Z'))).toBe('2026-10-23');
    expect(todayIso(new Date('2026-10-23T23:30:00Z'))).toBe('2026-10-24');
  });
});
