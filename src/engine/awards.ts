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
 * The round as a thing that happened, rather than the players who played it.
 *
 * Which question, and how many people it happened to — facts, on the same
 * principle as {@link Award}. Naming the question is the screen's job, because
 * it is the only side that holds the prompts, and an index cannot be reworded
 * into a lie.
 */
export type Highlight =
  | { id: 'stumper'; index: number; attempts: number }
  | { id: 'sweep'; index: number; attempts: number };

/**
 * Both readings need a room to be true of. One person wrong on their own is a
 * guess rather than a question that beat everybody, and one person right on
 * their own is the lone wolf above, which already has a rosette.
 */
const MIN_ATTEMPTS = 2;

function highlight(
  log: QuestionRecord[],
  qualifies: (correct: number, attempts: number) => boolean,
): { index: number; attempts: number } | null {
  const candidates = log.flatMap((record) => {
    const answers = Object.values(record.answers);
    const correct = answers.filter(
      (answer) => answer.optionIndex === record.correctIndex,
    ).length;

    if (answers.length < MIN_ATTEMPTS || !qualifies(correct, answers.length)) return [];
    return [{ index: record.index, attempts: answers.length }];
  });

  // The one it happened to the most people, and the earliest question when that
  // ties. Sorted rather than taken in the order the log happens to hold, because
  // that order is a property of how this device watched the game — and two
  // screens naming different questions is the failure the awards already avoid.
  candidates.sort((a, b) => b.attempts - a.attempts || a.index - b.index);
  return candidates[0] ?? null;
}

/**
 * What the round did to the room, for a panel beside the rosettes. Costs
 * nothing: the log is already on every device, the same free retelling the
 * replay is built from.
 *
 * A highlight nothing supports is left out rather than shown empty, exactly as
 * {@link awardsFor} does.
 */
export function reviewFor(log: QuestionRecord[]): Highlight[] {
  const stumper = highlight(log, (correct) => correct === 0);
  const sweep = highlight(log, (correct, attempts) => correct === attempts);

  return [
    stumper ? ({ id: 'stumper', ...stumper } as const) : null,
    sweep ? ({ id: 'sweep', ...sweep } as const) : null,
  ].filter((entry): entry is Highlight => entry !== null);
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
