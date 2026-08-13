import { standings } from './scoring';
import type { Answer } from './state';

/**
 * One question as it finished.
 *
 * Assembled on each client as the game runs, because nothing keeps it: the
 * answers subcollection holds one document per player and overwrites it every
 * question, and `lastDeltas` only ever describes the last one. By the final
 * screen the game's own record of itself is gone.
 */
export interface QuestionRecord {
  index: number;
  correctIndex: number;
  answers: Record<string, Answer>;
  /** Points actually awarded, as the reveal scored them. */
  deltas: Record<string, number>;
}

/**
 * Facts rather than sentences. The wording belongs to the screen, the same way
 * the lobby owns the names of its levels — an award that has to be reworded
 * should not mean touching the engine or its tests.
 */
export type Award =
  | { id: 'fastest'; uids: string[]; elapsedMs: number }
  | { id: 'lone-wolf'; uids: string[]; count: number }
  | { id: 'contrarian'; uids: string[]; count: number }
  | { id: 'comeback'; uids: string[]; from: number; to: number };

/**
 * Joint winners are sorted so that every device renders the same order. Two
 * players who tie would otherwise be listed by object key order, which differs
 * between clients — and the room would see two versions of the same award.
 */
function winners(tally: Record<string, number>, atLeast: number): { uids: string[]; best: number } {
  let best = -Infinity;
  for (const value of Object.values(tally)) best = Math.max(best, value);
  if (best < atLeast) return { uids: [], best: 0 };

  const uids = Object.entries(tally)
    .filter(([, value]) => value === best)
    .map(([uid]) => uid)
    .sort();

  return { uids, best };
}

/** The quickest correct answer of the night. */
function fastest(log: QuestionRecord[]): Award | null {
  let best = Infinity;
  let uids: string[] = [];

  for (const record of log) {
    for (const [uid, answer] of Object.entries(record.answers)) {
      if (answer.optionIndex !== record.correctIndex) continue;
      if (answer.elapsedMs < best) {
        best = answer.elapsedMs;
        uids = [uid];
      } else if (answer.elapsedMs === best) {
        uids.push(uid);
      }
    }
  }

  // A round where nobody was ever right has no fastest finger, and inventing one
  // from the wrong answers would be a lie told confidently.
  if (uids.length === 0) return null;
  return { id: 'fastest', uids: uids.sort(), elapsedMs: best };
}

/** Questions this player got and nobody else did. */
function loneWolf(log: QuestionRecord[]): Award | null {
  const tally: Record<string, number> = {};

  for (const record of log) {
    const right = Object.entries(record.answers).filter(
      ([, answer]) => answer.optionIndex === record.correctIndex,
    );
    const only = right.length === 1 ? right[0]?.[0] : undefined;
    if (only) tally[only] = (tally[only] ?? 0) + 1;
  }

  const { uids, best } = winners(tally, 1);
  return uids.length > 0 ? { id: 'lone-wolf', uids, count: best } : null;
}

/**
 * Wrong, and wrong on their own — an option nobody else went near. Being wrong
 * with the crowd is a bad question; being wrong by yourself is a decision.
 */
function contrarian(log: QuestionRecord[]): Award | null {
  const tally: Record<string, number> = {};

  for (const record of log) {
    const entries = Object.entries(record.answers);
    for (const [uid, answer] of entries) {
      if (answer.optionIndex === record.correctIndex) continue;
      const shared = entries.some(
        ([other, otherAnswer]) => other !== uid && otherAnswer.optionIndex === answer.optionIndex,
      );
      if (!shared) tally[uid] = (tally[uid] ?? 0) + 1;
    }
  }

  const { uids, best } = winners(tally, 1);
  return uids.length > 0 ? { id: 'contrarian', uids, count: best } : null;
}

/**
 * The biggest climb from the worst position a player ever held to where they
 * finished. Measured against their own low point rather than against the start,
 * because a round that opens badly and a round that collapses in the middle are
 * the same story and both worth telling.
 */
function comeback(log: QuestionRecord[], playerUids: string[]): Award | null {
  const totals: Record<string, number> = {};
  for (const uid of playerUids) totals[uid] = 0;

  const worst: Record<string, number> = {};

  for (const record of log) {
    for (const [uid, delta] of Object.entries(record.deltas)) {
      const running = totals[uid];
      // Scores from somebody who has since left the room are dropped rather
      // than resurrecting them into the standings this walks.
      if (running !== undefined) totals[uid] = running + delta;
    }
    for (const standing of standings(totals)) {
      worst[standing.uid] = Math.max(worst[standing.uid] ?? 0, standing.position);
    }
  }

  const finished: Record<string, number> = {};
  for (const standing of standings(totals)) finished[standing.uid] = standing.position;

  const climbs: Record<string, number> = {};
  for (const uid of playerUids) {
    const from = worst[uid];
    const to = finished[uid];
    if (from === undefined || to === undefined) continue;
    climbs[uid] = from - to;
  }

  const { uids, best } = winners(climbs, 1);
  if (uids.length === 0) return null;

  const to = finished[uids[0] ?? ''] ?? 0;
  return { id: 'comeback', uids, from: to + best, to };
}

/**
 * Every award the game actually earned, in the order they are worth reading.
 * An award nothing supports is left out rather than shown empty — a podium with
 * a blank rosette on it is worse than one without.
 */
export function awardsFor(log: QuestionRecord[], playerUids: string[]): Award[] {
  if (log.length === 0) return [];

  return [
    fastest(log),
    comeback(log, playerUids),
    loneWolf(log),
    contrarian(log),
  ].filter((award): award is Award => award !== null);
}
