import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { RIVALS_CAP, rivalsCaption, type Rival } from '../src/engine/rivals';
import {
  RIVALS_BACKFILL_SEASON,
  answeredOf,
  atOf,
  claimOf,
  historyGaps,
  planRivalsBackfill,
  playersOf,
  raiseRivals,
  replayRivals,
  rivalsBackfillWillWrite,
  scoresOf,
  type KeptRivalGame,
  type SeasonRivalRow,
} from './rivals-backfill';

function game(
  id: string,
  seats: Record<string, { name: string; score: number; answered?: boolean }>,
  opts: { at?: number | null; doubleOf?: string } = {},
): KeptRivalGame {
  const players: KeptRivalGame['players'] = {};
  const scores: KeptRivalGame['scores'] = {};
  const answered = new Set<string>();
  for (const [uid, seat] of Object.entries(seats)) {
    players[uid] = { name: seat.name };
    scores[uid] = seat.score;
    if (seat.answered !== false) answered.add(uid);
  }
  const kept: KeptRivalGame = { id, at: opts.at ?? null, players, scores, answered };
  return opts.doubleOf === undefined ? kept : { ...kept, doubleOf: opts.doubleOf };
}

function row(overrides: Partial<SeasonRivalRow> = {}): SeasonRivalRow {
  return { id: 'sam', name: 'Sam', played: 2, rivals: undefined, ...overrides };
}

