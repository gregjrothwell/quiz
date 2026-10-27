import { describe, expect, test } from 'vitest';
import type { GameRecord, RecordedQuestion } from '../src/engine/gameRecord';
import type { Difficulty, PackId } from '../src/questions/types';
import {
  formatCass,
  formatDouble,
  formatGeekend,
  formatHigher,
  formatOwedChecks,
  formatThemes,
  GEEKEND_SEASON,
  type KeptRound,
} from './owed-checks';

function question(
  index: number,
  difficulty: Difficulty,
  answers: Record<string, number>,
): RecordedQuestion {
  return {
    id: `q${String(index)}`,
    index,
    category: 'General',
    difficulty,
    kind: 'text',
    correctIndex: 0,
    skipped: false,
    answers: Object.fromEntries(
      Object.entries(answers).map(([uid, optionIndex]) => [uid, { optionIndex, elapsedMs: 1_000 }]),
    ),
    deltas: {},
  };
}

function round(packId: PackId, questions: RecordedQuestion[], extra: Partial<GameRecord> = {}): GameRecord {
  const players = { a: { name: 'A' }, b: { name: 'B' } };
  return {
    roomCode: 'ROOM',
    packId,
    packTitle: packId,
    durationSecs: 10,
    wagerEnabled: false,
    stealEnabled: false,
    jigsawEnabled: false,
    players,
    scores: { a: 0, b: 0 },
    questions,
    writtenBy: 'host',
    ...extra,
  };
}

function kept(gameId: string, record: GameRecord, finishedAt: string | null = null): KeptRound {
  return { gameId, record, finishedAt: finishedAt ? new Date(finishedAt) : null };
}

describe('formatDouble', () => {
  test('says when the window has no pair', () => {
    const text = formatDouble([kept('one', round('themes', []))]);
    expect(text).toContain('No round in this window names another via doubleOf');
  });

  test('names round one when it is in the window, and when it is not', () => {
    const first = kept('one', round('themes', [], { roomCode: 'AAAA', packTitle: 'Theme Tunes' }), '2026-10-27T08:00:00Z');
    const second = kept(
      'two',
      round('higher', [], { roomCode: 'AAAA', packTitle: 'Higher or Lower', doubleOf: 'one' }),
      '2026-10-27T08:20:00Z',
    );
    const orphan = kept('three', round('higher', [], { doubleOf: 'missing' }));

    const paired = formatDouble([second, first]);
    expect(paired).toContain('round two two');
    expect(paired).toContain('names one');
    expect(paired).toContain('round one one is in this window: Theme Tunes, 2026-10-27 08:00');

    const alone = formatDouble([orphan]);
    expect(alone).toContain('round one missing is not in this window');
  });
});

describe('formatThemes', () => {
  test('gives a hit rate per level, and warns when hard is near 100%', () => {
    const record = round('themes', [
      question(0, 'easy', { a: 0, b: 1 }),
      question(1, 'medium', { a: 1, b: 1 }),
      question(2, 'hard', { a: 0, b: 0 }),
    ]);
    const text = formatThemes([kept('t', record)]);
    expect(text).toContain('easy');
    expect(text).toContain('50%');
    expect(text).toContain('medium');
    expect(text).toContain('0%');
    expect(text).toContain('hard');
    expect(text).toContain('100%');
    expect(text).toContain('Hard is near 100%');
  });

  test('says when Theme Tunes has not been played', () => {
    expect(formatThemes([kept('g', round('higher', []))])).toContain('No Theme Tunes round');
  });
});

describe('formatHigher', () => {
  test('reads 70% as inside the band and 40% as a re-band', () => {
    const inside = round('higher', [
      question(0, 'easy', { a: 0, b: 0, c: 0, d: 0, e: 0, f: 0, g: 0, h: 1, i: 1, j: 1 }),
    ], {
      players: Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].map((uid) => [uid, { name: uid }])),
    });
    expect(formatHigher([kept('h', inside)])).toContain('70% right (7/10 answers)');
    expect(formatHigher([kept('h', inside)])).toContain('Inside 55–85.');

    const outside = round('higher', [
      question(0, 'easy', { a: 0, b: 0, c: 0, d: 0, e: 1, f: 1, g: 1, h: 1, i: 1, j: 1 }),
    ], {
      players: Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].map((uid) => [uid, { name: uid }])),
    });
    expect(formatHigher([kept('h', outside)])).toContain('40% right (4/10 answers)');
    expect(formatHigher([kept('h', outside)])).toContain('re-band');
  });

  test('says when Higher or Lower has not been played', () => {
    expect(formatHigher([])).toContain('No Higher or Lower round');
  });
});

describe('formatCass', () => {
  test('prints her lines, and says when there are none', () => {
    expect(formatCass(['cass line'], 40)).toContain('cass line');
    expect(formatCass([], 40)).toContain('No trace of hers in the last 40');
  });
});

describe('formatGeekend', () => {
  test('says when the asked collection is empty', () => {
    const text = formatGeekend([], {});
    expect(text).toContain(`seasons/${GEEKEND_SEASON}/asked is empty`);
    expect(GEEKEND_SEASON).toBe('season-2-geekend');
  });

  test('reports a doc that exists, and the office count beside it', () => {
    const text = formatGeekend(
      [{ packId: 'themes', ids: 15 }, { packId: 'higher', ids: null }],
      { themes: 40, higher: null },
    );
    expect(text).toContain('themes: Geekend doc exists, 15 ids');
    expect(text).toContain('season-2/asked/themes has 40 ids');
    expect(text).toContain('higher: Geekend doc exists, ids unreadable');
    expect(text).toContain('season-2/asked/higher is absent');
    expect(text).toContain('cannot show that the office document was left unchanged');
  });
});

describe('formatOwedChecks', () => {
  test('prints the five owed sections, in the handover\'s order', () => {
    const text = formatOwedChecks({
      last: 40,
      games: [],
      gamesUnreadable: 0,
      cassLines: [],
      tracesRead: 0,
      geekendAsked: [],
      officeAsked: {},
    });
    const headings = [
      'The Double',
      'Theme Tunes, hit rate by level',
      'Higher or Lower',
      'Cass, question one',
      'Geekend asked',
    ];
    const positions = headings.map((heading) => text.indexOf(heading));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(text.startsWith('Owed live checks — last 40 kept rounds')).toBe(true);
  });
});
