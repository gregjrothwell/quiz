/**
 * Which squad a player's record belongs to — Hermes against Bundae, so the
 * board can be read as your side rather than the whole office.
 *
 * > **The stored field is still `team`.** It is bounded by name in
 * > `firestore.rules`, and the season row is validated with `hasOnly`, so
 * > renaming it would cost a hand-paste in the console *and* orphan every value
 * > already written. The two names meet in exactly one place — the mapping in
 * > `src/lib/season.ts` — and nowhere else in the app says "team".
 *
 * This began as free text, on the reasoning that every office needs a different
 * list. One office turned out to need three names, and a fixed list buys two
 * things free text could not: the board cannot be split by a typo, and "which
 * squad am I in" stops being a question you can get wrong.
 *
 * The cost is that a value outside the list can still exist. The board carried
 * exactly one — cleared by hand on 19 August 2026 — but the rules accept any
 * string up to 40 characters, so anything written by an older bundle or by
 * somebody with the console open still arrives here. Those are kept and shown
 * rather than rewritten: quietly reassigning somebody's squad is worse than
 * showing one the picker no longer offers, and the season screen is where they
 * can change it deliberately.
 */

/** Matches the bound in firestore.rules, which is what actually enforces it. */
export const MAX_SQUAD_LENGTH = 40;

/**
 * Every squad, in the order they are offered.
 *
 * **Lurkers is a squad, not an absence.** Some regulars belong to neither side
 * and may sit with either on the night; giving them a name means they appear on
 * the board as themselves rather than as a blank. Where they played on a given
 * week is recorded separately — see `playingWith` in `src/lib/season.ts`.
 */
export const SQUADS = ['Hermes', 'Bundae', 'Lurkers'] as const;

export type Squad = (typeof SQUADS)[number];

/** Whether a stored or typed value is one the picker still offers. */
export function isSquad(value: unknown): value is Squad {
  return typeof value === 'string' && (SQUADS as readonly string[]).includes(value);
}

/**
 * A squad name as the season should hold it, or the empty string for none.
 *
 * Still tolerant of anything, rather than narrowed to {@link SQUADS}, because
 * it runs on the way *out* of Firestore as well as in — and what is in
 * Firestore includes rows written before the list existed. Narrowing here would
 * erase those from the board rather than displaying them.
 */
export function cleanSquad(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, MAX_SQUAD_LENGTH).trim();
}

/**
 * What two spellings of the same squad have in common.
 *
 * Case and surrounding space only. It matters less now the list is fixed, but
 * it is what keeps a legacy `engineering` and `Engineering` on one row of
 * chips instead of two.
 */
export function squadKey(squad: string): string {
  return cleanSquad(squad).toLowerCase();
}

/**
 * Every squad on the board, in the order they should be offered.
 *
 * Derived from the rows rather than from {@link SQUADS}, which is deliberate
 * and is what stops a legacy value disappearing: a record carrying a name the
 * picker no longer offers still gets a filter chip, so its holder can find
 * themselves. De-duplicated on the key rather than the name, so a board holding
 * both spellings of one squad offers one filter and not two.
 *
 * The known squads come first and in their own order — a filter row that reads
 * Hermes, Bundae, Lurkers is a statement about the office, where alphabetical
 * order would bury Lurkers between two strangers. Anything else follows,
 * sorted.
 */
export function squadsOf(records: { squad?: string }[]): string[] {
  const seen = new Map<string, string>();

  for (const record of records) {
    const squad = cleanSquad(record.squad);
    if (squad && !seen.has(squadKey(squad))) seen.set(squadKey(squad), squad);
  }

  // Compared on the key, not on `isSquad`. A record stored as `hermes` keys to
  // the same chip as `Hermes` and must not also appear as a legacy one — which
  // is exactly what a case-sensitive membership test would have done.
  const knownKeys = new Set(SQUADS.map(squadKey));

  const known = SQUADS.filter((squad) => seen.has(squadKey(squad)));
  const legacy = [...seen.entries()]
    .filter(([key]) => !knownKeys.has(key))
    .map(([, squad]) => squad)
    .sort((a, b) => a.localeCompare(b, 'en-GB'));

  return [...known, ...legacy];
}