describe('replayRivals', () => {
  test('counts a strict lead, ignores a tie, and keeps the later name', () => {
    const { maps, kept, skipped } = replayRivals([
      game('tie', { sam: { name: 'Sam', score: 5 }, priya: { name: 'Priya', score: 5 } }, { at: 1 }),
      game('one', { sam: { name: 'Sam', score: 10 }, priya: { name: 'P', score: 1 } }, { at: 2 }),
      game('two', { sam: { name: 'Sam', score: 3 }, priya: { name: 'Priya', score: 9 } }, { at: 3 }),
    ]);

    expect(skipped).toEqual([]);
    expect(kept.get('sam')).toBe(3);
    expect(maps.get('sam')).toEqual({ priya: { name: 'Priya', beaten: 1, lost: 1 } });
    expect(maps.get('priya')).toEqual({ sam: { name: 'Sam', beaten: 1, lost: 1 } });
    // Level on one each says nothing (PROJ-80): no caption until a lead reaches 2.
    expect(rivalsCaption(maps.get('sam'))).toBeNull();
  });

  test('a solo round names nobody, and a blank name is not an opponent', () => {
    const { maps, kept } = replayRivals([
      game('solo', { sam: { name: 'Sam', score: 4 } }, { at: 1 }),
      game('blank', { sam: { name: 'Sam', score: 4 }, priya: { name: '   ', score: 1 } }, { at: 2 }),
    ]);

    expect(maps.get('sam')).toBeUndefined();
    expect(maps.get('priya')).toEqual({ sam: { name: 'Sam', beaten: 0, lost: 1 } });
    expect(kept.get('sam')).toBe(2);
    expect(kept.get('priya')).toBe(1);
  });

  // The ids and names below are the ones on the live `games/` on 28 October 2026.
  test('harness and hand-test rounds are skipped, and a real name keeps a round', () => {
    const { maps, kept, skipped } = replayRivals([
      game('rank-1792097239825', { ada: { name: 'Ada', score: 9 }, bo: { name: 'Bo', score: 1 } }, { at: 1 }),
      game('final-1792691983738', { ada: { name: 'Ada', score: 9 }, bo: { name: 'Bo', score: 1 } }, { at: 2 }),
      game('host-1792691983738', { ada: { name: 'Ada', score: 9 }, bo: { name: 'Bo', score: 1 } }, { at: 3 }),
      game('harness-game', { ada: { name: 'Ada', score: 9 }, bo: { name: 'Bo', score: 1 } }, { at: 4 }),
      game('hand', { g: { name: 'G TEST', score: 9 }, jo: { name: 'Test Jo', score: 1 } }, { at: 5 }),
      game('real', { g: { name: 'G TEST', score: 9 }, sam: { name: 'Sam', score: 1 } }, { at: 6 }),
    ]);

    expect(skipped).toEqual([
      { id: 'rank-1792097239825', reason: 'harness run' },
      { id: 'final-1792691983738', reason: 'harness run' },
      { id: 'host-1792691983738', reason: 'harness run' },
      { id: 'harness-game', reason: 'harness run' },
      { id: 'hand', reason: 'test run' },
    ]);
    expect(maps.has('ada')).toBe(false);
    expect(maps.has('jo')).toBe(false);
    expect(maps.get('g')).toEqual({ sam: { name: 'Sam', beaten: 1, lost: 0 } });
    expect(kept.get('g')).toBe(1);
  });

  // Joining seeds a score of 0, so a seat is not a game played (PROJ-64 review).
  test('a seat that never answered is not ranked, and is not ranked against', () => {
    const { maps, kept } = replayRivals([
      game('late', {
        sam: { name: 'Sam', score: 4 },
        priya: { name: 'Priya', score: 0 },
        alex: { name: 'Alex', score: 0, answered: false },
      }, { at: 1 }),
    ]);

    expect(maps.get('sam')).toEqual({ priya: { name: 'Priya', beaten: 1, lost: 0 } });
    expect(maps.get('alex')).toBeUndefined();
    expect(kept.get('alex')).toBeUndefined();
  });

  test('round two ranks the morning, and round one still counts on its own', () => {
    // Residual would say Priya won round two. The morning still belongs to Sam.
    const { maps, skipped } = replayRivals([
      game('half', { sam: { name: 'Sam', score: 10 }, priya: { name: 'Priya', score: 0 } }, { at: 1 }),
      game('second', { sam: { name: 'Sam', score: 0 }, priya: { name: 'Priya', score: 6 } }, { at: 2, doubleOf: 'half' }),
    ]);

    expect(skipped).toEqual([]);
    expect(maps.get('sam')).toEqual({ priya: { name: 'Priya', beaten: 2, lost: 0 } });
    expect(maps.get('priya')).toEqual({ sam: { name: 'Sam', beaten: 0, lost: 2 } });
  });

  test('skips round two when its first half was never kept', () => {
    const { maps, kept, skipped } = replayRivals([
      game('second', { sam: { name: 'Sam', score: 1 }, priya: { name: 'Priya', score: 9 } }, { at: 2, doubleOf: 'gone' }),
    ]);

    expect(maps.size).toBe(0);
    expect(kept.size).toBe(0);
    expect(skipped).toEqual([{ id: 'second', reason: 'first half missing (gone)' }]);
  });

  test('files a claimed uid on their playerId, opponents included', () => {
    const claims = new Map([['phone', 'sam'], ['laptop', 'priya']]);
    const { maps, kept } = replayRivals(
      [game('night', { phone: { name: 'Sam', score: 8 }, laptop: { name: 'Priya', score: 2 } }, { at: 1 })],
      claims,
    );

    expect(maps.has('phone')).toBe(false);
    expect(kept.get('sam')).toBe(1);
    expect(maps.get('sam')).toEqual({ priya: { name: 'Priya', beaten: 1, lost: 0 } });
  });

  test('two seats of one person in one round count once', () => {
    const claims = new Map([['laptop', 'sam'], ['phone', 'sam']]);
    const { maps, kept } = replayRivals(
      [game('night', {
        laptop: { name: 'Sam', score: 1 },
        phone: { name: 'Sam', score: 9 },
        greg: { name: 'Greg', score: 5 },
      }, { at: 1 })],
      claims,
    );

    // laptop sorts first, so Sam's score is 1 and Greg finished ahead.
    expect(kept.get('sam')).toBe(1);
    expect(maps.get('sam')).toEqual({ greg: { name: 'Greg', beaten: 0, lost: 1 } });
  });

  test('an unstamped round sorts first, so the later name wins', () => {
    const { maps } = replayRivals([
      game('stamped', { sam: { name: 'Sam', score: 4 }, priya: { name: 'Priya', score: 1 } }, { at: 5 }),
      game('loose', { sam: { name: 'Sam', score: 4 }, priya: { name: 'P', score: 1 } }),
    ]);

    expect(maps.get('sam')?.priya?.name).toBe('Priya');
  });

  test('caps the map the way a bank does', () => {
    const seats: Record<string, { name: string; score: number }> = { hero: { name: 'Hero', score: 10 } };
    for (let index = 0; index < RIVALS_CAP + 1; index += 1) {
      const id = `p${String(index).padStart(2, '0')}`;
      seats[id] = { name: `P${index}`, score: 1 };
    }

    const { maps } = replayRivals([game('crowd', seats, { at: 1 })]);
    const rivals = maps.get('hero') ?? {};

    expect(Object.keys(rivals)).toHaveLength(RIVALS_CAP);
    expect(rivals.p40).toBeUndefined();
  });
});

