import { TRACE_DEVICES, type TraceDevice } from './q1Trace';

/**
 * The error beacon (docs/decisions/slop-cannon.md, A1–A6): every message a
 * player is shown in `.notice`, and every uncaught error, written down where
 * `npm run read-errors` can read it.
 *
 * Built for 22 October 2026, when no round banked for anybody and every device
 * showed "Missing or insufficient permissions" over the podium. We found out
 * because Greg was in the room.
 *
 * Pure: the shape, the bounds, and the per-page budget. `src/lib/clientErrors.ts`
 * does the write.
 */

/** Where it came from: a notice on screen, an uncaught error, an unhandled rejection. */
export const ERROR_SOURCES = ['notice', 'error', 'rejection'] as const;
export type ErrorSource = (typeof ERROR_SOURCES)[number];

export const ERROR_PHASES = ['lobby', 'question', 'reveal', 'scoreboard', 'standoff', 'finished'] as const;

/** The rules' ceilings. The client clamps to them so a long message is kept, not refused. */
export const MAX_MESSAGE = 300;
export const MAX_ROOM = 8;
export const MAX_GAME_ID = 64;
export const MAX_BUILD = 32;

/** A page that is failing in a loop must not become a write storm. */
export const MAX_PER_PAGE = 20;

/**
 * The document, less the server's `at`. **No names, no answers, no uid**: a
 * message is text the app wrote, and the room and game are enough to find the
 * round in `games/`.
 */
export interface ClientErrorDoc {
  message: string;
  source: ErrorSource;
  build: string;
  device: TraceDevice;
  room?: string;
  phase?: string;
  gameId?: string;
}

export interface ErrorContext {
  room: string | null;
  phase: string | null;
  gameId: string | null;
}

export const NO_ROOM: ErrorContext = { room: null, phase: null, gameId: null };

/** What the rules will take: clamped, and anything that would be refused left off. */
export function errorDoc(
  message: string,
  source: ErrorSource,
  context: ErrorContext,
  build: string,
  device: TraceDevice,
): ClientErrorDoc {
  const doc: ClientErrorDoc = {
    message: message.slice(0, MAX_MESSAGE),
    source,
    build: build.slice(0, MAX_BUILD),
    device: TRACE_DEVICES.includes(device) ? device : 'other',
  };
  if (context.room && context.room.length <= MAX_ROOM) doc.room = context.room;
  if (context.phase && (ERROR_PHASES as readonly string[]).includes(context.phase)) doc.phase = context.phase;
  if (context.gameId) doc.gameId = context.gameId.slice(0, MAX_GAME_ID);
  return doc;
}

/**
 * The bundle's hash — `index-t7PF9llL` — from the entry script's URL, which is
 * how the handover names a release. `dev` under Vite's dev server, where the
 * entry is `/src/main.tsx`.
 */
export function buildFrom(scriptSources: readonly string[]): string {
  for (const source of scriptSources) {
    const match = /\/assets\/(index-[A-Za-z0-9_-]+)\.js/.exec(source);
    if (match?.[1]) return match[1].slice(0, MAX_BUILD);
  }
  return 'dev';
}

/**
 * The per-page budget (A3): at most {@link MAX_PER_PAGE} writes, and one
 * message at one room step once. The step is the same `gameId:index:phase`
 * that clears a stale notice, so a retry that fails the same way on the same
 * question is one row, and the same failure on the next question is another.
 */
export function createBeaconBudget(max = MAX_PER_PAGE): (message: string, step: string) => boolean {
  const seen = new Set<string>();
  return (message, step) => {
    if (seen.size >= max) return false;
    const key = `${step}\u0000${message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  };
}

/** A thrown value as a line of text. Errors give their message; anything else is named, not dumped. */
export function messageOf(cause: unknown): string {
  if (cause instanceof Error) return cause.message || cause.name;
  if (typeof cause === 'string') return cause;
  return `Non-error thrown: ${typeof cause}`;
}
