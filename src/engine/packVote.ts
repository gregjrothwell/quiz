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
 * The votes off an untrusted map (a room document, or one Realtime Database generation).
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
 * The taps spent off an untrusted map.
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

/** One highlighted pack off an untrusted value, or null. */
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
 * The generation a room reads before `start` or `reset` has minted one.
 * A path segment, so the Realtime Database rules can bound it.
 */
export const INITIAL_VOTE_GEN = '0';

/** What `voteGen` on the room document is allowed to be. The rules hold the same shape. */
export const VOTE_GEN_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;

/**
 * Which generation of the lobby vote the room is reading.
 *
 * Absent, or anything that is not a short id, is the initial generation — a
 * room from before the vote moved, and a room that has not started or reset.
 */
export function voteGenOf(raw: unknown): string {
  return typeof raw === 'string' && VOTE_GEN_PATTERN.test(raw) ? raw : INITIAL_VOTE_GEN;
}

/** `lobbyVote/{code}/{gen}` on the Realtime Database. */
export function lobbyVotePath(code: string, gen: string): string {
  return `lobbyVote/${code}/${gen}`;
}

/** One generation of the vote, as the lobby reads it. `browsingBy` is uid → pack. */
export interface LobbyVoteView {
  packVotes: PackVotes;
  voteTaps: VoteTaps;
  browsingBy: Record<string, PackId>;
}

export const EMPTY_LOBBY_VOTE: LobbyVoteView = { packVotes: {}, voteTaps: {}, browsingBy: {} };

/**
 * One generation off a Realtime Database snapshot.
 *
 * Untrusted for the reason the room fields were: the rules let a player write
 * their own slot, not what goes in it beyond a length. Anything else is dropped.
 */
export function readLobbyVote(raw: unknown): LobbyVoteView {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return EMPTY_LOBBY_VOTE;
  const record = raw as Record<string, unknown>;
  return {
    packVotes: readPackVotes(record['packVotes']),
    voteTaps: readVoteTaps(record['voteTaps']),
    browsingBy: readBrowsingBy(record['browsing']),
  };
}

function readBrowsingBy(raw: unknown): Record<string, PackId> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const browsingBy: Record<string, PackId> = {};
  for (const [uid, value] of Object.entries(raw)) {
    const packId = readBrowsing(value);
    if (packId) browsingBy[uid] = packId;
  }
  return browsingBy;
}

/**
 * The highlight the room is shown: the host's own slot, and nobody else's.
 * A member can write `browsing/{their uid}`; it does not become the highlight
 * unless they are the host. No host yet means nothing is highlighted.
 */
export function highlightFor(browsingBy: Record<string, PackId>, hostUid: string | null): PackId | null {
  if (!hostUid) return null;
  return browsingBy[hostUid] ?? null;
}

/**
 * Whether this phase transition mints a new `voteGen` on the room document.
 *
 * Only when it crosses into or out of the lobby, which is where `start` and
 * `reset` used to clear the vote. The vote itself is not on the document.
 * Minting a new id in that same write is the clear: every client follows the
 * id, and the previous generation is left unread. A dispatch that stays in the
 * lobby — `selectPack`, the opening titles — does not mint one, or it would
 * throw away a vote cast a moment ago. A create has no earlier phase.
 */
export function mintsVoteGen(previousPhase: Phase | null, nextPhase: Phase): boolean {
  if (previousPhase === null) return false;
  return (previousPhase === 'lobby') !== (nextPhase === 'lobby');
}
