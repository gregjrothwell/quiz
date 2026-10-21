import { isStandoffPick, type Standoff, type StandoffPick } from './standoff';

/**
 * What one player has done in Share or Shaft finals, as four counts on the
 * season row.
 *
 * *Shared* and *shafted* are the picks that counted, after the whistle. A pick
 * nobody made is a no-pick, not a share: the payout treats it as share, but the
 * room saw "No pick", and the line says what the room saw. No-pick is the
 * remainder, `finals - shared - shafted`, so it is not a fifth field.
 *
 * *Got shafted* is the opponent's counted pick being shaft. Both shafting
 * counts for both of them.
 */
export interface FinalsTally {
  finals: number;
  shared: number;
  shafted: number;
  gotShafted: number;
}

export const EMPTY_FINALS: FinalsTally = {
  finals: 0,
  shared: 0,
  shafted: 0,
  gotShafted: 0,
};

/**
 * One finalist's counted final. `pick` and `opponent` are what counted after
 * the whistle; null is a no-pick. Absent on {@link GameOutcome} means they
 * were not in the final at all, which is a different fact from a no-pick.
 */
export interface CountedFinal {
  pick: StandoffPick | null;
  opponent: StandoffPick | null;
}

/**
 * What this player did in the final, or nothing.
 *
 * Nothing when there is no final, it has not been settled, or `uid` was not
 * one of the two. The picks on a settled standoff are already only the ones
 * that counted: a commitment after the whistle is stored as null.
 */
export function finalFor(standoff: Standoff | null, uid: string): CountedFinal | null {
  if (!standoff?.picks || !standoff.finalists.includes(uid)) return null;
  const other = standoff.finalists.find((id) => id !== uid);
  if (other === undefined) return null;
  return {
    pick: countedPick(standoff.picks[uid]),
    opponent: countedPick(standoff.picks[other]),
  };
}

function countedPick(value: StandoffPick | null | undefined): StandoffPick | null {
  return isStandoffPick(value) ? value : null;
}

/** The four counts for one counted final. A no-pick increments only `finals`. */
export function countOf(counted: CountedFinal): FinalsTally {
  return {
    finals: 1,
    shared: counted.pick === 'share' ? 1 : 0,
    shafted: counted.pick === 'shaft' ? 1 : 0,
    gotShafted: counted.opponent === 'shaft' ? 1 : 0,
  };
}

export function addFinals(left: FinalsTally, right: FinalsTally): FinalsTally {
  return {
    finals: left.finals + right.finals,
    shared: left.shared + right.shared,
    shafted: left.shafted + right.shafted,
    gotShafted: left.gotShafted + right.gotShafted,
  };
}

/**
 * Reads the four fields off a stored row. Anything that is not a whole number
 * ≥ 0 counts as zero, which is also what an absent field means: a row from
 * before this existed, and a read that came back without them.
 */
export function tallyOf(
  record: {
    finals?: unknown;
    shared?: unknown;
    shafted?: unknown;
    gotShafted?: unknown;
  } | null | undefined,
): FinalsTally {
  return {
    finals: wholeCount(record?.finals),
    shared: wholeCount(record?.shared),
    shafted: wholeCount(record?.shafted),
    gotShafted: wholeCount(record?.gotShafted),
  };
}

function wholeCount(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;
}

/**
 * The record coming into tonight, plus tonight once the seats have settled.
 * `counted` null leaves the record as it was read.
 */
export function withTonight(coming: FinalsTally, counted: CountedFinal | null): FinalsTally {
  return counted ? addFinals(coming, countOf(counted)) : coming;
}

/**
 * The bounds `firestore.rules` puts on the four fields. Kept here so a bank
 * and the backfill can refuse the same row the rules would, rather than
 * finding out at the next game.
 *
 * Absent is zero before this is called. `shared + shafted <= finals` is what
 * leaves room for no-picks.
 */
export function finalsBoundsOk(played: number, tally: FinalsTally): boolean {
  if (!Number.isInteger(played) || played < 0) return false;
  const { finals, shared, shafted, gotShafted } = tally;
  if (![finals, shared, shafted, gotShafted].every((count) => Number.isInteger(count) && count >= 0)) {
    return false;
  }
  return finals <= played && shared + shafted <= finals && gotShafted <= finals;
}

/**
 * The seat line. `First final` for none, `1 final` for one, and `· no pick N`
 * only when N is above zero. Zeros of the other counts stay, because "never
 * been shafted" is part of the argument.
 */
export function finalsLine(tally: FinalsTally): string {
  if (tally.finals <= 0) return 'First final';
  const finals = tally.finals === 1 ? '1 final' : `${tally.finals} finals`;
  const line = `${finals} · shared ${tally.shared} · shafted ${tally.shafted} · got shafted ${tally.gotShafted}`;
  const noPick = tally.finals - tally.shared - tally.shafted;
  return noPick > 0 ? `${line} · no pick ${noPick}` : line;
}
