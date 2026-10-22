import { squadKey } from './squad';
import type { FinalsTally } from './finals';

/**
 * Quiz Wrapped (docs/decisions/quiz-wrapped.md): five cards about one player's
 * season, from what the season board already holds. Pure — the facts, not the
 * words or the drawing.
 */

/** The day it opens, in the office's own calendar. Greg, 22 October 2026. */
export const WRAPPED_FROM = '2026-12-05';

/** Whether Wrapped is open on this date, read as a local calendar day (W4). */
export function wrappedOpen(now: Date): boolean {
  const local = `${String(now.getFullYear())}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return local >= WRAPPED_FROM;
}

/** The parts of a season row Wrapped reads. `SeasonRow` in `lib/season.ts` has them all. */
export interface WrappedRow {
  playerId: string;
  name: string;
  played: number;
  wins: number;
  points: number;
  best: number;
  squad: string;
  fastest: number;
  comeback: number;
  loneWolf: number;
  contrarian: number;
}

export type RosetteId = 'fastest' | 'comeback' | 'loneWolf' | 'contrarian';

export type WrappedCard =
  | { kind: 'numbers'; played: number; wins: number; points: number; best: number }
  | { kind: 'rosette'; id: RosetteId; count: number }
  | { kind: 'finals'; finals: number; shared: number; shafted: number; gotShafted: number }
  | { kind: 'squad'; squad: string; position: number; of: number }
  | { kind: 'place'; position: number; of: number; top: string[] };

const ROSETTES: readonly RosetteId[] = ['fastest', 'comeback', 'loneWolf', 'contrarian'];

/** 1-based, ties sharing a place, as the board shows them. */
function placeOf<T>(rows: readonly T[], score: (row: T) => number, target: T): number {
  const mine = score(target);
  return rows.filter((row) => score(row) > mine).length + 1;
}

/**
 * The cards, in order. `board` is the season table as the screen shows it
 * (ranked on form). A card with nothing honest to say is left out: no rosette
 * won, no final played, no squad named (W1).
 */
export function wrappedFor(row: WrappedRow, board: readonly WrappedRow[], finals: FinalsTally): WrappedCard[] {
  const cards: WrappedCard[] = [
    { kind: 'numbers', played: row.played, wins: row.wins, points: row.points, best: row.best },
  ];

  // The rosette you won most; a tie goes to the order the awards are shown in.
  let rosette: { id: RosetteId; count: number } | null = null;
  for (const id of ROSETTES) {
    const count = row[id];
    if (count > 0 && (!rosette || count > rosette.count)) rosette = { id, count };
  }
  if (rosette) cards.push({ kind: 'rosette', ...rosette });

  if (finals.finals > 0) cards.push({ kind: 'finals', ...finals });

  if (row.squad) {
    const squads = new Map<string, { squad: string; points: number; players: number }>();
    for (const each of board) {
      if (!each.squad) continue;
      const key = squadKey(each.squad);
      const held = squads.get(key) ?? { squad: each.squad, points: 0, players: 0 };
      held.points += each.points;
      held.players += 1;
      squads.set(key, held);
    }
    const table = [...squads.entries()].map(([key, held]) => ({ key, squad: held.squad, average: held.points / held.players }));
    const mine = table.find((entry) => entry.key === squadKey(row.squad));
    if (mine) {
      cards.push({
        kind: 'squad',
        squad: mine.squad,
        position: placeOf(table, (entry) => entry.average, mine),
        of: table.length,
      });
    }
  }

  const index = board.findIndex((entry) => entry.playerId === row.playerId);
  if (index >= 0) {
    cards.push({
      kind: 'place',
      position: index + 1,
      of: board.length,
      top: board.slice(0, 3).map((entry) => entry.name),
    });
  }
  return cards;
}

/** "1st", "2nd", "3rd", "11th". */
export function ordinal(n: number): string {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${String(n)}${suffix}`;
}
