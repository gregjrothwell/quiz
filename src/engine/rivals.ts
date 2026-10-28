import { morningTotals } from './double';
import type { FirstHalf } from './state';

/**
 * Who you have finished ahead of, and behind, across the season.
 *
 * A tie is neither. The caption names whoever leads each list, and names
 * every joint leader, the same way the opening titles name a shared champion.
 * The giant-killer bonus is not this: it wants a measurement first, and it
 * would be a scoring change. docs/decisions/rivals.md.
 */

/**
 * Distinct opponents one row will hold.
 *
 * An office season fits. Past this the coldest rows drop, and a leader is
 * never the coldest, so the caption still names the right people. The same
 * number is the rules' `rivals.size()` cap — rules cannot walk a map, so the
 * bound is the size and not each entry.
 */
export const RIVALS_CAP = 40;

/** A Firestore map key: a uid or a claimed playerId, never a path. */
const RIVAL_ID = /^[A-Za-z0-9_-]{1,128}$/;

/** The season row's own name bound. A rival's name is a name. */
const MAX_RIVAL_NAME = 40;

/** One opponent, as the season row stores them. */
export interface Rival {
  name: string;
  /** Rounds you finished strictly ahead. */
  beaten: number;
  /** Rounds they finished strictly ahead. */
  lost: number;
}

/** Someone else on the result the room just ranked. */
export interface NightOpponent {
  playerId: string;
  name: string;
  score: number;
}

function tidyName(raw: string): string {
  return raw.trim().slice(0, MAX_RIVAL_NAME).trim();
}

function usable(id: string, rival: Rival | undefined): Rival | null {
  if (!rival || !RIVAL_ID.test(id)) return null;
  const name = tidyName(rival.name);
  if (!name || !Number.isInteger(rival.beaten) || !Number.isInteger(rival.lost)) return null;
  if (rival.beaten < 0 || rival.lost < 0) return null;
  if (rival.beaten === 0 && rival.lost === 0) return null;
  return { name, beaten: rival.beaten, lost: rival.lost };
}

/**
 * Keeps the opponents the caption can still name once the map is over the cap.
 *
 * Sorted by the larger of the two counts, then by how often you've met, then
 * by id. Dropping the tail cannot change who leads either list unless more
 * than {@link RIVALS_CAP} people are tied for that lead.
 */
function capRivals(rivals: Record<string, Rival>): Record<string, Rival> | undefined {
  const entries = Object.entries(rivals);
  if (entries.length === 0) return undefined;
  if (entries.length <= RIVALS_CAP) return rivals;
  entries.sort((left, right) => {
    const leftMax = Math.max(left[1].beaten, left[1].lost);
    const rightMax = Math.max(right[1].beaten, right[1].lost);
    if (rightMax !== leftMax) return rightMax - leftMax;
    const leftSum = left[1].beaten + left[1].lost;
    const rightSum = right[1].beaten + right[1].lost;
    if (rightSum !== leftSum) return rightSum - leftSum;
    return left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0;
  });
  return Object.fromEntries(entries.slice(0, RIVALS_CAP));
}

/**
 * What one finished round does to the map.
 *
 * An empty night leaves the map as it was: a solo round, or a caller from
 * before this field, must not wipe it. A tie against someone new writes
 * nothing. A tie against someone already there refreshes their name and
 * leaves the counts.
 */
export function meetRivals(
  existing: Readonly<Record<string, Rival>> | undefined,
  resultScore: number,
  opponents: readonly NightOpponent[],
): Record<string, Rival> | undefined {
  const next: Record<string, Rival> = {};
  for (const [id, rival] of Object.entries(existing ?? {})) {
    const clean = usable(id, rival);
    if (clean) next[id] = clean;
  }

  if (!Number.isFinite(resultScore)) return capRivals(next);

  const seen = new Set<string>();
  for (const opponent of opponents) {
    if (!RIVAL_ID.test(opponent.playerId) || seen.has(opponent.playerId)) continue;
    seen.add(opponent.playerId);
    const name = tidyName(opponent.name);
    if (!name || !Number.isFinite(opponent.score)) continue;

    const held = next[opponent.playerId];
    const beaten = (held?.beaten ?? 0) + (resultScore > opponent.score ? 1 : 0);
    const lost = (held?.lost ?? 0) + (resultScore < opponent.score ? 1 : 0);
    if (beaten === 0 && lost === 0) continue;
    next[opponent.playerId] = { name, beaten, lost };
  }

  return capRivals(next);
}

/**
 * Two devices claiming one identity. Counts add. The name comes from
 * whichever side played more recently, which is the name the room just saw.
 */
export function foldRivals(
  source: Readonly<Record<string, Rival>> | undefined,
  target: Readonly<Record<string, Rival>> | undefined,
  preferSourceName: boolean,
): Record<string, Rival> | undefined {
  const ids = new Set([...Object.keys(source ?? {}), ...Object.keys(target ?? {})]);
  const next: Record<string, Rival> = {};
  for (const id of ids) {
    const left = usable(id, source?.[id]);
    const right = usable(id, target?.[id]);
    if (!left && !right) continue;
    const preferred = preferSourceName ? (left ?? right) : (right ?? left);
    const name = preferred?.name ?? '';
    const beaten = (left?.beaten ?? 0) + (right?.beaten ?? 0);
    const lost = (left?.lost ?? 0) + (right?.lost ?? 0);
    if (!name || (beaten === 0 && lost === 0)) continue;
    next[id] = { name, beaten, lost };
  }
  return capRivals(next);
}

