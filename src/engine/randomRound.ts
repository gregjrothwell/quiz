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
 */
export function dealRandomRound(
  pools: RandomPools,
  asked: RandomAsked,
  count: number,
  level: Level,
  rng: Rng,
): QuizQuestion[] {
  const quotas = quotasFor(count, RANDOM_SOURCES.length);
  const dealt: QuizQuestion[] = [];

  RANDOM_SOURCES.forEach((source, index) => {
    const wanted = quotas[index] ?? 0;
    if (wanted === 0) return;
    const selectionLevel: Level = level === 'ramp' ? 'mixed' : level;
    const questions = buildQuizQuestions(
      pools[source],
      wanted,
      selectionLevel,
      rng,
      asked[source],
    );
    for (const question of questions) {
      dealt.push({ ...question, sourcePack: source });
    }
  });

  const mixed = shuffle(dealt, rng);
  if (level !== 'ramp') return mixed;
  return mixed.sort((a, b) => DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty]);
}
