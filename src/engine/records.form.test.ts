import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import {
  FORM_KEPT,
  FORM_WINDOW,
  PLAYER_RECORD_KEYS,
  RECENT_ROUND_KEYS,
  bankGame,
  foldRecords,
  formOf,
  type GameOutcome,
  type PlayerRecord,
  type RecentRound,
} from './records';

function record(overrides: Partial<PlayerRecord> = {}): PlayerRecord {
  return {
    name: 'Greg',
    played: 1,
    wins: 0,
    points: 1_000,
    best: 1_000,
    lastGame: 'game-1',
    lastPlayed: 1_000,
    ...overrides,
  };
}

const NO_HONOURS = { fastest: 0, comeback: 0, loneWolf: 0, contrarian: 0 };

function outcome(overrides: Partial<GameOutcome> = {}): GameOutcome {
  return {
    name: 'Greg',
    gameId: 'game-2',
    score: 2_000,
    won: false,
    squad: '',
    honours: NO_HONOURS,
    ...overrides,
  };
}

describe('formOf', () => {
  test('sums the best four and drops the rest', () => {
    expect(formOf([1, 2, 3, 4, 5, 6])).toBe(6 + 5 + 4 + 3);
  });

  test('sums everything when there are fewer than four rounds', () => {
    expect(formOf([900, 800, 100])).toBe(1_800);
    expect(formOf([500])).toBe(500);
    expect(formOf([])).toBe(0);
  });

  test('drops a negative before a smaller positive', () => {
    expect(formOf([1_000, 1_000, 1_000, 1_000, -500, 800])).toBe(4_000);
  });
});

describe('bankGame and form', () => {
  test('opens the window on the first game', () => {
    const banked = bankGame(null, outcome({ score: 2_450, gameId: 'game-2' }));

    expect(banked.recent).toEqual([
      expect.objectContaining({ gameId: 'game-2', score: 2_450 }),
    ]);
    expect(banked.form).toBe(2_450);
  });

  test('keeps the last six and drops the oldest', () => {
    let current: PlayerRecord | null = null;
    for (let n = 1; n <= FORM_WINDOW + 1; n += 1) {
      current = bankGame(current, outcome({
        gameId: `game-${n}`,
        score: n * 100,
      }));
    }

    expect(current?.recent?.map((entry) => entry.score)).toEqual([200, 300, 400, 500, 600, 700]);
    expect(current?.recent).toHaveLength(FORM_WINDOW);
    expect(current?.form).toBe(formOf([200, 300, 400, 500, 600, 700]));
  });

  test('form with three rounds is the sum of those three', () => {
    let current: PlayerRecord | null = null;
    for (const score of [1_000, 2_000, 3_000]) {
      current = bankGame(current, outcome({
        gameId: `game-${score}`,
        score,
      }));
    }

    expect(current?.played).toBe(3);
    expect(current?.form).toBe(6_000);
  });

  test('form with four rounds keeps all four, with five drops the worst', () => {
    let current: PlayerRecord | null = null;
    for (const score of [100, 400, 300, 200, 50]) {
      current = bankGame(current, outcome({
        gameId: `game-${score}`,
        score,
      }));
    }

    expect(current?.form).toBe(100 + 400 + 300 + 200);
    expect(FORM_KEPT).toBe(4);
  });

  test('a repeat write leaves the record untouched', () => {
    const existing = record({ lastGame: 'game-2', played: 2, points: 3_000 });
    const banked = bankGame(existing, outcome({ gameId: 'game-2', score: 2_000 }));
    expect(banked).toBe(existing);
  });

  test('a repeat gameId does not push the window even if lastGame has moved on', () => {
    const existing = record({
      lastGame: 'other',
      recent: [{ gameId: 'game-2', score: 2_000, at: 1 }],
      form: 2_000,
    });

    const banked = bankGame(existing, outcome({ gameId: 'game-2', score: 9_999 }));

    expect(banked.recent).toEqual([{ gameId: 'game-2', score: 2_000, at: 1 }]);
    expect(banked.form).toBe(2_000);
    expect(banked.played).toBe(2);
  });
});

