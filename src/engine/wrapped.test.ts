import { describe, expect, test } from 'vitest';
import { EMPTY_FINALS } from './finals';
import { ordinal, wrappedFor, wrappedOpen, type WrappedRow } from './wrapped';

/* Quiz Wrapped's facts (docs/decisions/quiz-wrapped.md, W1 and W4). */

function row(playerId: string, overrides: Partial<WrappedRow> = {}): WrappedRow {
  return {
    playerId, name: playerId, played: 10, wins: 2, points: 40_000, best: 7_000, squad: '',
    fastest: 0, comeback: 0, loneWolf: 0, contrarian: 0, ...overrides,
  };
}

describe('wrappedOpen', () => {
  test('opens on 5 December 2026, local time, and not the day before', () => {
    expect(wrappedOpen(new Date(2026, 11, 4, 23, 59))).toBe(false);
    expect(wrappedOpen(new Date(2026, 11, 5, 0, 1))).toBe(true);
    expect(wrappedOpen(new Date(2027, 0, 2))).toBe(true);
  });
});

describe('wrappedFor', () => {
  const board = [
    row('ann', { name: 'Ann', points: 90_000, squad: 'Hermes' }),
    row('bob', { name: 'Bob', points: 60_000, squad: 'Zeus' }),
    row('cass', { name: 'Cass', points: 50_000, squad: 'Hermes' }),
    row('dan', { name: 'Dan', points: 10_000 }),
  ];

  test('all five, for a regular with a rosette, a final and a squad', () => {
    const me = board[2]!;
    const cards = wrappedFor({ ...me, loneWolf: 3, fastest: 1 }, board, { finals: 2, shared: 1, shafted: 1, gotShafted: 0 });
    expect(cards.map((card) => card.kind)).toEqual(['numbers', 'rosette', 'finals', 'squad', 'place']);
    expect(cards[1]).toEqual({ kind: 'rosette', id: 'loneWolf', count: 3 });
    // Hermes averages 70,000 against Zeus's 60,000.
    expect(cards[3]).toEqual({ kind: 'squad', squad: 'Hermes', position: 1, of: 2 });
    expect(cards[4]).toEqual({ kind: 'place', position: 3, of: 4, top: ['Ann', 'Bob', 'Cass'] });
  });

  test('one round, no wins, no rosette, no final, no squad: numbers and place only', () => {
    const newcomer = row('dan', { name: 'Dan', played: 1, wins: 0, points: 10_000 });
    const cards = wrappedFor(newcomer, board, EMPTY_FINALS);
    expect(cards.map((card) => card.kind)).toEqual(['numbers', 'place']);
    expect(cards[0]).toEqual({ kind: 'numbers', played: 1, wins: 0, points: 10_000, best: 7_000 });
  });

  test('a player missing from the board gets no place card', () => {
    expect(wrappedFor(row('zed'), board, EMPTY_FINALS).map((card) => card.kind)).toEqual(['numbers']);
  });

  test('a rosette tie goes to the order the awards are shown in', () => {
    const cards = wrappedFor(row('x', { comeback: 2, contrarian: 2 }), [], EMPTY_FINALS);
    expect(cards[1]).toEqual({ kind: 'rosette', id: 'comeback', count: 2 });
  });
});

describe('ordinal', () => {
  test('the English endings, teens included', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 111].map(ordinal)).toEqual(
      ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st', '111th'],
    );
  });
});
