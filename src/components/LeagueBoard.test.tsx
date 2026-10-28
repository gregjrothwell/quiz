import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import type { SeasonRow } from '../lib/season';
import { LeagueBoard } from './LeagueBoard';

function row(overrides: Partial<SeasonRow> & Pick<SeasonRow, 'playerId' | 'name'>): SeasonRow {
  return {
    played: 4,
    wins: 1,
    points: 8_000,
    best: 3_000,
    form: 8_000,
    squad: '',
    fastest: 0,
    comeback: 0,
    loneWolf: 0,
    contrarian: 0,
    ...overrides,
  };
}

describe('the season caption', () => {
  test('names who you have beaten and lost to most', () => {
    render(
      <LeagueBoard
        youPlayerId="greg"
        rows={[
          row({
            playerId: 'greg',
            name: 'Greg',
            rivals: {
              sam: { name: 'Sam', beaten: 4, lost: 1 },
              priya: { name: 'Priya', beaten: 1, lost: 3 },
            },
          }),
        ]}
      />,
    );

    expect(screen.getByText(
      'You’ve beaten Sam most this season — 4 times, and lost to Priya most — 3 times.',
    )).toBeTruthy();
  });

  test('says nothing when the season has no decisive result, or the row is not yours', () => {
    const { rerender } = render(
      <LeagueBoard
        youPlayerId="greg"
        rows={[row({ playerId: 'greg', name: 'Greg' })]}
      />,
    );
    expect(screen.queryByText(/most this season/)).toBeNull();

    rerender(
      <LeagueBoard
        youPlayerId="greg"
        rows={[row({
          playerId: 'sam',
          name: 'Sam',
          rivals: { greg: { name: 'Greg', beaten: 2, lost: 0 } },
        })]}
      />,
    );
    expect(screen.queryByText(/most this season/)).toBeNull();
  });

  test('names both people when the lead is shared', () => {
    render(
      <LeagueBoard
        youPlayerId="greg"
        rows={[row({
          playerId: 'greg',
          name: 'Greg',
          rivals: {
            sam: { name: 'Sam', beaten: 2, lost: 0 },
            alex: { name: 'Alex', beaten: 2, lost: 0 },
          },
        })]}
      />,
    );

    expect(screen.getByText('You’ve beaten Alex & Sam most this season — 2 times each.')).toBeTruthy();
  });
});
