import type { Award } from './awards';
import { PODIUM_PLACES, seatedLast, type Standing } from './scoring';
import type { Player } from './state';

/**
 * One riser on the card. Carries the position rather than its index, because a
 * dead heat for first has no position 2 and printing "2nd" beside a joint winner
 * would be the card contradicting the podium it was made from.
 */
export interface CardPodiumRow {
  position: number;
  name: string;
  score: number;
}

/**
 * A rosette, named rather than counted. The card has room for who won it and no
 * room for the sentence underneath, which is the screen's job.
 */
export interface CardRosette {
  id: Award['id'];
  names: string[];
}

/**
 * What the shareable card says about a round.
 *
 * **Facts, not sentences.** `winners` is a list of names; turning it into
 * "Greg takes it" or "Greg & Sam — dead heat" belongs to whatever draws the
 * card, on the same split as {@link Award} and the awards panel. The engine
 * decides what is true about the round; the drawing decides how it reads.
 *
 * Deliberately absent: **the room code**, and the round in review. The code is
 * the capability that lets anybody into the room, the room outlives the game by
 * thirty days, and this is an image made to be forwarded — so it must not carry
 * one. The review is a good panel to read on a screen and noise at the size a
 * chat client shows an image. Both are asserted in the tests so that adding
 * either is a decision rather than a drift.
 */
export interface CardModel {
  /** Null for a round whose pack has no title, rather than an invented one. */
  pack: string | null;
  /** Empty when nobody scored: a table level on zero has no winner. */
  winners: string[];
  /** Up to {@link PODIUM_PLACES} rows, in finishing order. */
  podium: CardPodiumRow[];
  /** Whoever finished below the podium, or null when nobody did. */
  chair: { names: string[]; score: number } | null;
  /**
   * **Null means this device did not watch the whole game**, which is a
   * different thing from a round that earned none — that is an empty list.
   *
   * The distinction is the point. `useGameLog` is assembled from the reveals
   * this client saw, so a device that missed one would name different winners to
   * the one beside it. Two people pasting different cards of the same round into
   * the same channel is worse than neither of them doing it, and it is the same
   * reasoning that already withholds the awards on screen.
   */
  rosettes: CardRosette[] | null;
  questionCount: number;
  /** When the card was made, for whatever draws it to date. */
  at: number;
}

export interface CardInput {
  packTitle: string | null;
  /** The **frozen** membership, so somebody leaving cannot change an old card. */
  players: Record<string, Player>;
  scores: Record<string, number>;
  /** Already filtered on membership by `roomStandings`, as the screen does. */
  rows: readonly Standing[];
  /** Already gated by the caller, exactly as the awards panel is. */
  awards: readonly Award[];
  sawWholeGame: boolean;
  questionCount: number;
  at: number;
}

function namesOf(players: Record<string, Player>, uids: readonly string[]): string[] {
  return uids.map((uid) => players[uid]?.name).filter((name): name is string => Boolean(name));
}

/**
 * The round as a card.
 *
 * Takes what `Final` already holds rather than deriving it again: the same
 * `roomStandings` rows and the same gated awards feed both, so the card and the
 * screen cannot disagree about who won. `seatedLast` is called here rather than
 * passed for the same reason from the other direction — it is the one rule the
 * chair follows, and calling it is cheaper than trusting a caller to.
 */
export function cardModel(input: CardInput): CardModel {
  const { packTitle, players, scores, rows, awards, sawWholeGame, questionCount, at } = input;

  const seated = seatedLast(rows);

  return {
    pack: packTitle,
    winners: namesOf(players, rows.filter((row) => row.position === 1).map((row) => row.uid)),
    podium: rows.slice(0, PODIUM_PLACES).flatMap((row) => {
      const name = players[row.uid]?.name;
      return name ? [{ position: row.position, name, score: row.score }] : [];
    }),
    chair: seated.length > 0
      ? { names: namesOf(players, seated), score: scores[seated[0] ?? ''] ?? 0 }
      : null,
    rosettes: sawWholeGame
      ? awards.map((award) => ({ id: award.id, names: namesOf(players, award.uids) }))
      : null,
    questionCount,
    at,
  };
}
