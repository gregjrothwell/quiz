/**
 * The Slop Cannon read back and switched, for `read-cannon` and `cannon`
 * (docs/decisions/slop-cannon.md, C4 and D4). Pure, so `npm test` covers it;
 * the scripts only fetch, print and write.
 */

export interface KeptRound {
  gameId: string;
  players: readonly string[];
  shots: readonly string[];
}

export interface VerdictRow {
  gameId: string;
  shot: string;
  uid: string;
  verdict: 'keep' | 'bin';
}

export interface ShotTally {
  shot: string;
  rounds: number;
  keep: number;
  bin: number;
  /** Players in a round the shot was loaded into who left no verdict on it. */
  silent: number;
}

/** Per shot: rounds loaded, Keep, Bin, and how many players said nothing (D4). */
export function tallyShots(rounds: readonly KeptRound[], verdicts: readonly VerdictRow[]): ShotTally[] {
  const tallies = new Map<string, ShotTally>();
  const voted = new Set(verdicts.map((row) => `${row.gameId}\u0000${row.shot}\u0000${row.uid}`));
  const tally = (shot: string): ShotTally => {
    let found = tallies.get(shot);
    if (!found) {
      found = { shot, rounds: 0, keep: 0, bin: 0, silent: 0 };
      tallies.set(shot, found);
    }
    return found;
  };

  for (const round of rounds) {
    for (const shot of round.shots) {
      const entry = tally(shot);
      entry.rounds += 1;
      entry.silent += round.players.filter((uid) => !voted.has(`${round.gameId}\u0000${shot}\u0000${uid}`)).length;
    }
  }
  for (const row of verdicts) {
    const entry = tally(row.shot);
    if (row.verdict === 'keep') entry.keep += 1;
    else entry.bin += 1;
  }
  return [...tallies.values()].sort((a, b) => b.rounds - a.rounds || a.shot.localeCompare(b.shot));
}

export function formatTally(tally: ShotTally): string {
  return `${tally.shot.padEnd(24)} ${String(tally.rounds).padStart(3)} rounds   `
    + `keep ${String(tally.keep).padStart(3)}   bin ${String(tally.bin).padStart(3)}   `
    + `no vote ${String(tally.silent).padStart(3)}`;
}

/** `config/cannon`'s `off` list after `cannon off|on <id>`, sorted, without duplicates. */
export function switched(off: readonly string[], action: 'off' | 'on', id: string): string[] {
  const next = new Set(off);
  if (action === 'off') next.add(id);
  else next.delete(id);
  return [...next].sort();
}
