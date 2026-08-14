/**
 * The name this browser last played under.
 *
 * Identity itself already survives a session: the anonymous auth uid is durable
 * per browser, which is what the season table is keyed on — see season.ts. What
 * did not survive was the label attached to it, so a regular came back to an
 * empty box and typed the same six letters every week.
 *
 * Storage rather than the season row, which holds the same string server-side.
 * The landing screen wants a name before it has signed anybody in or fetched
 * anything, and reading it from Firestore would be a document read per player
 * per visit for something the browser already knows. The two go missing
 * together anyway — clearing site data takes the auth uid with it.
 */

const STORAGE_KEY = 'vibequiz.name';

/**
 * As much name as a leaderboard tile can hold before it starts reflowing around
 * somebody's full title. Lives here rather than on the input so the cap that is
 * typeable and the cap that is storable cannot drift apart.
 */
export const MAX_NAME_LENGTH = 24;

/**
 * A name as the game should hold it, or the empty string if there isn't one.
 *
 * Applied on the way out of storage as well as on the way in, because what is
 * in storage is whatever some earlier build wrote there — or whatever a bored
 * player with the console open decided to put there instead.
 */
export function cleanName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, MAX_NAME_LENGTH).trim();
}

export function rememberedName(): string {
  try {
    return cleanName(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    // Private windows and locked-down profiles throw on access. An unreadable
    // name is simply an empty box, which is where everyone started.
    return '';
  }
}

export function rememberName(name: string): void {
  const clean = cleanName(name);
  if (!clean) return;

  try {
    window.localStorage.setItem(STORAGE_KEY, clean);
  } catch {
    // Nothing is lost by failing here: the name is already in the room for this
    // game, and this device just asks for it again next time.
  }
}
