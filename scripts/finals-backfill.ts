import {
  EMPTY_FINALS,
  addFinals,
  countOf,
  finalsBoundsOk,
  type CountedFinal,
  type FinalsTally,
} from '../src/engine/finals';
import type { StandoffPick } from '../src/engine/standoff';

/**
 * The only bucket this backfill writes. Week rows and `season-1` are not the
 * record on the seat, and a write there would be a row the screen never reads.
 * Hardcoded rather than imported from `src/lib/season.ts`, which reaches
 * `src/firebase.ts`.
 */
export const BACKFILL_SEASON = 'season-2';

export interface KeptPlayer {
  standoff?: { pick?: unknown };
}

export interface KeptGame {
  id: string;
  players: Record<string, KeptPlayer>;
}

export interface SeasonFinalsRow {
  id: string;
  name: string;
  played: unknown;
  finals: unknown;
  shared: unknown;
  shafted: unknown;
  gotShafted: unknown;
}

export type BackfillPlan =
  | { action: 'write'; id: string; name: string; before: FinalsTally; after: FinalsTally }
  | { action: 'unchanged'; id: string; name: string; tally: FinalsTally }
  | { action: 'refuse'; id: string; name: string; reason: string }
  | { action: 'missing'; id: string };

export function backfillWillWrite(argv: readonly string[]): boolean {
  return argv.includes('--go');
}

/**
 * Counts every settled final in `games/`. A round with no final is ignored.
 * A document that looks like a final but is not exactly two countable picks
 * is skipped whole, rather than half-counted onto somebody's row.
 */
export function tallyKeptFinals(games: readonly KeptGame[]): {
  tallies: Map<string, FinalsTally>;
  skipped: string[];
} {
  const tallies = new Map<string, FinalsTally>();
  const skipped: string[] = [];

  for (const game of games) {
    const seated = Object.entries(game.players).filter(([, player]) => player.standoff !== undefined);
    if (seated.length === 0) continue;
    if (seated.length !== 2) {
      skipped.push(game.id);
      continue;
    }

    const parsed: { uid: string; pick: StandoffPick | null }[] = [];
    let malformed = false;
    for (const [uid, player] of seated) {
      const pick = parsePick(player.standoff?.pick);
      if (pick === undefined) {
        malformed = true;
        break;
      }
      parsed.push({ uid, pick });
    }
    if (malformed || parsed.length !== 2) {
      skipped.push(game.id);
      continue;
    }

    const [first, second] = parsed;
    if (!first || !second) continue;
    addPair(tallies, first, second);
    addPair(tallies, second, first);
  }

  return { tallies, skipped };
}

function addPair(
  tallies: Map<string, FinalsTally>,
  player: { uid: string; pick: StandoffPick | null },
  opponent: { uid: string; pick: StandoffPick | null },
): void {
  const counted: CountedFinal = { pick: player.pick, opponent: opponent.pick };
  const held = tallies.get(player.uid) ?? EMPTY_FINALS;
  tallies.set(player.uid, addFinals(held, countOf(counted)));
}

function parsePick(value: unknown): StandoffPick | null | undefined {
  if (value === 'share' || value === 'shaft' || value === null) return value;
  return undefined;
}

/**
 * What to write onto season rows. Never lowers a count already stored. Refuses
 * a row the rules would refuse, whole, rather than writing the fields that
 * happen to fit — a row that fails `finalsOk` gets that player's next bank
 * refused, which is one person's night lost.
 */
export function planFinalsBackfill(
  tallies: ReadonlyMap<string, FinalsTally>,
  rows: ReadonlyMap<string, SeasonFinalsRow>,
): BackfillPlan[] {
  const plans: BackfillPlan[] = [];

  for (const id of [...tallies.keys()].sort()) {
    const computed = tallies.get(id) ?? EMPTY_FINALS;
    const row = rows.get(id);
    if (!row) {
      plans.push({ action: 'missing', id });
      continue;
    }

    const played = whole(row.played, false);
    const finals = whole(row.finals, true);
    const shared = whole(row.shared, true);
    const shafted = whole(row.shafted, true);
    const gotShafted = whole(row.gotShafted, true);
    if (played === null || finals === null || shared === null || shafted === null || gotShafted === null) {
      plans.push({
        action: 'refuse',
        id,
        name: row.name,
        reason: 'a count already on the row is not a whole number ≥ 0',
      });
      continue;
    }

    const before: FinalsTally = { finals, shared, shafted, gotShafted };
    const after: FinalsTally = {
      finals: Math.max(before.finals, computed.finals),
      shared: Math.max(before.shared, computed.shared),
      shafted: Math.max(before.shafted, computed.shafted),
      gotShafted: Math.max(before.gotShafted, computed.gotShafted),
    };

    if (!finalsBoundsOk(played, after)) {
      plans.push({
        action: 'refuse',
        id,
        name: row.name,
        reason: 'finals ≤ played, shared + shafted ≤ finals, and gotShafted ≤ finals',
      });
      continue;
    }

    const same = (['finals', 'shared', 'shafted', 'gotShafted'] as const).every(
      (field) => after[field] === before[field],
    );
    plans.push(
      same
        ? { action: 'unchanged', id, name: row.name, tally: after }
        : { action: 'write', id, name: row.name, before, after },
    );
  }

  return plans;
}

/** Absent counts as zero when `absentIsZero`. A present value must be a whole number ≥ 0. */
function whole(value: unknown, absentIsZero: boolean): number | null {
  if (value === undefined) return absentIsZero ? 0 : null;
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value;
  return null;
}
