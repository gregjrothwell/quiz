import { TOO_FAST_TO_READ_MS, firstTouchOf } from '../src/engine/answers';
import type {
  GameRecord,
  QuestionKind,
  RecordedAnswer,
  RecordedPlayer,
  RecordedQuestion,
} from '../src/engine/gameRecord';
import { DIFFICULTIES, PACK_IDS, type Difficulty, type PackId } from '../src/questions/types';

/**
 * The arithmetic behind `npm run read-games`, kept pure so `npm test` covers
 * it offline. `read-games.ts` only fetches documents and prints what this says.
 *
 * Two denominators, and the difference matters when reading a melody round:
 *
 * - **Seats** — everybody in the record. A hit rate over seats treats a player
 *   who did not answer as a miss, which is what the room experienced: on
 *   `DTK8` two of eight never scored, and a rate over answers alone would have
 *   hidden them. This is the number `melody-round.md` reasoned with.
 * - **Answers** — only the people who pressed something. Shown beside it, so a
 *   question nobody attempted reads as nobody attempted it rather than as
 *   everybody getting it wrong.
 */

export const KINDS = ['text', 'melody', 'picture'] as const satisfies readonly QuestionKind[];

export interface QuestionSummary {
  index: number;
  id: string;
  kind: QuestionKind;
  difficulty: Difficulty;
  skipped: boolean;
  seats: number;
  answered: number;
  correct: number;
  /** Correct over seats, 0–1. Null for a skipped question. */
  hitRate: number | null;
  /** Over every answer given, right or wrong. Null when nobody answered. */
  medianElapsedMs: number | null;
  /** Answers whose first touch was under `TOO_FAST_TO_READ_MS`. */
  snaps: number;
}

export interface GameSummary {
  gameId: string;
  roomCode: string;
  packId: PackId;
  packTitle: string;
  finishedAt: Date | null;
  durationSecs: number;
  flags: string[];
  seats: number;
  questionCount: number;
  skipped: number;
  questions: QuestionSummary[];
  /** Over the questions that were not skipped, correct over seats. */
  hitRate: number | null;
  medianElapsedMs: number | null;
  snaps: number;
}

export interface KindTally {
  /** Rounds that asked at least one question of this kind. */
  games: number;
  questions: number;
  seats: number;
  answered: number;
  correct: number;
  hitRate: number | null;
  medianElapsedMs: number | null;
  snaps: number;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const upper = sorted[mid];
  const lower = sorted[mid - 1];
  if (upper === undefined) return null;
  return sorted.length % 2 === 1 || lower === undefined ? upper : (lower + upper) / 2;
}

function rate(correct: number, over: number): number | null {
  return over === 0 ? null : correct / over;
}

function elapsedOf(question: RecordedQuestion): number[] {
  return Object.values(question.answers).map((answer) => answer.elapsedMs);
}

export function summariseQuestion(question: RecordedQuestion, seats: number): QuestionSummary {
  const answers = Object.values(question.answers);
  const correct = question.correctIndex === null
    ? 0
    : answers.filter((answer) => answer.optionIndex === question.correctIndex).length;

  return {
    index: question.index,
    id: question.id,
    kind: question.kind,
    difficulty: question.difficulty,
    skipped: question.skipped,
    seats,
    answered: answers.length,
    correct,
    hitRate: question.skipped ? null : rate(correct, seats),
    medianElapsedMs: median(elapsedOf(question)),
    snaps: answers.filter((answer) => firstTouchOf(answer) < TOO_FAST_TO_READ_MS).length,
  };
}

export function summariseGame(
  gameId: string,
  record: GameRecord,
  finishedAt: Date | null,
): GameSummary {
  const seats = Object.keys(record.players).length;
  const questions = record.questions.map((question) => summariseQuestion(question, seats));
  const played = record.questions.filter((question) => !question.skipped);

  const flags: string[] = [];
  if (record.wagerEnabled) flags.push('wager');
  if (record.stealEnabled) flags.push('steal');
  if (record.jigsawEnabled) flags.push('jigsaw');

  return {
    gameId,
    roomCode: record.roomCode,
    packId: record.packId,
    packTitle: record.packTitle,
    finishedAt,
    durationSecs: record.durationSecs,
    flags,
    seats,
    questionCount: record.questions.length,
    skipped: record.questions.length - played.length,
    questions,
    hitRate: rate(
      questions.filter((question) => !question.skipped).reduce((sum, question) => sum + question.correct, 0),
      played.length * seats,
    ),
    medianElapsedMs: median(played.flatMap(elapsedOf)),
    snaps: questions.reduce((sum, question) => sum + question.snaps, 0),
  };
}

/**
 * The melody diagnosis at a glance: how each kind of question plays, across
 * every round read. Skipped questions are left out, since nobody was scored
 * on them.
 */
