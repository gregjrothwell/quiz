/**
 * What the season already knows about the people in this room.
 *
 * The league had a table and nothing else. Ten weeks of quizzes left a column of
 * numbers on a screen most people looked at once, and every round opened as if
 * nobody in it had ever played before. This is the part that makes it a series:
 * before question one, the room is told who it contains.
 *
 * Keyed on uid rather than playerId, because the room is what renders the names
 * and the room is keyed on uid. Turning one into the other happens where the
 * digest is assembled — see `formFor`'s caller.
 */

/** One player's season, reduced to what a title card could say about them. */
export interface FormRecord {
  uid: string;
  played: number;
  wins: number;
  best: number;
  rosettes: number;
}

/**
 * Facts rather than sentences, on the same principle as the awards and the
 * review. A title card is the most tempting place in the app to bake copy into
 * the engine and the worst place to have done it, because the wording is the
 * whole point of the feature.
 */
export type FormFact =
  | { id: 'champion'; uids: string[]; wins: number }
  | { id: 'best'; uids: string[]; points: number }
  | { id: 'rosettes'; uids: string[]; count: number }
  | { id: 'newcomers'; uids: string[] };

/**
 * Joint holders are all named and the list is sorted, so every device renders
 * the same card. Ties would otherwise follow object key order, which differs
 * between clients — the same failure the awards' joint winners avoid.
 */
function leaders(
  records: FormRecord[],
  of: (record: FormRecord) => number,
): { uids: string[]; value: number } {
  let best = 0;
  for (const record of records) best = Math.max(best, of(record));

  // Nothing to celebrate at zero. A room where nobody has ever won gets no
  // champion rather than a champion with no wins, which would be a lie told in
  // 60-point type.
  if (best <= 0) return { uids: [], value: 0 };

  return {
    uids: records.filter((record) => of(record) === best).map((record) => record.uid).sort(),
    value: best,
  };
}

/**
 * Everything worth putting on the card, in the order it is worth reading.
 *
 * A fact nothing supports is left out rather than shown empty, exactly as
 * `awardsFor` does — an opening title sequence with a blank in it is worse than
 * a shorter one.
 */
export function formFor(records: FormRecord[]): FormFact[] {
  if (records.length === 0) return [];

  const champion = leaders(records, (record) => record.wins);
  const best = leaders(records, (record) => record.best);
  const rosettes = leaders(records, (record) => record.rosettes);

  /*
    Anybody with no completed rounds at all. Sorted for the same reason as the
    rest, and deliberately not capped: a room of six new starters is a fact
    about that room worth stating, and the screen can decide how to say it.

    Note this is every newcomer, not "the newcomer" — it is the one fact here
    that is not a competition.
  */
  const newcomers = records
    .filter((record) => record.played === 0)
    .map((record) => record.uid)
    .sort();

  return [
    champion.uids.length > 0
      ? ({ id: 'champion', uids: champion.uids, wins: champion.value } as const)
      : null,
    best.uids.length > 0
      ? ({ id: 'best', uids: best.uids, points: best.value } as const)
      : null,
    rosettes.uids.length > 0
      ? ({ id: 'rosettes', uids: rosettes.uids, count: rosettes.value } as const)
      : null,
    newcomers.length > 0 ? ({ id: 'newcomers', uids: newcomers } as const) : null,
  ].filter((fact): fact is FormFact => fact !== null);
}
