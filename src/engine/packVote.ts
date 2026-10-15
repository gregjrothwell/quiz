/**
 * The lobby vote: which set the room would like to play.
 *
 * Advisory. The quizmaster still picks and presses Start — the vote is a count
 * on each pack card, nothing more. See docs/decisions/lobby-vote.md.
 *
 * Pure, so the rules of the count are tested here rather than in a component.
 */
import { PACK_IDS, type PackId } from '../questions/types';
import type { Phase, Player } from './state';

/** uid → the pack that player voted for. One vote each. */
export type PackVotes = Record<string, PackId>;

/** uid → taps that player has spent on the vote in this lobby. */
export type VoteTaps = Record<string, number>;

export type PackTally = Partial<Record<PackId, number>>;

function isPackId(value: unknown): value is PackId {
  return typeof value === 'string' && (PACK_IDS as readonly string[]).includes(value);
}

/**
 * The votes off a raw room document.
 *
 * Untrusted: any member can write any field of the room, so only a string
 * naming a real pack survives. A room from before the vote has no field at all
 * and reads as nobody having voted.
 */
export function readPackVotes(raw: unknown): PackVotes {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const votes: PackVotes = {};
  for (const [uid, value] of Object.entries(raw)) {
    if (isPackId(value)) votes[uid] = value;
  }
  return votes;
}

/**
 * The taps spent off a raw room document.
 *
 * Untrusted for the reason the votes are: only a whole, non-negative count
 * survives. A room from before the count reads as nobody having tapped.
 */
export function readVoteTaps(raw: unknown): VoteTaps {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const taps: VoteTaps = {};
  for (const [uid, value] of Object.entries(raw)) {
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0) taps[uid] = value;
  }
  return taps;
}

/** The quizmaster's highlighted pack off a raw room document, or null. */
export function readBrowsing(raw: unknown): PackId | null {
  return isPackId(raw) ? raw : null;
}

/**
 * Votes per pack, counting only players still in the room. A seat the reaper
 * or Leave removed takes its vote with it, without anything having to delete it.
 */
export function tallyPackVotes(votes: PackVotes, players: Record<string, Player>): PackTally {
  const tally: PackTally = {};
  for (const [uid, packId] of Object.entries(votes)) {
    if (!(uid in players)) continue;
    tally[packId] = (tally[packId] ?? 0) + 1;
  }
  return tally;
}

/** The pack or packs with the most votes. A tie leads together; none leads on no votes. */
export function leadingPacks(tally: PackTally): PackId[] {
  const entries = Object.entries(tally) as [PackId, number][];
  const top = Math.max(0, ...entries.map(([, count]) => count));
  if (top === 0) return [];
  return entries.filter(([, count]) => count === top).map(([packId]) => packId);
}

/**
 * How many taps a player gets on the vote in one lobby: cast it, then change it
 * or take it back once. Greg, 14 October 2026: one each, then two — to be
 * relaxed if the room learns. Enough to correct a mis-tap; clicking round the
 * cards for fun stops at once. Each tap is a write every screen in the room
 * reads. See docs/decisions/lobby-vote.md.
 */
export const VOTE_TAPS = 2;

/** Taps this player has left, given how many they have used. Never negative. */
export function tapsLeft(used: number): number {
  return Math.max(0, VOTE_TAPS - used);
}

/** What a tap on `tapped` makes this player's vote: cast, moved, or taken back. */
export function nextVote(current: PackId | undefined, tapped: PackId): PackId | null {
  return current === tapped ? null : tapped;
}

/**
 * Whether a phase transition may write `packVotes`, `voteTaps` and `browsing` wholesale.
 *
 * Only when it crosses into or out of the lobby, which is where `start` and
 * `reset` clear them. Any other dispatch — `selectPack`, the opening titles,
 * both in the lobby — folds over the writer's snapshot, so writing the map back
 * would stamp the quizmaster's view of the votes over a vote cast a moment ago.
 * That is the `players` race (see `toUpdate` in src/lib/useRoom.ts), and the
 * cure is the same: votes travel as `packVotes.{uid}` field writes.
 */
export function writesTheVote(previousPhase: Phase | null, nextPhase: Phase): boolean {
  if (previousPhase === null) return false;
  return (previousPhase === 'lobby') !== (nextPhase === 'lobby');
}
