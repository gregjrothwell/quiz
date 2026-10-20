/**
 * One round dealt from several packs.
 *
 * The room still has one `packId` — `random` — for the whole round. The
 * quizmaster's client samples the source packs and writes the question list
 * once; every other client renders that list and does not sample again.
 * Each question carries `sourcePack` so hold, bonus and sound follow the
 * question. See docs/decisions/random-round.md.
 */

import type { PackId, PackSummary, SealedQuestion } from '../questions/types';
import { PACK_META } from '../questions/types';
import {
  buildQuizQuestions,
  shuffle,
  type Level,
  type QuizQuestion,
  type Rng,
} from './state';

/**
 * The packs the office plays. Fine Art, Classical and Flags are left out:
 * none of them had a round in the fortnight before 5 October 2026.
 * There is no Name the artist pack on this commit.
 */
export const RANDOM_SOURCES = [
  'screens',
  'sleeves',
  'tunes',
  'catchphrase',
  'blanks',
  'prices',
] as const;

export type RandomSource = (typeof RANDOM_SOURCES)[number];

/**
 * The sources a Random Round may end on. Sleeves and The Price Was Right are
 * left out: the last question carries the wager and the final, and theirs are
 * a lottery there. Measured on the nine Random Rounds played 12–19 October
 * 2026, all on The Ladder: a sleeve was last in seven of them and 18% of the
 * room got it; hard prices hit 6%. Both still appear earlier in the round.
 * Greg, 20 October 2026.
 */
export const FINALE_SOURCES: readonly RandomSource[] = ['screens', 'tunes', 'catchphrase', 'blanks'];

export type RandomPools = { [S in RandomSource]: readonly SealedQuestion[] };

export type RandomAsked = { [S in RandomSource]: ReadonlySet<string> };

const DIFFICULTY_RANK = { easy: 0, medium: 1, hard: 2 } as const;

/**
 * Which pack a question behaves as.
 *
 * An ordinary round leaves `sourcePack` unset and the room's pack stands, so
 * a Catchphrase round dealt before this field existed still holds its options
 * and pays its bonus. A random round writes the source, because `random` is
 * not itself Catchphrase, Name that Tune, or Sleeves.
 */
export function questionPack(
  roomPackId: PackId | null,
  question: { sourcePack?: PackId } | null | undefined,
): PackId | null {
  return question?.sourcePack ?? roomPackId;
}

/**
 * How many questions each source contributes, in {@link RANDOM_SOURCES} order.
 *
 * As even as the length allows. The first sources take the remainder, so a
 * round of ten still includes every source and a round of fifteen gives the
 * first three one extra. The written list is shuffled afterwards; this order
 * is only who supplies the extra question.
 */
export function quotasFor(count: number, sources: number): number[] {
  if (sources <= 0 || count <= 0) return [];
  const base = Math.floor(count / sources);
  const extra = count % sources;
  return Array.from({ length: sources }, (_, index) => base + (index < extra ? 1 : 0));
}

/**
 * How many questions an even deal can take before the thinnest source runs out.
 * Six times that source's depth: the lobby uses it the same way it uses a
 * real pack's count, so a level the scarcest source cannot fill is the one
 * that reads as thin.
 */
function evenCapacity(amounts: readonly number[]): number {
  if (amounts.length === 0) return 0;
  return Math.min(...amounts) * amounts.length;
}

/**
 * The lobby row. Derived from the six source rows already in the index, so
 * there is no `random.json` for a re-harvest to drop or the seal test to count.
 * Null when any source is missing — the button would promise a mix it cannot deal.
 */
export function randomPackSummary(packs: readonly PackSummary[]): PackSummary | null {
  const sources: PackSummary[] = [];
  for (const id of RANDOM_SOURCES) {
    const found = packs.find((pack) => pack.id === id);
    if (!found) return null;
    sources.push(found);
  }
  return {
    id: 'random',
    title: PACK_META.random.title,
    blurb: PACK_META.random.blurb,
    count: evenCapacity(sources.map((pack) => pack.count)),
    counts: {
      easy: evenCapacity(sources.map((pack) => pack.counts.easy)),
      medium: evenCapacity(sources.map((pack) => pack.counts.medium)),
      hard: evenCapacity(sources.map((pack) => pack.counts.hard)),
    },
  };
}

