import { useEffect, useState } from 'react';
import type { Player, RoomState } from '../engine/state';

export interface FinalSnapshot {
  gameId: string | null;
  players: Record<string, Player>;
  scores: Record<string, number>;
}

const NO_PLAYERS: Record<string, Player> = {};
const NO_SCORES: Record<string, number> = {};
const EMPTY: FinalSnapshot = { gameId: null, players: NO_PLAYERS, scores: NO_SCORES };

/**
 * Session storage rather than local, for the same reason as the game log: this
 * describes the round this tab has just watched finish. Local storage would keep
 * a stranger's podium on every device forever.
 */
const STORAGE_KEY = 'vibequiz.final';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePlayer(value: unknown): Player | null {
  if (!isObject(value)) return null;

  const { name, joinedAt, playerId } = value;
  if (typeof name !== 'string' || name.length === 0) return null;
  if (typeof joinedAt !== 'number') return null;

  return typeof playerId === 'string' ? { name, joinedAt, playerId } : { name, joinedAt };
}

function parsePlayers(value: unknown): Record<string, Player> {
  if (!isObject(value)) return {};

  const players: Record<string, Player> = {};
  for (const [uid, entry] of Object.entries(value)) {
    const player = parsePlayer(entry);
    if (player) players[uid] = player;
  }
  return players;
}

function parseScores(value: unknown): Record<string, number> {
  if (!isObject(value)) return {};

  const scores: Record<string, number> = {};
  for (const [uid, entry] of Object.entries(value)) {
    if (typeof entry === 'number') scores[uid] = entry;
  }
  return scores;
}

/**
 * Validated on the way out of storage as well as in, exactly as `parseLog` and
 * `cleanName` are: what is there is whatever an earlier build wrote, or whatever
 * somebody with the console open decided to put there instead.
 *
 * A snapshot missing its `gameId` is dropped whole rather than repaired. Half a
 * podium is worse than none — the screen falls back to the live room, which is
 * where it was before any of this existed.
 */
export function parseSnapshot(raw: string | null): FinalSnapshot {
  if (!raw) return EMPTY;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isObject(parsed)) return EMPTY;

    const { gameId } = parsed;
    if (typeof gameId !== 'string') return EMPTY;

    return {
      gameId,
      players: parsePlayers(parsed.players),
      scores: parseScores(parsed.scores),
    };
  } catch {
    return EMPTY;
  }
}

function storedSnapshot(): FinalSnapshot {
  try {
    return parseSnapshot(window.sessionStorage.getItem(STORAGE_KEY));
  } catch {
    // Private windows and locked-down profiles throw on access, which simply
    // puts this device back where every device was before this was written.
    return EMPTY;
  }
}

function storeSnapshot(snapshot: FinalSnapshot): void {
  if (!snapshot.gameId) return;

  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Nothing is lost that was not already lost: the snapshot stays in memory
    // and a reload falls back to the live room, as it always did.
  }
}

/**
 * The room as it stood at the whistle — who was in it and what they scored.
 *
 * The final screen used to read both straight off the live room, and `leave`
 * deletes `players.{uid}` from the document (`useRoom.ts`), so one person
 * pressing Leave re-indexed the risers on **every other device in the room**.
 * The winner could slide off the middle plinth while the fanfare was still
 * playing, the standings shrank underneath it, and the chair emptied.
 *
 * Nothing is lost by freezing. The scores map is never cleaned up on a leave —
 * only `players` is — so the numbers were always still there; they were merely
 * filtered out of every view by a membership test that had no business running
 * after the game was over.
 *
 * **Safe to take on the first `finished` render.** Scores are applied on the
 * `reveal` transition and the phase reaches `finished` two transitions later
 * carrying the same map, so a snapshot can never catch the phase ahead of the
 * numbers. A client arriving at an already-finished room gets both in its first
 * document read.
 *
 * Captured with a `useState` adjusted during render rather than a ref or an
 * effect. That is not a preference: `react-hooks/refs` rejects the first and
 * `react-hooks/set-state-in-effect` the second, which is why the replay's frozen
 * timeline is written the same way. Storing it *is* an effect, which is allowed
 * because writing to storage is a side effect and not a state update.
 */
export function useFinalSnapshot(room: RoomState | null): FinalSnapshot | null {
  const [snapshot, setSnapshot] = useState<FinalSnapshot>(storedSnapshot);

  if (room && room.phase === 'finished' && snapshot.gameId !== room.gameId) {
    setSnapshot({ gameId: room.gameId, players: room.players, scores: room.scores });
  }

  useEffect(() => {
    storeSnapshot(snapshot);
  }, [snapshot]);

  // A snapshot of the previous game in this room is not this game's, and
  // "Another round" reuses the room. Returning null rather than an empty
  // snapshot keeps the caller honest: there is no podium yet, as opposed to a
  // podium with nobody on it.
  if (!room?.gameId || snapshot.gameId !== room.gameId) return null;
  return snapshot;
}
