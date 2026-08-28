import type { Player } from './state';

/**
 * Hermes against Bundae, while the round is still being played.
 *
 * Squads did nothing until the board *after* the game, which is most of the way
 * to not having squads at all — the whole point of a side is watching it win or
 * lose in the room. The scores are already in the room document, so this costs
 * no reads and no writes; it is arithmetic over what every client is holding.
 *
 * The one thing on the room that is new is `squad` on the player entry, which
 * needs a rules paste — `playerOk` validates entries with `hasOnly`.
 */

/**
 * Which side somebody's points count for tonight.
 *
 * **A Lurker's pick where they made one, and their own squad otherwise**, which
 * is the rule `docs/decisions/season.md` calls the only clever part: some
 * regulars belong to neither side and sit with either on the night, so the
 * week's row is filed under whoever they sat with while their season record
 * still says Lurkers.
 *
 * **Shared with `season.ts` rather than copied.** `weekSquad` there applies this
 * exact rule to decide which weekly bucket a game lands in, and the live board
 * turns into that board an hour later. Two copies would not look like a bug when
 * they drifted — they would look like the room disagreeing with the record, on a
 * screen showing both. Same reasoning that pulled out `liveAnswers`.
 *
 * The guard is that only a Lurker is ever *asked* who they are sitting with, and
 * `playingWith` outlives a squad change in session storage: somebody who was a
 * Lurker last week and is Hermes today counts for Hermes.
 */
export function sideFor(squad: string, playingWith: string): string {
  if (squad !== 'Lurkers') return squad;
  return playingWith || squad;
}

export interface SquadRow {
  squad: string;
  score: number;
  /** How many of the room are on this side, for "Hermes · 3". */
  players: number;
}

/**
 * The room added up by side, highest first.
 *
 * Membership-filtered like `roomStandings`, and for the same reason: nothing
 * checks membership on the way in, so a client can write a score to a room it
 * never joined.
 *
 * **Somebody who has never named a squad is left out entirely** rather than
 * collected into an "unaligned" row. Their points are their own; inventing a
 * side for them would put a squad on the board that nobody is playing for, and
 * folding them into a real one would be worse.
 *
 * Ties break on the name so the bar does not swap about between renders — two
 * squads level is an ordinary state in a live round, and a board that twitches
 * on every question is one people stop reading.
 */
export function squadStandings(
  players: Record<string, Player>,
  scores: Record<string, number>,
): SquadRow[] {
  const totals = new Map<string, SquadRow>();

  for (const [uid, player] of Object.entries(players)) {
    const squad = player.squad ?? '';
    if (!squad) continue;

    const held = totals.get(squad) ?? { squad, score: 0, players: 0 };
    held.score += scores[uid] ?? 0;
    held.players += 1;
    totals.set(squad, held);
  }

  return [...totals.values()].sort(
    (a, b) => b.score - a.score || a.squad.localeCompare(b.squad, 'en-GB'),
  );
}