export function tallyByKind(records: GameRecord[]): Record<QuestionKind, KindTally> {
  const tallies = {} as Record<QuestionKind, KindTally>;

  for (const kind of KINDS) {
    const asked = records.flatMap((record) =>
      record.questions
        .filter((question) => question.kind === kind && !question.skipped)
        .map((question) => ({ question, seats: Object.keys(record.players).length })),
    );
    const summaries = asked.map(({ question, seats }) => summariseQuestion(question, seats));
    const seats = summaries.reduce((sum, summary) => sum + summary.seats, 0);
    const correct = summaries.reduce((sum, summary) => sum + summary.correct, 0);

    tallies[kind] = {
      games: records.filter((record) =>
        record.questions.some((question) => question.kind === kind && !question.skipped),
      ).length,
      questions: summaries.length,
      seats,
      answered: summaries.reduce((sum, summary) => sum + summary.answered, 0),
      correct,
      hitRate: rate(correct, seats),
      medianElapsedMs: median(asked.flatMap(({ question }) => elapsedOf(question))),
      snaps: summaries.reduce((sum, summary) => sum + summary.snaps, 0),
    };
  }

  return tallies;
}

// ── Reading a document back ──────────────────────────────────────────────────
//
// What is in the collection is whatever a client wrote, bounded by the rules
// only at the top level. Parsed field by field on the way out, as `useGameLog`
// parses session storage, so one malformed document is reported and skipped
// rather than taking the whole report down.

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isKind(value: unknown): value is QuestionKind {
  return typeof value === 'string' && (KINDS as readonly string[]).includes(value);
}

function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === 'string' && (DIFFICULTIES as readonly string[]).includes(value);
}

function isPackId(value: unknown): value is PackId {
  return typeof value === 'string' && (PACK_IDS as readonly string[]).includes(value);
}

function parseAnswer(value: unknown): RecordedAnswer | null {
  if (!isObject(value)) return null;
  const { optionIndex, elapsedMs, firstMs, wager } = value;
  if (typeof optionIndex !== 'number' || typeof elapsedMs !== 'number') return null;
  return {
    optionIndex,
    elapsedMs,
    ...(typeof firstMs === 'number' ? { firstMs } : {}),
    ...(typeof wager === 'number' ? { wager } : {}),
  };
}

function parseNumbers(value: unknown): Record<string, number> | null {
  if (!isObject(value)) return null;
  const numbers: Record<string, number> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== 'number') return null;
    numbers[key] = entry;
  }
  return numbers;
}

function parseQuestion(value: unknown): RecordedQuestion | null {
  if (!isObject(value)) return null;
  const { id, index, category, difficulty, kind, correctIndex, skipped, answers, deltas } = value;
  if (typeof id !== 'string' || typeof index !== 'number' || typeof category !== 'string') return null;
  if (!isDifficulty(difficulty) || !isKind(kind) || typeof skipped !== 'boolean') return null;
  if (correctIndex !== null && typeof correctIndex !== 'number') return null;
  if (!isObject(answers)) return null;

  const parsedAnswers: Record<string, RecordedAnswer> = {};
  for (const [uid, entry] of Object.entries(answers)) {
    const answer = parseAnswer(entry);
    if (!answer) return null;
    parsedAnswers[uid] = answer;
  }
  const parsedDeltas = parseNumbers(deltas);
  if (!parsedDeltas) return null;

  return {
    id,
    index,
    category,
    difficulty,
    kind,
    correctIndex,
    skipped,
    answers: parsedAnswers,
    deltas: parsedDeltas,
  };
}

function parsePlayers(value: unknown): Record<string, RecordedPlayer> | null {
  if (!isObject(value)) return null;
  const players: Record<string, RecordedPlayer> = {};
  for (const [uid, entry] of Object.entries(value)) {
    if (!isObject(entry) || typeof entry.name !== 'string') return null;
    players[uid] = {
      name: entry.name,
      ...(typeof entry.squad === 'string' ? { squad: entry.squad } : {}),
    };
  }
  return players;
}

/** A stored document as a `GameRecord`, or null with no guessing. */
export function parseGameRecord(value: unknown): GameRecord | null {
  if (!isObject(value)) return null;
  const {
    roomCode, packId, packTitle, durationSecs, wagerEnabled, stealEnabled, jigsawEnabled,
    players, scores, questions, writtenBy,
  } = value;

  if (typeof roomCode !== 'string' || !isPackId(packId) || typeof packTitle !== 'string') return null;
  if (typeof durationSecs !== 'number' || typeof writtenBy !== 'string') return null;
  if (typeof wagerEnabled !== 'boolean' || typeof stealEnabled !== 'boolean' || typeof jigsawEnabled !== 'boolean') {
    return null;
  }
  if (!Array.isArray(questions)) return null;

  const parsedPlayers = parsePlayers(players);
  const parsedScores = parseNumbers(scores);
  if (!parsedPlayers || !parsedScores) return null;

  const parsedQuestions: RecordedQuestion[] = [];
  for (const entry of questions) {
    const question = parseQuestion(entry);
    if (!question) return null;
    parsedQuestions.push(question);
  }

  return {
    roomCode,
    packId,
    packTitle,
    durationSecs,
    wagerEnabled,
    stealEnabled,
    jigsawEnabled,
    players: parsedPlayers,
    scores: parsedScores,
    questions: parsedQuestions,
    writtenBy,
  };
}
