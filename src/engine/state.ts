import type { Difficulty, PackId, Question } from '../questions/types';

export type Phase = 'lobby' | 'question' | 'reveal' | 'scoreboard' | 'finished';

/** How long players get to answer, in milliseconds. */
export const QUESTION_DURATION_MS = 20_000;

export interface Player {
  name: string;
  joinedAt: number;
}

export interface Answer {
  optionIndex: number;
  /**
   * Milliseconds between the question appearing and the tap, measured on the
   * answering player's own device. Storing elapsed time rather than an absolute
   * timestamp means mismatched laptop clocks cannot distort speed scores.
   */
  elapsedMs: number;
}

/**
 * A question with its answer order already fixed. Options are shuffled once,
 * when the quizmaster loads a pack, and stored in the room — so every device
 * renders the same four tiles in the same order and "option 2" means one thing.
 */
export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  category: string;
  difficulty: Difficulty;
}

export interface RoomState {
  code: string;
  phase: Phase;
  /**
   * Keyed by uid so concurrent joins write disjoint Firestore field paths
   * instead of racing to overwrite one array.
   */
  players: Record<string, Player>;
  packId: PackId | null;
  packTitle: string | null;
  questions: QuizQuestion[];
  index: number;
  /** When the current question opened, for speed scoring. Null outside 'question'. */
  questionOpenedAt: number | null;
  /** Answers to the current question only, keyed by player uid. */
  answers: Record<string, Answer>;
  /** Cumulative score per player uid. */
  scores: Record<string, number>;
  /** Points gained on the most recent question, for the reveal animation. */
  lastDeltas: Record<string, number>;
  /** Ids of questions the quizmaster threw out, so they never score. */
  skipped: string[];
}

export function createRoom(code: string): RoomState {
  return {
    code,
    phase: 'lobby',
    players: {},
    packId: null,
    packTitle: null,
    questions: [],
    index: 0,
    questionOpenedAt: null,
    answers: {},
    scores: {},
    lastDeltas: {},
    skipped: [],
  };
}

export function currentQuestion(state: RoomState): QuizQuestion | null {
  return state.questions[state.index] ?? null;
}

/**
 * The quizmaster is derived, never stored: it is whoever has been in the room
 * longest. Deriving it means a disconnect needs no reassignment write, so
 * several clients noticing the same departure cannot race each other.
 * Ties break on uid so every client independently agrees.
 */
export function resolveQuizmaster(players: Record<string, Player>): string | null {
  let best: { uid: string; joinedAt: number } | null = null;

  for (const [uid, player] of Object.entries(players)) {
    if (best === null || player.joinedAt < best.joinedAt) {
      best = { uid, joinedAt: player.joinedAt };
    } else if (player.joinedAt === best.joinedAt && uid < best.uid) {
      best = { uid, joinedAt: player.joinedAt };
    }
  }

  return best?.uid ?? null;
}

export function isQuizmaster(state: RoomState, uid: string): boolean {
  return resolveQuizmaster(state.players) === uid;
}

/** A random source in [0, 1). Injectable so tests can pin the shuffle. */
export type Rng = () => number;

/** Fisher–Yates. Returns a new array; the input is untouched. */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const a = result[i];
    const b = result[j];
    if (a === undefined || b === undefined) continue;
    result[i] = b;
    result[j] = a;
  }
  return result;
}

/**
 * Picks `count` questions at random and freezes their answer order.
 * Returns fewer than `count` if the pool is smaller.
 */
export function buildQuizQuestions(
  pool: readonly Question[],
  count: number,
  rng: Rng = Math.random,
): QuizQuestion[] {
  return shuffle(pool, rng)
    .slice(0, Math.max(0, count))
    .map((question) => {
      const options = shuffle([question.correct, ...question.incorrect], rng);
      return {
        id: question.id,
        prompt: question.question,
        options,
        correctIndex: options.indexOf(question.correct),
        category: question.category,
        difficulty: question.difficulty,
      };
    });
}
