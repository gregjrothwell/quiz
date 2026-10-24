import { describe, expect, it } from 'vitest';
import { isNewMode, isNewRound, MODE_NEW_UNTIL, NEW_UNTIL, todayIso } from './newRounds';

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
      themes: '2026-11-08',
      higher: '2026-11-08',
    });
  });
});

describe('isNewMode', () => {
  it('shows the sticker through the last day, then drops it', () => {
    expect(isNewMode('chaser', '2026-11-05')).toBe(true);
    expect(isNewMode('chaser', '2026-11-06')).toBe(false);
    expect(isNewMode('ladder', '2026-08-15')).toBe(true);
    expect(isNewMode('ladder', '2026-08-16')).toBe(false);
  });

  it('leaves a mode with no date alone', () => {
    expect(isNewMode('chaser', '2026-10-23', {})).toBe(false);
  });

  it('dates every lobby mode whose go-live is known', () => {
    expect(MODE_NEW_UNTIL).toEqual({
      ladder: '2026-08-15',
      stakes: '2026-09-16',
      steal: '2026-09-18',
      jigsaw: '2026-09-18',
      standoff: '2026-10-08',
      chaser: '2026-11-05',
    });
  });

  it('only Beat the Chaser is still on as of 23 Oct 2026', () => {
    const today = '2026-10-23';
    expect(isNewMode('chaser', today)).toBe(true);
    expect(isNewMode('ladder', today)).toBe(false);
    expect(isNewMode('stakes', today)).toBe(false);
    expect(isNewMode('steal', today)).toBe(false);
    expect(isNewMode('jigsaw', today)).toBe(false);
    expect(isNewMode('standoff', today)).toBe(false);
  });
});

describe('todayIso', () => {
  it('uses the London calendar, including the hour BST rolls the date', () => {
    // 23:30 UTC on 23 Oct is 00:30 on the 24th in London (BST, UTC+1).
    expect(todayIso(new Date('2026-10-23T22:30:00Z'))).toBe('2026-10-23');
    expect(todayIso(new Date('2026-10-23T23:30:00Z'))).toBe('2026-10-24');
  });
});
