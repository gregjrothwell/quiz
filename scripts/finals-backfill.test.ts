import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import {
  BACKFILL_SEASON,
  backfillWillWrite,
  planFinalsBackfill,
  tallyKeptFinals,
  type KeptGame,
  type SeasonFinalsRow,
} from './finals-backfill';

function game(id: string, picks: Record<string, 'share' | 'shaft' | null>): KeptGame {
  return {
    id,
    players: Object.fromEntries(
      Object.entries(picks).map(([uid, pick]) => [uid, { standoff: { pick } }]),
    ),
  };
}

function row(overrides: Partial<SeasonFinalsRow> = {}): SeasonFinalsRow {
  return {
    id: 'sam',
    name: 'Sam',
    played: 10,
    finals: undefined,
    shared: undefined,
    shafted: undefined,
    gotShafted: undefined,
    ...overrides,
  };
}

describe('tallyKeptFinals', () => {
  test('counts shares, shafts, no-picks and a double shaft, and ignores a round with no final', () => {
    const { tallies, skipped } = tallyKeptFinals([
      game('share', { sam: 'share', greg: 'share' }),
      game('shaft', { sam: 'shaft', greg: 'share' }),
      game('silent', { sam: null, greg: 'shaft' }),
      game('both', { sam: 'shaft', greg: 'shaft' }),
      { id: 'ordinary', players: { sam: {}, greg: {} } },
    ]);

    expect(skipped).toEqual([]);
    expect(tallies.get('sam')).toEqual({ finals: 4, shared: 1, shafted: 2, gotShafted: 2 });
    expect(tallies.get('greg')).toEqual({ finals: 4, shared: 2, shafted: 2, gotShafted: 2 });
  });

  test('skips a final that is not exactly two countable picks', () => {
    const { tallies, skipped } = tallyKeptFinals([
      game('one', { sam: 'share' }),
      { id: 'odd', players: { sam: { standoff: { pick: 'maybe' } }, greg: { standoff: { pick: 'share' } } } },
    ]);

    expect(tallies.size).toBe(0);
    expect(skipped).toEqual(['one', 'odd']);
  });
});

describe('planFinalsBackfill', () => {
  const computed = new Map([['sam', { finals: 7, shared: 5, shafted: 2, gotShafted: 2 }]]);

  test('writes the counts onto a row that has none', () => {
    const [plan] = planFinalsBackfill(computed, new Map([['sam', row()]]));
    expect(plan).toMatchObject({
      action: 'write',
      after: { finals: 7, shared: 5, shafted: 2, gotShafted: 2 },
    });
  });

  test('never lowers a count already on the row', () => {
    const [plan] = planFinalsBackfill(computed, new Map([[
      'sam',
      row({ finals: 8, shared: 5, shafted: 2, gotShafted: 3 }),
    ]]));
    expect(plan).toMatchObject({ action: 'unchanged' });
  });

  test('raises only the counts that are behind, and leaves the higher ones', () => {
    const [plan] = planFinalsBackfill(computed, new Map([[
      'sam',
      row({ played: 12, finals: 8, shared: 4, shafted: 2, gotShafted: 2 }),
    ]]));
    expect(plan).toMatchObject({
      action: 'write',
      after: { finals: 8, shared: 5, shafted: 2, gotShafted: 2 },
    });
  });

  test('refuses a row the rules would refuse, and does not invent one', () => {
    const tallies = new Map([
      ['sam', { finals: 7, shared: 5, shafted: 2, gotShafted: 2 }],
      ['fraction', { finals: 1, shared: 1, shafted: 0, gotShafted: 0 }],
      ['negative', { finals: 1, shared: 0, shafted: 1, gotShafted: 0 }],
      ['over-sum', { finals: 4, shared: 3, shafted: 2, gotShafted: 0 }],
      ['over-got', { finals: 2, shared: 1, shafted: 1, gotShafted: 3 }],
    ]);
    const plans = planFinalsBackfill(tallies, new Map([
      ['sam', row({ played: 4 })],
      ['fraction', row({ id: 'fraction', name: 'Fraction', played: 10, finals: 1.5 })],
      ['negative', row({ id: 'negative', name: 'Negative', played: 10, shared: -1 })],
      ['over-sum', row({ id: 'over-sum', name: 'Over', played: 9, finals: 4, shared: 4, shafted: 0, gotShafted: 0 })],
      ['over-got', row({ id: 'over-got', name: 'Got', played: 9, finals: 2, shared: 1, shafted: 1, gotShafted: 0 })],
    ]));

    expect(plans.every((plan) => plan.action === 'refuse')).toBe(true);
    expect(plans).toHaveLength(5);
    expect(planFinalsBackfill(computed, new Map()).map((plan) => plan.action)).toEqual(['missing']);
  });

  test('does not write unless asked, and only names season-2', () => {
    expect(backfillWillWrite(['node', 'backfill-finals.ts'])).toBe(false);
    expect(backfillWillWrite(['node', 'backfill-finals.ts', '--go'])).toBe(true);
    expect(BACKFILL_SEASON).toBe('season-2');

    const source = readFileSync(new URL('./backfill-finals.ts', import.meta.url), 'utf8');
    expect(source).toContain('BACKFILL_SEASON');
    expect(source).toContain('backfillWillWrite');
    expect(source).not.toContain('season-1');
  });
});
