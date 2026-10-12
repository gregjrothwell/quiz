/**
 * How many chips one lectern shows at the reveal before it starts counting
 * instead.
 *
 * Twelve so that no room played so far changes at all: the biggest has been
 * eleven (`RX4P`, `CX5E`, 9–10 September 2026). The limit exists for a game of
 * thirty, where On the box's usual 83–90% puts some twenty-six names on the
 * right lectern — measured in the preview at 1440×900, that lectern grew from
 * 99px to 440px, stretched its neighbour with it, and pushed C and D under the
 * transport. And it grew *during* the replay, a chip at a time, so the
 * lecterns slid down the screen while the room was watching them.
 */
export const CROWD_LIMIT = 12;

/**
 * The chips a lectern shows, and how many it folds into a count.
 *
 * The first arrivals keep their places — the replay is a race, and the front
 * of it is the story. Two kinds of chip are never folded away, wherever they
 * landed: **your own**, because the chip exists so you can find yourself; and
 * **a snap guess**, because that marker is a deterrent, and one hidden in
 * "+15" deters nobody. Arrival order holds among everything shown.
 */
export function visibleCrowd<T extends { isYou: boolean; snap: boolean }>(
  arrivals: readonly T[],
): { shown: T[]; hidden: number } {
  if (arrivals.length <= CROWD_LIMIT) return { shown: [...arrivals], hidden: 0 };

  const shown = arrivals.filter(
    (arrival, position) => position < CROWD_LIMIT - 1 || arrival.isYou || arrival.snap,
  );
  return { shown, hidden: arrivals.length - shown.length };
}
