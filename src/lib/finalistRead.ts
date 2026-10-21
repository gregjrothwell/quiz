import type { RoomState } from '../engine/state';

/**
 * The two season rows to read when a final opens.
 *
 * Keyed on the finalists' player ids, which default to the uid — the same
 * lookup the opening titles use. One object per final, so a stage change does
 * not become another read.
 */
export interface FinalistRead {
  gameId: string;
  finalists: { uid: string; playerId: string }[];
}

export function finalistReadFor(room: RoomState | null): FinalistRead | null {
  if (!room || room.phase !== 'standoff' || !room.standoff || !room.gameId) return null;
  return {
    gameId: room.gameId,
    finalists: room.standoff.finalists.map((uid) => ({
      uid,
      playerId: room.players[uid]?.playerId ?? uid,
    })),
  };
}

/** Stable across renders that describe the same two rows. */
export function finalistReadKey(read: FinalistRead): string {
  return JSON.stringify(read);
}

/**
 * The inverse of {@link finalistReadKey}. The hook's effect depends on the
 * string alone, so it has to recover the two ids from that string rather than
 * from a ref written during render.
 */
export function finalistReadFromKey(key: string): FinalistRead | null {
  try {
    const parsed: unknown = JSON.parse(key);
    if (!parsed || typeof parsed !== 'object') return null;
    const record = parsed as { gameId?: unknown; finalists?: unknown };
    if (typeof record.gameId !== 'string' || !Array.isArray(record.finalists)) return null;

    const finalists: FinalistRead['finalists'] = [];
    for (const entry of record.finalists) {
      if (!entry || typeof entry !== 'object') return null;
      const row = entry as { uid?: unknown; playerId?: unknown };
      if (typeof row.uid !== 'string' || typeof row.playerId !== 'string') return null;
      finalists.push({ uid: row.uid, playerId: row.playerId });
    }
    return { gameId: record.gameId, finalists };
  } catch {
    return null;
  }
}
