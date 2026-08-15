/**
 * One player's season record, as it is stored.
 *
 * Honours are optional because almost every row on the board predates them, and
 * a client one deploy behind writes none. Absent means none rather than unknown.
 */
export interface PlayerRecord {
  name: string;
  played: number;
  wins: number;
  points: number;
  best: number;
  fastest?: number;
  comeback?: number;
  loneWolf?: number;
  contrarian?: number;
  /** The last game banked here, so the same one cannot count twice. */
  lastGame: string;
  lastPlayed: number;
}

/**
 * Folds a record into another, for a browser that has just claimed an identity.
 *
 * Here rather than beside the transaction that writes it because this is the
 * part that can quietly corrupt somebody's season, and a transaction is not
 * something a test can reach. The Firestore half is in `src/lib/season.ts` and
 * does nothing but read two documents, call this, and write one back.
 *
 * Three decisions worth keeping:
 *
 * - **`best` is a maximum, everything else a sum.** A personal best is not made
 *   better by having been achieved on two devices.
 * - **The name comes from the identity being adopted**, which is the one already
 *   on the board the claimer is joining. It falls back to the incoming record's
 *   for a code minted before its owner had ever finished a round, where there is
 *   no target row at all.
 * - **`lastGame` follows whichever side played most recently.** That field is
 *   the guard against a reload banking the same game twice, so it has to
 *   describe the most recent game either side actually played — otherwise
 *   claiming straight after a round and then reloading the final screen would
 *   count that round again.
 *
 * The rules' own bounds survive this: `wins <= played` and each honour
 * `<= played` hold when both sides are summed, and `best <= points` holds
 * because a maximum of two bests cannot exceed the sum of two point totals.
 */
export function foldRecords(source: PlayerRecord, target: PlayerRecord | null): PlayerRecord {
  const newest = target && target.lastPlayed > source.lastPlayed ? target : source;

  return {
    name: target?.name ?? source.name,
    played: (target?.played ?? 0) + source.played,
    wins: (target?.wins ?? 0) + source.wins,
    points: (target?.points ?? 0) + source.points,
    best: Math.max(target?.best ?? 0, source.best),
    fastest: (target?.fastest ?? 0) + (source.fastest ?? 0),
    comeback: (target?.comeback ?? 0) + (source.comeback ?? 0),
    loneWolf: (target?.loneWolf ?? 0) + (source.loneWolf ?? 0),
    contrarian: (target?.contrarian ?? 0) + (source.contrarian ?? 0),
    lastGame: newest.lastGame,
    lastPlayed: newest.lastPlayed,
  };
}