/** Appends the derived row, replacing one that was already listed. */
export function withRandomPack(packs: readonly PackSummary[]): PackSummary[] {
  const summary = randomPackSummary(packs);
  if (!summary) return [...packs];
  return [...packs.filter((pack) => pack.id !== 'random'), summary];
}

/**
 * The question a Random Round ends on, from one source.
 *
 * On The Ladder it is the hardest question that source has not served this
 * season, so the climb still finishes at the top. Only once the source has no
 * fresh question at all does it fall back to a repeat. Any other level takes
 * one question the way the rest of the round does.
 */
function dealFinale(
  pool: readonly SealedQuestion[],
  level: Level,
  rng: Rng,
  asked: ReadonlySet<string>,
): QuizQuestion | undefined {
  if (level !== 'ramp') return buildQuizQuestions(pool, 1, level, rng, asked)[0];
  const fresh = pool.filter((question) => !asked.has(question.id));
  for (const difficulty of ['hard', 'medium', 'easy'] as const) {
    const [pick] = buildQuizQuestions(fresh, 1, difficulty, rng);
    if (pick) return pick;
  }
  return buildQuizQuestions(pool, 1, 'hard', rng, asked)[0] ?? buildQuizQuestions(pool, 1, 'mixed', rng, asked)[0];
}

/**
 * Which source the round ends on: one of {@link FINALE_SOURCES} that supplies
 * a question at all. On The Ladder, one that still has a fresh hard question
 * is preferred, so the last question is not a step down.
 */
function finaleSource(
  pools: RandomPools,
  asked: RandomAsked,
  quotas: readonly number[],
  level: Level,
  rng: Rng,
): RandomSource | undefined {
  const supplying = FINALE_SOURCES.filter((source) => (quotas[RANDOM_SOURCES.indexOf(source)] ?? 0) > 0);
  const climbing = supplying.filter((source) =>
    pools[source].some((question) => question.difficulty === 'hard' && !asked[source].has(question.id)),
  );
  const choices = level === 'ramp' && climbing.length > 0 ? climbing : supplying;
  return choices[Math.floor(rng() * choices.length)];
}

/**
 * Deals one mixed round.
 *
 * Each source is sampled with the same `buildQuizQuestions` a single pack
 * uses, including its asked-history, then the list is shuffled. The Ladder
 * is the exception: sampling each source as its own ramp of two or three
 * questions is one easy and one hard, so the round samples mixed and is
 * then ordered gentle to fiendish. The shuffle still runs first, so within
 * a difficulty the types stay mixed. Both orders are a pure function of
 * `rng`; the room stores the result, and that stored list is what the
 * other clients render.
 *
 * The last question is dealt apart, from {@link FINALE_SOURCES}, and counts
 * against that source's share, so every source still supplies what
 * {@link quotasFor} says.
 */
export function dealRandomRound(
  pools: RandomPools,
  asked: RandomAsked,
  count: number,
  level: Level,
  rng: Rng,
): QuizQuestion[] {
  const quotas = quotasFor(count, RANDOM_SOURCES.length);
  const ending = finaleSource(pools, asked, quotas, level, rng);
  const dealt: QuizQuestion[] = [];
  let finale: QuizQuestion | undefined;

  for (const [index, source] of RANDOM_SOURCES.entries()) {
    let wanted = quotas[index] ?? 0;
    if (wanted === 0) continue;
    let pool = pools[source];
    if (source === ending) {
      finale = dealFinale(pool, level, rng, asked[source]);
      if (finale) {
        const finaleId = finale.id;
        finale = { ...finale, sourcePack: source };
        wanted -= 1;
        pool = pool.filter((question) => question.id !== finaleId);
      }
    }
    const selectionLevel: Level = level === 'ramp' ? 'mixed' : level;
    const questions = buildQuizQuestions(pool, wanted, selectionLevel, rng, asked[source]);
    for (const question of questions) {
      dealt.push({ ...question, sourcePack: source });
    }
  }

  const mixed = shuffle(dealt, rng);
  const ordered =
    level === 'ramp'
      ? mixed.sort((a, b) => DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty])
      : mixed;
  return finale ? [...ordered, finale] : ordered;
}
