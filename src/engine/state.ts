import { DIFFICULTIES, type Difficulty, type PackId, type Question } from '../questions/types';

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
  /**
   * Minted fresh every time a round starts. The season table records which game
   * it last counted for a player, so a reload on the final screen — or a second
   * client for the same uid — cannot bank the same result twice. Null until the
   * first round begins.
   */
  gameId: string | null;
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
    gameId: null,
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
 * What the quizmaster asked for. `mixed` takes the pack as it comes — which is
 * what every round did before this was selectable — and `ramp` builds from
 * gentle to fiendish across the round.
 */
export type Level = Difficulty | 'mixed' | 'ramp';

export const LEVELS = ['mixed', 'easy', 'medium', 'hard', 'ramp'] as const;

/** Share of a ramped round spent at each end before the middle takes the rest. */
const RAMP_EDGE_SHARE = 0.3;

const DIFFICULTY_RANK: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 };

/**
 * How many questions of each level a ramped round of `count` aims for. The
 * middle takes whatever the two ends leave, so the three always sum to `count`.
 */
export function rampPlan(count: number): Record<Difficulty, number> {
  const wanted = Math.max(0, count);
  const easy = Math.round(wanted * RAMP_EDGE_SHARE);
  const hard = Math.round(wanted * RAMP_EDGE_SHARE);
  return { easy, hard, medium: Math.max(0, wanted - easy - hard) };
}

function bucketByDifficulty(
  pool: readonly Question[],
  rng: Rng,
): Record<Difficulty, Question[]> {
  return {
    easy: shuffle(pool.filter((question) => question.difficulty === 'easy'), rng),
    medium: shuffle(pool.filter((question) => question.difficulty === 'medium'), rng),
    hard: shuffle(pool.filter((question) => question.difficulty === 'hard'), rng),
  };
}

/**
 * A round that climbs. Takes the planned share of each level, then tops up from
 * whatever is left over if a level ran short — a pack with no hard questions
 * still yields a full-length round rather than a truncated one. The final sort
 * is stable, so the shuffle within each level survives it.
 */
function buildRamp(pool: readonly Question[], count: number, rng: Rng): Question[] {
  const buckets = bucketByDifficulty(pool, rng);
  const plan = rampPlan(count);
  const picked: Question[] = [];

  for (const level of DIFFICULTIES) {
    picked.push(...buckets[level].splice(0, plan[level]));
  }

  // Draw the shortfall from whichever level still has the most to give, so a
  // thin pack degrades towards its own shape instead of towards one level.
  while (picked.length < count) {
    const fullest = DIFFICULTIES.reduce((best, level) =>
      buckets[level].length > buckets[best].length ? level : best,
    );
    const next = buckets[fullest].shift();
    if (!next) break;
    picked.push(next);
  }

  return picked.sort((a, b) => DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty]);
}

/**
 * Chooses which questions a round is made of, in the order they will be asked.
 * Returns fewer than `count` only when the pool genuinely cannot supply them.
 */
export function selectQuestions(
  pool: readonly Question[],
  count: number,
  level: Level = 'mixed',
  rng: Rng = Math.random,
): Question[] {
  const wanted = Math.max(0, count);
  if (wanted === 0) return [];
  if (level === 'ramp') return buildRamp(pool, wanted, rng);

  const eligible = level === 'mixed' ? pool : pool.filter((q) => q.difficulty === level);
  return shuffle(eligible, rng).slice(0, wanted);
}

/**
 * Picks the questions for a round and freezes their answer order.
 * Returns fewer than `count` if the pool cannot fill it.
 */
export function buildQuizQuestions(
  pool: readonly Question[],
  count: number,
  level: Level = 'mixed',
  rng: Rng = Math.random,
): QuizQuestion[] {
  return selectQuestions(pool, count, level, rng).map((question) => {
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