describe('planRivalsBackfill', () => {
  test('writes a row that has no map, and does not create a missing one', () => {
    const { maps } = replayRivals([
      game('night', { sam: { name: 'Sam', score: 4 }, priya: { name: 'Priya', score: 1 } }, { at: 1 }),
    ]);
    const plans = planRivalsBackfill(maps, new Map([['sam', row()]]));

    expect(plans).toEqual([
      { action: 'missing', id: 'priya' },
      {
        action: 'write',
        id: 'sam',
        name: 'Sam',
        before: {},
        after: { priya: { name: 'Priya', beaten: 1, lost: 0 } },
      },
    ]);
  });

  test('a second plan against the written map writes nothing', () => {
    const { maps } = replayRivals([
      game('night', { sam: { name: 'Sam', score: 4 }, priya: { name: 'Priya', score: 1 } }, { at: 1 }),
    ]);
    const first = planRivalsBackfill(maps, new Map([
      ['sam', row()],
      ['priya', row({ id: 'priya', name: 'Priya' })],
    ]));
    const written = new Map(first.flatMap((plan) => (plan.action === 'write' ? [[plan.id, plan.after] as const] : [])));

    const again = planRivalsBackfill(maps, new Map([
      ['sam', row({ rivals: written.get('sam') })],
      ['priya', row({ id: 'priya', name: 'Priya', rivals: written.get('priya') })],
    ]));

    expect(written.size).toBe(2);
    expect(again.every((plan) => plan.action === 'unchanged')).toBe(true);
  });

  test('never lowers a count, never sums one, and keeps a rival the history lacks', () => {
    const stored: Record<string, Rival> = {
      priya: { name: 'Priya', beaten: 4, lost: 1 },
      alex: { name: 'Alex', beaten: 2, lost: 0 },
    };
    const computed: Record<string, Rival> = {
      priya: { name: 'Priya P', beaten: 1, lost: 3 },
    };

    expect(raiseRivals(stored, computed)).toEqual({
      priya: { name: 'Priya', beaten: 4, lost: 3 },
      alex: { name: 'Alex', beaten: 2, lost: 0 },
    });

    const [plan] = planRivalsBackfill(
      new Map([['sam', computed]]),
      new Map([['sam', row({ rivals: stored })]]),
    );
    expect(plan?.action).toBe('write');
  });

  test('a name from a later kept round is a write, and equal counts do not grow', () => {
    const [plan] = planRivalsBackfill(
      new Map([['sam', { priya: { name: 'Priya', beaten: 2, lost: 0 } }]]),
      new Map([['sam', row({ rivals: { priya: { name: 'P', beaten: 2, lost: 0 } } })]]),
    );

    expect(plan).toMatchObject({
      action: 'write',
      after: { priya: { name: 'Priya', beaten: 2, lost: 0 } },
    });
  });

  test('drops a cold rival so the write stays inside the cap', () => {
    const stored: Record<string, Rival> = {};
    for (let index = 0; index < RIVALS_CAP; index += 1) {
      stored[`p${String(index).padStart(2, '0')}`] = { name: `P${index}`, beaten: 1, lost: 0 };
    }

    const after = raiseRivals(stored, { zzz: { name: 'Zed', beaten: 5, lost: 0 } });

    expect(after?.zzz).toEqual({ name: 'Zed', beaten: 5, lost: 0 });
    expect(Object.keys(after ?? {})).toHaveLength(RIVALS_CAP);
  });
});

describe('historyGaps', () => {
  test('names a row games/ cannot see, and one it can only partly see', () => {
    const rows = new Map<string, SeasonRivalRow>([
      ['sam', row({ played: 30 })],
      ['alex', row({ id: 'alex', name: 'Alex', played: 12 })],
      ['new', row({ id: 'new', name: 'New', played: 4 })],
      ['zero', row({ id: 'zero', name: 'Zero', played: 0 })],
    ]);

    expect(historyGaps(rows, new Map([['sam', 22], ['new', 4]]))).toEqual([
      { id: 'alex', name: 'Alex', played: 12, kept: 0 },
      { id: 'sam', name: 'Sam', played: 30, kept: 22 },
    ]);
  });
});

describe('the script', () => {
  test('does not write unless asked, and only names season-2', () => {
    expect(rivalsBackfillWillWrite(['node', 'backfill-rivals.ts'])).toBe(false);
    expect(rivalsBackfillWillWrite(['node', 'backfill-rivals.ts', '--go'])).toBe(true);
    expect(RIVALS_BACKFILL_SEASON).toBe('season-2');

    const source = readFileSync(new URL('./backfill-rivals.ts', import.meta.url), 'utf8');
    expect(source).toContain('RIVALS_BACKFILL_SEASON');
    expect(source).toContain('rivalsBackfillWillWrite');
    expect(source).toContain('batch.update');
    expect(source).not.toContain('batch.set');
    expect(source).not.toContain('season-1');
  });

  test('reads a timestamp, a claim, and ignores a score that is not a number', () => {
    expect(atOf(1_700_000_000_000)).toBe(1_700_000_000_000);
    expect(atOf({ toMillis: () => 25 })).toBe(25);
    expect(atOf(undefined)).toBeNull();
    expect(claimOf({ playerId: 'sam' })).toBe('sam');
    expect(claimOf({})).toBeNull();
    expect(scoresOf({ sam: 4, priya: '9', alex: Number.NaN })).toEqual({ sam: 4 });
    expect(
      answeredOf([
        { answers: { sam: { optionIndex: 1 } } },
        { answers: { priya: { optionIndex: 0 } } },
        { skipped: true, answers: {} },
        null,
      ]),
    ).toEqual(new Set(['sam', 'priya']));
    expect(answeredOf(undefined)).toEqual(new Set());
    expect(playersOf({ sam: { name: 'Sam' }, bad: null })).toEqual({
      sam: { name: 'Sam' },
      bad: { name: '' },
    });
  });
});
