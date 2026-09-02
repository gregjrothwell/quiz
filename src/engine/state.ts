import type { FormFact } from './form';
import {
  DIFFICULTIES,
  type Difficulty,
  type PackId,
  type SealedQuestion,
} from '../questions/types';

export type Phase = 'lobby' | 'question' | 'reveal' | 'scoreboard' | 'finished';

/** What the lobby starts on, and what a freshly created room carries. */
export const DEFAULT_DURATION_SECS = 10;

/**
 * What a room with **no** `durationSecs` is read as, which is a different
 * question from what the lobby defaults to and must not be changed to follow
 * it.
 *
 * It matches the literal in firestore.rules — `get('durationSecs', 20)` — and
 * the two have to agree exactly. A room created before the window was
 * selectable carries no field, so if this said ten while the rules said twenty,
 * that room's clients would count down to zero, auto-reveal, and be refused by
 * a vault that was not open for another ten seconds — the round stopping dead
 * on "the vault would not confirm an answer".
 */
export const LEGACY_DURATION_SECS = 20;

/** What the lobby offers. Free text would be a worse control for no more use. */
export const DURATION_CHOICES = [10, 15, 20] as const;

/**
 * What the *rules* accept, which is deliberately wider than what the lobby
 * offers. Any member can restart a question — writing the room back to a
 * non-question phase and forward again restamps `openedAt`, which was harmless
 * while the gate was a fixed twenty seconds because it could only ever push the
 * vault further away. A selectable window turns that same move into a way to
 * pull the gate closer, so the floor is what bounds it: the worst anybody can
 * do is a five-second question, with the whole room watching the timer restart.
 *
 * The ceiling is only there to keep a nonsense value out of a document every
 * client re-reads.
 */
export const MIN_DURATION_SECS = 5;
export const MAX_DURATION_SECS = 120;

export const DEFAULT_QUESTION_DURATION_MS = DEFAULT_DURATION_SECS * 1000;

export interface Player {
  name: string;
  joinedAt: number;
  /**
   * Which season record this player is playing under, when it is not simply
   * their uid.
   *
   * Written only when the two differ — which needs a claimed recovery code — so
   * an ordinary player's entry is exactly the two fields it always was. Absent
   * means "the same as the uid", which is what `playerIdFor` returns anyway.
   *
   * It lives here so the round that opens can look up everybody's season row
   * without a `claims` read per player: the room document is already re-read on
   * every transition, and a player stating its own identity is something the
   * rules can check, where reading somebody else's claim is not.
   */
  playerId?: string;
  /**
   * Which side this player's points count for **tonight** — a Lurker's pick
   * where they made one, and their own squad otherwise. See `sideFor`.
   *
   * On the room rather than read from the season record, for the reason
   * `playerId` is: the alternative is a `seasons` document read per player per
   * round, and the room document is already re-read on every transition. It is
   * also the only value that can be *right*, since a Lurker's side for the night
   * exists nowhere else — it lives in session storage on the device that chose
   * it.
   *
   * Absent for anybody who has never named a squad, which is different from an
   * empty one: `squadStandings` leaves them out rather than inventing a side.
   * Written only on the entry that creates a seat, so a rejoin never restamps
   * it — the same rule the name and `joinedAt` follow.
   */
  squad?: string;
}

/**
 * What the season already knows about the people in this room, assembled once by
 * whoever starts the round and written into the document everybody is already
 * listening to — the same shape as the reveal, where one device pays for a read
 * and the rest learn it from an update they were getting anyway.
 */
export interface FormDigest {
  /** When the titles went up, by the writer's clock. */
  at: number;
  facts: FormFact[];
  /**
   * The window the round will open with, parked here until it does.
   *
   * It cannot be written to the room's own `durationSecs` yet: `timingOk()` in
   * the security rules pins that field to its previous value on every write
   * except the one that opens a question, so setting it during the titles would
   * be refused outright. Nested inside the digest it is ordinary data the rules
   * do not inspect.
   *
   * Carried rather than kept on the quizmaster's device so the round can still
   * be started with the window that was chosen if the role changes hands while
   * the titles are up.
   */
  durationSecs: number;
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
  /**
   * Null until the question is revealed.
   *
   * Nobody's device knows this while the clock is running — not even the
   * quizmaster's. The packs ship without answers, and the answer is fetched
   * from the vault at reveal by a write the security rules refuse until the
   * room's answer window is up. See docs/decisions/answer-window.md.
   */
  correctIndex: number | null;
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
  /**
   * How long each question in this round stays open, in seconds. Chosen in the
   * lobby and fixed for the round.
   *
   * Read from the room rather than a constant because the security rules read it
   * too — the vault refuses to confirm an answer until the server has seen this
   * many seconds pass since the question opened, so a client that disagreed with
   * the document would either reveal into a closed gate or leave the room
   * waiting after its own timer had run out.
   */
  durationSecs: number;
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
  /** The opening titles, or null when a round is not being introduced. */
  form: FormDigest | null;
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
    durationSecs: DEFAULT_DURATION_SECS,
    questionOpenedAt: null,
    answers: {},
    scores: {},
    lastDeltas: {},
    skipped: [],
    gameId: null,
    form: null,
  };
}

