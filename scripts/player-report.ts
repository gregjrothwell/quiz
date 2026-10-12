import { TOO_FAST_TO_READ_MS } from '../src/engine/answers';
import type { GameRecord, RecordedAnswer, RecordedQuestion } from '../src/engine/gameRecord';
import { median } from './game-report';

/**
 * The arithmetic behind `npm run audit-players`, kept pure so `npm test`
 * covers it offline. `player-audit.ts` only fetches documents and prints.
 *
 * Implied delay is `(at − openedAt) − elapsedMs`. The record does not keep
 * `openedAt`, so each question's openedAt is estimated as the median of
 * `at − elapsedMs` across answers that carry `at`. Honest writes cluster
 * near zero; a floored `elapsedMs` shows up as a large positive delay
 * relative to the room.
 */

export interface PlayerStats {
  name: string;
  uids: string[];
  rounds: number;
  answers: number;
  correct: number;
  hitRate: number | null;
  medianElapsedMs: number | null;
  medianElapsedRightMs: number | null;
  medianElapsedWrongMs: number | null;
  /** Right median minus wrong median. Null when either side has no answers. */
  rightWrongGapMs: number | null;
  sub1s: number;
  medianImpliedDelayMs: number | null;
  delaysObserved: number;
}

export interface ScoreIntegrity {
  gameId: string;
  uid: string;
  stored: number;
  summed: number;
}

export interface SeasonRow {
  name: string;
  points: number;
  played: number;
}

export interface SeasonCompare {
  name: string;
  seasonPoints: number | null;
  scoredInGames: number;
  gamesPlayed: number;
  seasonPlayed: number | null;
}

function rate(correct: number, over: number): number | null {
  return over === 0 ? null : correct / over;
}

function openedAtEstimate(answers: RecordedAnswer[]): number | null {
  return median(
    answers.flatMap((answer) => (answer.at === undefined ? [] : [answer.at - answer.elapsedMs])),
  );
}

function impliedDelayMs(answer: RecordedAnswer, openedAtEst: number): number | null {
  if (answer.at === undefined) return null;
  return answer.at - openedAtEst - answer.elapsedMs;
}

function isCorrect(question: RecordedQuestion, answer: RecordedAnswer): boolean {
  return question.correctIndex !== null && answer.optionIndex === question.correctIndex;
}

interface Accumulator {
  uids: Set<string>;
  gameIds: Set<string>;
  answers: number;
  correct: number;
  elapsed: number[];
  elapsedRight: number[];
  elapsedWrong: number[];
  sub1s: number;
  delays: number[];
}

function emptyAcc(): Accumulator {
  return {
    uids: new Set(),
    gameIds: new Set(),
    answers: 0,
    correct: 0,
    elapsed: [],
    elapsedRight: [],
    elapsedWrong: [],
    sub1s: 0,
    delays: [],
  };
}

function toStats(name: string, acc: Accumulator): PlayerStats {
  const medianRight = median(acc.elapsedRight);
  const medianWrong = median(acc.elapsedWrong);
  return {
    name,
    uids: [...acc.uids].sort(),
    rounds: acc.gameIds.size,
    answers: acc.answers,
    correct: acc.correct,
    hitRate: rate(acc.correct, acc.answers),
    medianElapsedMs: median(acc.elapsed),
    medianElapsedRightMs: medianRight,
    medianElapsedWrongMs: medianWrong,
    rightWrongGapMs:
      medianRight === null || medianWrong === null ? null : medianRight - medianWrong,
    sub1s: acc.sub1s,
    medianImpliedDelayMs: median(acc.delays),
    delaysObserved: acc.delays.length,
  };
}

export function tallyPlayers(records: { gameId: string; record: GameRecord }[]): PlayerStats[] {
  const byName = new Map<string, Accumulator>();

  for (const { gameId, record } of records) {
    for (const [uid, player] of Object.entries(record.players)) {
      const acc = byName.get(player.name) ?? emptyAcc();
      acc.uids.add(uid);
      acc.gameIds.add(gameId);
      byName.set(player.name, acc);
    }

    for (const question of record.questions) {
      if (question.skipped) continue;
      const openedAtEst = openedAtEstimate(Object.values(question.answers));
      for (const [uid, answer] of Object.entries(question.answers)) {
        const name = record.players[uid]?.name;
        if (name === undefined) continue;
        const acc = byName.get(name) ?? emptyAcc();
        acc.answers += 1;
        const right = isCorrect(question, answer);
        if (right) acc.correct += 1;
        acc.elapsed.push(answer.elapsedMs);
        if (right) acc.elapsedRight.push(answer.elapsedMs);
        else acc.elapsedWrong.push(answer.elapsedMs);
        if (answer.elapsedMs < TOO_FAST_TO_READ_MS) acc.sub1s += 1;
        if (openedAtEst !== null) {
          const delay = impliedDelayMs(answer, openedAtEst);
          if (delay !== null) acc.delays.push(delay);
        }
        byName.set(name, acc);
      }
    }
  }

  return [...byName.entries()]
    .map(([name, acc]) => toStats(name, acc))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Stored `scores` versus the sum of `deltas` on questions that were not
 * skipped. A mismatch means somebody wrote the scores map directly.
 */
export function scoreIntegrity(
  records: { gameId: string; record: GameRecord }[],
): ScoreIntegrity[] {
  const mismatches: ScoreIntegrity[] = [];
  for (const { gameId, record } of records) {
    const summed: Record<string, number> = {};
    for (const question of record.questions) {
      if (question.skipped) continue;
      for (const [uid, delta] of Object.entries(question.deltas)) {
        summed[uid] = (summed[uid] ?? 0) + delta;
      }
    }
    const uids = new Set([...Object.keys(record.scores), ...Object.keys(summed)]);
    for (const uid of uids) {
      const stored = record.scores[uid] ?? 0;
      const total = summed[uid] ?? 0;
      if (stored !== total) mismatches.push({ gameId, uid, stored, summed: total });
    }
  }
  return mismatches;
}

export function compareSeason(
  stats: PlayerStats[],
  rows: SeasonRow[],
  scoredByName: Record<string, number>,
): SeasonCompare[] {
  const names = new Set([...stats.map((row) => row.name), ...rows.map((row) => row.name)]);
  const seasonByName = new Map<string, SeasonRow>();
  for (const row of rows) {
    const held = seasonByName.get(row.name);
    if (held === undefined) seasonByName.set(row.name, row);
    else {
      seasonByName.set(row.name, {
        name: row.name,
        points: held.points + row.points,
        played: held.played + row.played,
      });
    }
  }

  return [...names]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => {
      const season = seasonByName.get(name);
      const player = stats.find((row) => row.name === name);
      return {
        name,
        seasonPoints: season?.points ?? null,
        scoredInGames: scoredByName[name] ?? 0,
        gamesPlayed: player?.rounds ?? 0,
        seasonPlayed: season?.played ?? null,
      };
    });
}

export function scoredByName(records: { gameId: string; record: GameRecord }[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const { record } of records) {
    for (const [uid, player] of Object.entries(record.players)) {
      totals[player.name] = (totals[player.name] ?? 0) + (record.scores[uid] ?? 0);
    }
  }
  return totals;
}
