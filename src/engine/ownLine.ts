import { morningTotals } from './double';
import { boardMoves } from './movement';
import { roomStandings } from './scoring';
import { currentQuestion, type RoomState } from './state';
import { isTell } from './survey';
import { ordinal } from './wrapped';

/**
 * Your own line at a reveal (PROJ-182, criterion 1): where you are now, and how
 * that question moved you. The points are beside it already, in the verdict.
 *
 * Worked out from what every device holds — the scores and what the question
 * paid — so a reload says the same, and it is the table's own arithmetic:
 * {@link boardMoves} for the movement, the morning for the second half of a
 * Double. The line and the table cannot disagree.
 */
export interface OwnLine {
  place: number;
  /** Somebody else holds this place too. */
  joint: boolean;
  /**
   * Places climbed (positive) or dropped (negative). Null when nobody had scored
   * before this question: everyone was joint first on nothing, and "4th, down
   * three" would be telling somebody about a fall from a table nobody saw.
   */
  moved: number | null;
}

export function ownLine(room: RoomState, uid: string | null): OwnLine | null {
  if (uid === null) return null;
  const question = currentQuestion(room);
  // A tell scores nobody, so it has nothing to say about anybody's place.
  if (!question || isTell(question)) return null;

  const totals = morningTotals(room);
  const board = roomStandings(room.players, totals);
  const mine = board.find((entry) => entry.uid === uid);
  // A board with nothing on it has no places: everyone is "joint 1st".
  if (!mine || board.every((entry) => entry.score === 0)) return null;

  const hadScored = board.some((entry) => entry.score - (room.lastDeltas[entry.uid] ?? 0) !== 0);
  const { moves } = boardMoves(room.players, totals, room.lastDeltas);
  return {
    place: mine.position,
    joint: board.filter((entry) => entry.position === mine.position).length > 1,
    moved: hadScored ? (moves[uid] ?? 0) : null,
  };
}

const COUNTS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'] as const;

function inWords(count: number): string {
  return COUNTS[count] ?? String(count);
}

/** "3rd, up one", "still joint 1st", "2nd". */
export function ownLineWords({ place, joint, moved }: OwnLine): string {
  const where = `${joint ? 'joint ' : ''}${ordinal(place)}`;
  if (moved === null) return where;
  if (moved === 0) return `still ${where}`;
  return `${where}, ${moved > 0 ? 'up' : 'down'} ${inWords(Math.abs(moved))}`;
}