export function currentQuestion(state: RoomState): QuizQuestion | null {
  return state.questions[state.index] ?? null;
}

/** This room's answer window in milliseconds, which is what everything measures in. */
export function questionDurationMs(state: RoomState): number {
  return state.durationSecs * 1000;
}

/**
 * Whether a window is one the rules will accept. Checked before a round starts
 * rather than trusted, so a value that would be refused by the server fails in
 * the lobby instead of at the first reveal, with the room already watching.
 */
export function isDurationAllowed(secs: number): boolean {
  return Number.isInteger(secs) && secs >= MIN_DURATION_SECS && secs <= MAX_DURATION_SECS;
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

/**
 * A place in the queue that is behind everyone already in the room.
 *
 * `joinedAt` decides the quizmaster, and it is a wall clock reading from the
 * joining device — so an arrival can only be trusted to be *later* than the
 * people already there if it is made to be. Two ways it is not: a laptop whose
 * clock is an hour slow, and a browser carrying a timestamp it earned somewhere
 * else. The second is not hypothetical. Room 6JA5 on 17 August 2026 has a player
 * stamped 10:40:45.823, which is the millisecond they created a *different*
 * room, abandoned it, and came here with the number still in hand.
 *
 * Neither one took the chair that night, because both readings happened to land
 * after the host's. Nothing made them: a mid-round join that resolves as
 * quizmaster takes the transport away from whoever is running the quiz and hands
 * it to a device that has just arrived, whose answer clock starts from zero — so
 * the round stops until the newcomer's own timer runs out.
 *
 * Used only for a genuinely new entry. Somebody coming back from a reap keeps
 * the place they already had, which is the whole reason that path remembers it.
 */
export function seatBehind(players: Record<string, Player>, now: number): number {
  let latest = 0;
  for (const player of Object.values(players)) {
    if (player.joinedAt > latest) latest = player.joinedAt;
  }
  return Math.max(now, latest + 1);
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

/**
 * The levels the lobby offers, which is deliberately not every `Level`.
 *
 * **`easy` and `hard` were withdrawn on 2 September 2026, on a measurement.**
 * Only about 4,000 of the 14,176 published questions carry a real rating — the
 * OpenTriviaQA half is unrated and defaults to `medium` — so those two levels
 * were promising a depth the corpus does not have. `asked-probe` cross-
 * referenced against the packs put numbers on it: Best of British had served
 * **54 of its 54** easy questions and Sport **12 of its 15** hard ones, so
 * picking either was a round of near-total repeats however well the history
 * worked. `ideas-review.md` had already called them "honestly deletable".
 *
 * The `Level` type keeps them, and so does `selectQuestions` — `ramp` buckets by
 * difficulty internally, and this comes back the moment `stats/{questionId}`
 * gives the corpus a rating the office earned. Withdrawing the tiles is the
 * whole change; nothing persists a level, so no round in flight is affected.
 */
export const LEVELS = ['mixed', 'medium', 'ramp'] as const;

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
  pool: readonly SealedQuestion[],
  rng: Rng,
): Record<Difficulty, SealedQuestion[]> {
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
 *
 * **Fresh questions and repeats are two passes, not one merged pool.** Merged,
 * `bucketByDifficulty` shuffles a repeat in beside a fresh question of the same
 * level and can serve the repeat while the fresh one is still sitting there.
 * Every fresh question the pack has is used before any repeat is considered.
 *
 * The order inside a pass is the point of the second half. A level whose fresh
 * bucket has run dry is topped up from the level with the most left — it does
 * **not** reach for a repeat of its own kind while other fresh questions exist.
 * On the packs the office plays that distinction is the whole game: the thin
 * `easy` and `hard` buckets are exhausted while `medium` is a thousand deep, so
 * a per-difficulty fallback would repeat a question every single round.
 */
function buildRamp(
  fresh: readonly SealedQuestion[],
  repeats: readonly SealedQuestion[],
  count: number,
  rng: Rng,
): SealedQuestion[] {
  const plan = rampPlan(count);
  const picked: SealedQuestion[] = [];

  for (const pool of [fresh, repeats]) {
    const buckets = bucketByDifficulty(pool, rng);

    for (const level of DIFFICULTIES) {
      const held = picked.filter((question) => question.difficulty === level).length;
      // Capped by the round as well as by the plan. On the second pass the two
      // are not the same: a first pass that overfilled one level from its own
      // top-up leaves the plan asking for more than the round has room for.
      const room = Math.min(Math.max(0, plan[level] - held), count - picked.length);
      picked.push(...buckets[level].splice(0, room));
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

    if (picked.length >= count) break;
  }

  return picked.sort((a, b) => DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty]);
}

/**
 * Splits a pool into questions this season has not seen and questions it has.
 *
 * Random selection with no memory repeats far sooner than pack sizes suggest:
 * drawing 15 from Sport's 125 every week means about two of last week's
 * questions come round again, every week. Big packs hide it — the same sum over
 * Video Games' 999 is a quarter of a question — so the fix has to be selection,
 * not more questions.
 */
function partitionByAsked(
  pool: readonly SealedQuestion[],
  asked: ReadonlySet<string>,
): { fresh: SealedQuestion[]; repeats: SealedQuestion[] } {
  const fresh: SealedQuestion[] = [];
  const repeats: SealedQuestion[] = [];

  for (const question of pool) {
    (asked.has(question.id) ? repeats : fresh).push(question);
  }

  return { fresh, repeats };
}

/**
 * Chooses which questions a round is made of, in the order they will be asked.
 * Returns fewer than `count` only when the pool genuinely cannot supply them.
 *
 * `asked` is what the season has already served. Those questions go to the back
 * of the queue rather than being removed: a thin pack that cannot fill a round
 * from fresh questions alone still gets a full-length round, with repeats only
 * where there was no alternative. Removing them outright would mean Sport
 * quietly serving eight-question rounds by mid-season.
 */
export function selectQuestions(
  pool: readonly SealedQuestion[],
  count: number,
  level: Level = 'mixed',
  rng: Rng = Math.random,
  asked: ReadonlySet<string> = new Set(),
): SealedQuestion[] {
  const wanted = Math.max(0, count);
  if (wanted === 0) return [];

  const eligible = level === 'mixed' || level === 'ramp'
    ? pool
    : pool.filter((q) => q.difficulty === level);

  const { fresh, repeats } = partitionByAsked(eligible, asked);

  // A ramp has to be built from the whole set it will draw on, or topping up
  // afterwards would append hard questions to the end of an already-sorted
  // round and break the climb. It takes both halves and decides for itself when
  // a repeat is unavoidable — the gate used to be `fresh.length >= wanted` over
  // the *pool*, which says nothing about whether any one difficulty still has a
  // fresh question in it.
  if (level === 'ramp') return buildRamp(fresh, repeats, wanted, rng);

  const picked = shuffle(fresh, rng).slice(0, wanted);
  if (picked.length >= wanted) return picked;

  return [...picked, ...shuffle(repeats, rng).slice(0, wanted - picked.length)];
}

/**
 * Picks the questions for a round and freezes their answer order.
 * Returns fewer than `count` if the pool cannot fill it.
 *
 * The options are shuffled out of the pack's fixed order so that two rounds
 * drawing the same question do not put the same text on the same lectern. It
 * makes no difference to secrecy — the pack's order says nothing either — but
 * it stops the display order becoming a fingerprint anyone could learn.
 */
export function buildQuizQuestions(
  pool: readonly SealedQuestion[],
  count: number,
  level: Level = 'mixed',
  rng: Rng = Math.random,
  asked: ReadonlySet<string> = new Set(),
): QuizQuestion[] {
  return selectQuestions(pool, count, level, rng, asked).map((question) => ({
    id: question.id,
    prompt: question.question,
    options: shuffle(question.options, rng),
    correctIndex: null,
    category: question.category,
    difficulty: question.difficulty,
  }));
}