/** Everyone with an answer on any question in a log of the round. */
export function answeredIn(log: readonly { answers: Readonly<Record<string, unknown>> }[]): Set<string> {
  const answered = new Set<string>();
  for (const record of log) for (const uid of Object.keys(record.answers)) answered.add(uid);
  return answered;
}

/**
 * Whether a seat played the round: answered something, or ended on a score.
 *
 * A seat alone is not enough. Joining seeds a score of 0, so someone who
 * joined room 6JA5 eight seconds before the final screen would otherwise be
 * someone the whole room had beaten. A score that is not 0 counts without an
 * answer here, which is the morning of a double seen from round two.
 */
export function tookPart(uid: string, total: number, answered: ReadonlySet<string>): boolean {
  return answered.has(uid) || total !== 0;
}

/**
 * The result the room ranked, as opponents of `youUid`.
 *
 * Ordinary rounds and half-time use the round. Round two of a double banks a
 * residual and ranks the morning, so the head-to-head follows the morning —
 * the table the podium just showed. Someone who was not on that table is not
 * an opponent, nor is someone who sat there without playing
 * ({@link tookPart}), and neither are you.
 */
export function nightAgainst(
  youUid: string,
  players: Readonly<Record<string, { name: string; playerId?: string }>>,
  scores: Readonly<Record<string, number>>,
  double: FirstHalf | null,
  /** Who answered a question this round, from the log this device kept. */
  answered: ReadonlySet<string>,
): { resultScore: number; opponents: NightOpponent[] } {
  const totals = morningTotals({ double, scores: { ...scores } });
  const you = players[youUid];
  const selfId = you?.playerId ?? youUid;
  const opponents: NightOpponent[] = [];
  const seen = new Set<string>([selfId]);

  for (const [uid, player] of Object.entries(players)) {
    if (uid === youUid) continue;
    if (!Object.hasOwn(totals, uid)) continue;
    if (!tookPart(uid, totals[uid] ?? 0, answered)) continue;
    const playerId = player.playerId ?? uid;
    if (seen.has(playerId)) continue;
    seen.add(playerId);
    opponents.push({ playerId, name: player.name, score: totals[uid] ?? 0 });
  }

  opponents.sort((left, right) => (left.playerId < right.playerId ? -1 : left.playerId > right.playerId ? 1 : 0));
  return { resultScore: totals[youUid] ?? 0, opponents };
}

interface Lead {
  ids: string[];
  names: string[];
  count: number;
}

function leadOf(rivals: Readonly<Record<string, Rival>>, field: 'beaten' | 'lost'): Lead | null {
  let best = 0;
  for (const rival of Object.values(rivals)) best = Math.max(best, rival[field]);
  if (best <= 0) return null;

  const holders = Object.entries(rivals)
    .filter(([, rival]) => rival[field] === best)
    .sort((left, right) => left[1].name.localeCompare(right[1].name, 'en-GB') || (left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0));

  return {
    ids: holders.map(([id]) => id).sort(),
    names: holders.map(([, rival]) => rival.name),
    count: best,
  };
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function named(names: readonly string[]): string {
  return names.join(' & ');
}

/** "once", "4 times", and "4 times each" when the lead is shared. */
function times(count: number, shared: boolean): string {
  if (count === 1) return shared ? 'once each' : 'once';
  return shared ? `${count} times each` : `${count} times`;
}

/** "Sam most this season — 4 times", without the verb, so two clauses can share one "You’ve". */
function detail(lead: Lead, withSeason: boolean): string {
  const shared = lead.names.length > 1;
  const season = withSeason ? ' this season' : '';
  const tail = lead.count === 1 && !shared ? '' : ` — ${times(lead.count, shared)}`;
  return `${named(lead.names)} most${season}${tail}`;
}

/**
 * The line under your season, or nothing when there is nobody to name.
 *
 * A shared lead names everyone, sorted, so the sentence does not depend on
 * map order. The same person leading both lists is one sentence, not two
 * that contradict each other.
 */
export function rivalsCaption(rivals: Readonly<Record<string, Rival>> | undefined): string | null {
  if (!rivals) return null;
  const beaten = leadOf(rivals, 'beaten');
  const lost = leadOf(rivals, 'lost');
  if (!beaten && !lost) return null;

  if (beaten && lost && sameIds(beaten.ids, lost.ids)) {
    const who = named(beaten.names);
    if (beaten.count === lost.count) {
      return beaten.names.length === 1
        ? `You and ${who} are level this season — ${beaten.count} each.`
        : `Level with ${who} this season — ${beaten.count} each.`;
    }
    const them = beaten.names.length === 1 ? who : 'them';
    return `You’ve beaten ${who} most this season, and lost to ${them} most — ${beaten.count} and ${lost.count}.`;
  }

  if (beaten && lost) return `You’ve beaten ${detail(beaten, true)}, and lost to ${detail(lost, false)}.`;
  if (beaten) return `You’ve beaten ${detail(beaten, true)}.`;
  return `You’ve lost to ${detail(lost as Lead, true)}.`;
}

/**
 * A rivals map as read off a season document. Anything the rules could not
 * walk — a bad entry, a blank name — is dropped rather than shown.
 */
export function rivalsFrom(raw: unknown): Record<string, Rival> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const next: Record<string, Rival> = {};
  for (const [id, value] of Object.entries(raw)) {
    if (typeof value !== 'object' || value === null) continue;
    const entry = value as { name?: unknown; beaten?: unknown; lost?: unknown };
    const clean = usable(id, {
      name: typeof entry.name === 'string' ? entry.name : '',
      beaten: typeof entry.beaten === 'number' ? entry.beaten : -1,
      lost: typeof entry.lost === 'number' ? entry.lost : -1,
    });
    if (clean) next[id] = clean;
  }
  return next;
}
