import { NO_HISTORY, type AskedHistory, type HistoryGroup } from '../engine/askedHistory';
import { dealRandomRound, RANDOM_SOURCES, type RandomSource } from '../engine/randomRound';
import { buildQuizQuestions, ladderFallbackNotices, type Level, type QuizQuestion, type Rng } from '../engine/state';
import { rateFor } from '../engine/chaser';
import { dealSurveyRound } from '../engine/survey';
import type { PackId, SealedQuestion } from '../questions/types';
import type { PackPorts } from './ports';

/**
 * Dealing a round, and remembering what it served (`recordAsked`), moved from
 * `App.tsx`. The host deals once; every other device reads the questions off the
 * room.
 *
 * `remember` is separate because it runs **after** the round is under way: a
 * history that cannot be written is a repeat next week, which is far smaller
 * than a round that will not start. For the same reason a history that cannot
 * be *read* is `NO_HISTORY` rather than an empty set — `recordAsked` writes the
 * document whole, so "we do not know" written back as "never played" would wipe
 * the season's real history.
 */
export interface Dealt {
  questions: QuizQuestion[];
  /**
   * Set when The Ladder filled a difficulty from another. Empty otherwise,
   * including a ramp that climbed and every round that is not a ramp.
   */
  ladderNotices: readonly string[];
  /** Writes the season history. Never rejects: a failure here must not stop a round. */
  remember: () => Promise<void>;
}

export interface DealRequest {
  packId: PackId;
  count: number;
  level: Level;
  jigsawEnabled: boolean;
  /** Beat the Chaser: stamp each question with the office's rate for one like it. */
  chaserEnabled?: boolean;
  /** Whose season history to deal from and add to. The office's unless Geekend are playing. */
  history?: HistoryGroup;
}

export async function dealRound(request: DealRequest, ports: PackPorts, rng: Rng = Math.random): Promise<Dealt> {
  const group = request.history ?? 'office';
  const dealt =
    request.packId === 'random'
      ? await dealRandom(request.count, request.level, ports, rng, group)
      : request.packId === 'survey'
        ? await dealSurvey(ports, rng, group)
        : await dealSinglePack(request, ports, rng, group);
  if (!request.chaserEnabled || request.packId === 'survey') return dealt;

  // A rates file that cannot be read is the office average, not a round that will not start.
  const rates = ports.loadRates ? await ports.loadRates().catch(() => null) : null;
  return {
    ...dealt,
    questions: dealt.questions.map((question) => ({
      ...question,
      chaserRate: rateFor(rates, question.sourcePack ?? request.packId, question.difficulty),
    })),
  };
}

/** One pack, as every round before the mix did. */
async function dealSinglePack(
  { packId, count, level, jigsawEnabled }: DealRequest,
  ports: PackPorts,
  rng: Rng,
  group: HistoryGroup,
): Promise<Dealt> {
  const pool = await ports.loadPack(packId);
  const asked = await ports.loadAsked(packId, group).catch(() => NO_HISTORY);
  const playable = jigsawEnabled ? pool.filter((question) => question.jigsaw === true) : pool;
  const questions = buildQuizQuestions(playable, count, level, rng, asked.ids);
  return {
    questions,
    ladderNotices: level === 'ramp' ? ladderFallbackNotices(questions, count) : [],
    remember: async () => {
      await ports
        .recordAsked(
          packId,
          questions.map((question) => question.id),
          asked,
          group,
        )
        .catch(() => undefined);
    },
  };
}

/**
 * Survey Says: five prompts, told then guessed. The count and level the lobby
 * offers mean nothing here — always ten questions, five prompts twice. Season
 * history works as for any pack, on the prompt ids.
 */
async function dealSurvey(ports: PackPorts, rng: Rng, group: HistoryGroup): Promise<Dealt> {
  const pool = await ports.loadPack('survey');
  const asked = await ports.loadAsked('survey', group).catch(() => NO_HISTORY);
  const questions = dealSurveyRound(pool, rng, asked.ids);
  const promptIds = [...new Set(questions.flatMap((question) => question.survey?.promptId ?? []))];
  return {
    questions,
    ladderNotices: [],
    remember: async () => {
      await ports.recordAsked('survey', promptIds, asked, group).catch(() => undefined);
    },
  };
}

/**
 * Samples the six source packs and writes one list. Each source's history is
 * read and, when the read succeeded, written back — a `random` history would not
 * stop On the box serving the same still next round.
 */
async function dealRandom(
  count: number,
  level: Level,
  ports: PackPorts,
  rng: Rng,
  group: HistoryGroup,
): Promise<Dealt> {
  const loaded = await Promise.all(
    RANDOM_SOURCES.map(async (source) => {
      const [pool, history] = await Promise.all([
        ports.loadPack(source),
        ports.loadAsked(source, group).catch(() => NO_HISTORY),
      ]);
      return { source, pool, history };
    }),
  );
  const bySource = new Map(loaded.map((row) => [row.source, row]));
  const take = (source: RandomSource): { pool: SealedQuestion[]; history: AskedHistory } => {
    const row = bySource.get(source);
    if (!row) throw new Error(`Could not load the ${source} pack`);
    return row;
  };
  const questions = dealRandomRound(
    {
      screens: take('screens').pool,
      sleeves: take('sleeves').pool,
      tunes: take('tunes').pool,
      catchphrase: take('catchphrase').pool,
      blanks: take('blanks').pool,
      prices: take('prices').pool,
    },
    {
      screens: take('screens').history.ids,
      sleeves: take('sleeves').history.ids,
      tunes: take('tunes').history.ids,
      catchphrase: take('catchphrase').history.ids,
      blanks: take('blanks').history.ids,
      prices: take('prices').history.ids,
    },
    count,
    level,
    rng,
  );
  return {
    questions,
    ladderNotices: [],
    remember: async () => {
      await Promise.all(
        RANDOM_SOURCES.map((source) => {
          const ids = questions.filter((question) => question.sourcePack === source).map((question) => question.id);
          return ports.recordAsked(source, ids, take(source).history, group).catch(() => undefined);
        }),
      );
    },
  };
}