describe('foldRecords and form', () => {
  test('merges two windows rather than taking only the newer side’s', () => {
    const phoneRecent: RecentRound[] = [1, 2, 3, 4, 5, 6].map((n) => ({
      gameId: `phone-${n}`,
      score: n * 100,
      at: n,
    }));
    const phone = record({
      lastGame: 'phone-6',
      lastPlayed: 6,
      recent: phoneRecent,
      form: formOf(phoneRecent.map((entry) => entry.score)),
    });
    const laptop = record({
      lastGame: 'tonight',
      lastPlayed: 7,
      recent: [{ gameId: 'tonight', score: 500, at: 7 }],
      form: 500,
    });

    const merged = foldRecords(laptop, phone);

    expect(merged.lastGame).toBe('tonight');
    expect(merged.recent?.map((entry) => entry.gameId)).toEqual([
      'phone-2', 'phone-3', 'phone-4', 'phone-5', 'phone-6', 'tonight',
    ]);
    expect(merged.form).toBe(formOf([200, 300, 400, 500, 600, 500]));
  });

  test('does not double-count a game both sides banked', () => {
    const shared: RecentRound = { gameId: 'same-night', score: 2_000, at: 5 };
    const source = record({
      lastGame: 'same-night',
      lastPlayed: 5,
      recent: [shared],
      form: 2_000,
    });
    const target = record({
      lastGame: 'earlier',
      lastPlayed: 2,
      recent: [{ gameId: 'earlier', score: 1_000, at: 2 }, shared],
      form: 3_000,
    });

    const merged = foldRecords(source, target);

    expect(merged.recent?.filter((entry) => entry.gameId === 'same-night')).toHaveLength(1);
    expect(merged.form).toBe(3_000);
  });

  test('writes an empty window for two records from before form existed', () => {
    const merged = foldRecords(record(), record());
    expect(merged.recent).toEqual([]);
    expect(merged.form).toBe(0);
  });

  test('carries recent through the fold so a later set cannot erase it', () => {
    const source = record({
      recent: [{ gameId: 'a', score: 1_000, at: 1 }],
      form: 1_000,
    });
    const target = record({
      recent: [{ gameId: 'b', score: 2_000, at: 2 }],
      form: 2_000,
    });

    const merged = foldRecords(source, target);

    expect(merged.recent).toHaveLength(2);
    expect('recent' in merged).toBe(true);
    expect('form' in merged).toBe(true);
  });
});

/**
 * The same guard `firstMs` and the game record have. `firestore.rules` is
 * pasted into the console by hand, so the repo copy and the client drift
 * silently — and here the drift is total: `hasOnly` refuses the whole
 * document, so an unlisted `recent` or `form` means nobody's game is banked.
 * Forced red 8 September 2026 by taking `'form'` out of the list (1 failed,
 * 17 skipped) and green again on restoring it.
 */
describe('the season row agrees with the security rules', () => {
  const RULES = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
  const block = /match \/seasons\/\{season\}\/players\/\{playerId\} \{([\s\S]*?)\n {4}\}/.exec(RULES)?.[1] ?? '';

  function quotedNames(list: string | undefined): string[] {
    return [...(list ?? '').matchAll(/'([^']+)'/g)].map((match) => match[1] ?? '').sort();
  }

  test('the rules block exists', () => {
    expect(block).not.toBe('');
  });

  test('the hasOnly list is exactly the document the client writes', () => {
    const hasOnly = /request\.resource\.data\.keys\(\)\.hasOnly\(\s*\[([\s\S]*?)\]\)/.exec(block)?.[1];
    expect(quotedNames(hasOnly)).toEqual([...PLAYER_RECORD_KEYS].sort());
  });

  test('recent and form are optional, so an old bundle still banks', () => {
    expect(block).toMatch(/!\('recent' in request\.resource\.data\.keys\(\)\)/);
    expect(block).toMatch(/!\('form' in request\.resource\.data\.keys\(\)\)/);
  });

  test('the window is bounded at six and each score is an int', () => {
    expect(block).toMatch(/recent\.size\(\) <= 6/);
    expect(block).toMatch(/entry\.score is int/);
    expect(block).toMatch(/form is int/);
  });

  test('a recent entry hasOnly the three fields the client writes', () => {
    const entryHasOnly = /recentEntryOk[\s\S]*?hasOnly\(\[([^\]]*)\]\)/.exec(block)?.[1];
    expect(quotedNames(entryHasOnly)).toEqual([...RECENT_ROUND_KEYS].sort());
  });
});
