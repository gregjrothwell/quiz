import { currentQuestion, type RoomState } from './state';
import { roomStandings } from './scoring';

/**
 * The Commentator (docs/decisions/commentator.md): one line at a reveal, a
 * scoreboard or the podium, about the people in the room — or nothing.
 *
 * **Everything comes off the room**, so every device says the same words (M3):
 * the reveal's picks, the scores and what this reveal changed, and the season
 * facts the opening titles loaded, carried on the room as `history`. Nothing
 * reads a device's own game log, which is why there are no streak lines — a
 * late joiner's log would disagree, and the screen already says "N in a row"
 * to the player concerned.
 *
 * The words are drafts for Greg to cut (M8). A slot `{name}` is filled from the
 * room; nothing else varies.
 */

export type Moment = 'reveal' | 'scoreboard' | 'podium';

export interface Line {
  /** Which fact, for tests and so the host speaks each line once. */
  fact: string;
  text: string;
}

/** What the titles loaded for each player, kept for the round. */
export interface PlayerHistory {
  played: number;
  wins: number;
  best: number;
}

/** The draft lines, by fact. Each fact rotates through its lines over a round. */
export const LINES: Readonly<Record<string, readonly string[]>> = {
  // At the reveal
  nobody: [
    'Nobody got that. Not one of you.',
    'A clean sweep for the question.',
    'Silence in the studio. Nobody.',
    'That one beat the lot of you.',
  ],
  everybody: [
    'Everybody got that. Every single one.',
    'Full marks all round. Don’t get used to it.',
    'A clean sheet for the office.',
  ],
  lone: [
    'Only {name}. Lone wolf.',
    '{name}, and nobody else.',
    'One right answer in the room, and it was {name}.',
  ],
  split: [
    'Half of you on that one. Half.',
    'Split right down the middle.',
  ],
  // At the scoreboard
  newLeader: [
    'New leader. {name} goes top.',
    '{name} takes the lead.',
    'And {name} is in front.',
  ],
  newLeaderNeverWon: [
    '{name} goes top — and {name} has never won a round.',
    '{name} leads, for a player still after a first win.',
  ],
  neckAndNeck: [
    'Neck and neck at the top.',
    'Barely anything in it at the top.',
    'Too close to call up there.',
  ],
  runaway: [
    '{name} is running away with it.',
    'Somebody catch {name}.',
  ],
  // At the podium
  debutWin: [
    'First round, first win. {name}.',
    '{name}: one round played, one round won.',
  ],
  firstWin: [
    '{name}’s first win. About time.',
    'At last — {name} wins one.',
  ],
  seasonBest: [
    '{name}’s best round of the season.',
    'A season best for {name}.',
  ],
  againWinner: [
    'That’s win number {count} for {name}.',
    '{name} again. That makes {count}.',
  ],
};

/** A lead this small at the top is "neck and neck". */
export const NECK_AND_NECK = 100;
/** A lead this big is "running away with it". */
export const RUNAWAY = 2_000;

function line(fact: string, room: RoomState, slots: Record<string, string> = {}): Line | null {
  const options = LINES[fact];
  if (!options || options.length === 0) return null;
  // Rotates over the round, so the same fact twice in a round is two lines
  // rather than one said twice — until the fact has used all of its lines.
  const text = (options[room.index % options.length] ?? options[0] ?? '').replace(
    /\{(\w+)\}/g,
    (_, key: string) => slots[key] ?? '',
  );
  return { fact, text };
}

function nameOf(room: RoomState, uid: string): string | null {
  return room.players[uid]?.name ?? null;
}

function revealLine(room: RoomState): Line | null {
  const question = currentQuestion(room);
  if (!question || question.correctIndex === null) return null;
  // Survey Says: part one has no right answer, and part two's split is the game (M6).
  if (question.survey) return null;

  const picks = Object.entries(room.lastPicks).filter(([uid]) => room.players[uid]);
  if (picks.length < 2) return null;
  const right = picks.filter(([, pick]) => pick.optionIndex === question.correctIndex).map(([uid]) => uid);

  if (right.length === 0) return line('nobody', room);
  if (right.length === picks.length && picks.length >= 3) return line('everybody', room);
  if (right.length === 1 && picks.length >= 3) {
    const name = nameOf(room, right[0] ?? '');
    return name ? line('lone', room, { name }) : null;
  }
  if (picks.length >= 4 && right.length * 2 === picks.length) return line('split', room);
  return null;
}

function scoreboardLine(room: RoomState): Line | null {
  const now = roomStandings(room.players, room.scores);
  const leader = now[0];
  const second = now[1];
  if (!leader || !second || leader.score <= 0) return null;

  // The table before this reveal: today's scores less what it paid.
  const before = Object.fromEntries(
    Object.entries(room.scores).map(([uid, score]) => [uid, score - (room.lastDeltas[uid] ?? 0)]),
  );
  const wasLeading = roomStandings(room.players, before).filter((row) => row.position === 1).map((row) => row.uid);
  const sole = now.filter((row) => row.position === 1).length === 1;
  const name = nameOf(room, leader.uid);
  if (!name) return null;

  if (room.index > 0 && sole && !wasLeading.includes(leader.uid)) {
    const history = room.history[leader.uid];
    return history && history.played > 0 && history.wins === 0
      ? line('newLeaderNeverWon', room, { name })
      : line('newLeader', room, { name });
  }
  if (leader.score - second.score <= NECK_AND_NECK) return line('neckAndNeck', room);
  if (leader.score - second.score >= RUNAWAY) return line('runaway', room, { name });
  return null;
}

function podiumLine(room: RoomState): Line | null {
  const rows = roomStandings(room.players, room.scores);
  const winners = rows.filter((row) => row.position === 1);
  // A dead heat or a table on zero has no single story to tell.
  if (winners.length !== 1) return null;
  const winner = winners[0];
  if (!winner || winner.score <= 0) return null;
  const name = nameOf(room, winner.uid);
  const history = room.history[winner.uid];
  if (!name || !history) return null;

  if (history.played === 0) return line('debutWin', room, { name });
  if (history.wins === 0) return line('firstWin', room, { name });
  if (history.best > 0 && winner.score > history.best) return line('seasonBest', room, { name });
  return line('againWinner', room, { name, count: String(history.wins + 1) });
}

/** The line for this moment, or null when nothing is worth saying. */
export function commentFor(room: RoomState, moment: Moment): Line | null {
  if (moment === 'reveal') return room.phase === 'reveal' ? revealLine(room) : null;
  if (moment === 'scoreboard') return room.phase === 'scoreboard' ? scoreboardLine(room) : null;
  return room.phase === 'finished' ? podiumLine(room) : null;
}
