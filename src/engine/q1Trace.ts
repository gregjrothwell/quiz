import type { Phase } from './state';
import { estimateSkew, questionOriginMs, rememberDelta, type ClockDeltas } from './roomClock';

/**
 * What one device saw of question one, kept so "I answered in time" can be
 * checked rather than believed.
 *
 * Built 21 October 2026 for Cass, who loses question one on a third of her
 * 10-second rounds and none of her 15-second ones, with her question-one
 * answers landing seconds behind her own clock and no later answer doing so.
 * The kept rounds cannot say whether those seconds are her device **seeing the
 * question late** or **its first write taking that long** — the two want
 * different fixes, and only the device knows. See docs/decisions/cass-q1.md.
 *
 * Every device writes one, not hers alone: question one loses two to three
 * times as many answers as any other for everybody, and a uid filter in
 * `read-traces` finds her without her uid being in a public bundle.
 *
 * Pure apart from the two things it is handed, `now` and `write`, so the whole
 * life of a trace is testable here. `useRoom` feeds it; `src/lib/q1Trace.ts`
 * does the write.
 */

/** The question traced. Only the first: it is the one the shared clock cannot correct. */
export const TRACED_INDEX = 0;

/** Above this, a lag or an acknowledgement is worth naming. A 10s window cannot spare it. */
export const SLOW_MS = 1_500;

export const TRACE_DEVICES = ['ios', 'android', 'mac', 'windows', 'linux', 'other'] as const;
export type TraceDevice = (typeof TRACE_DEVICES)[number];

/** Why a tap reached `submitAnswer` and was not written: the two silent returns there. */
export const TRACE_DROPS = ['phase', 'window'] as const;
export type TraceDrop = (typeof TRACE_DROPS)[number];

/**
 * The document. Every duration is whole milliseconds on this device's clock
 * except `serverOffsetMs`, and the relative ones count from the moment this
 * device first saw question one confirmed by the server.
 *
 * Optional fields are **absent** rather than null when there is nothing to
 * say, the shape `wager` and `firstMs` already use on an answer.
 */
export interface Q1TraceDoc {
  gameId: string;
  roomCode: string;
  uid: string;
  durationMs: number;
  /** How far the shared clock put this device's start back. 0 = counted from its own arrival. */
  correctionMs: number;
  /** Clock readings this tab held before question one. 0 = a fresh tab, so an uncorrected clock. */
  priorSamples: number;
  /** Answer writes made on question one. More than one is a change of mind. */
  writes: number;
  device: TraceDevice;
  /** `navigator.connection.effectiveType`, where the browser has it. Safari does not. */
  network?: string;
  /** Local arrival − `openedAt`: this device's clock skew plus the delivery delay. */
  seenAfterOpenMs?: number;
  /** The RTDB's `.info/serverTimeOffset`: local + this = server. With the above, the delay alone. */
  serverOffsetMs?: number;
  /** How long the page had been visible when the question arrived. Absent: it was hidden. */
  visibleForMs?: number;
  /** The last answer write, from arrival. */
  tapMs?: number;
  /** The `elapsedMs` that write claimed. */
  tapElapsedMs?: number;
  /** That write to its acknowledgement or refusal. Absent: it never settled while traced. */
  ackMs?: number;
  /** The refusal's code, when there was one. */
  refused?: string;
  dropped?: TraceDrop;
  /** Arrival to this device seeing the room move past question one. */
  revealMs?: number;
  /** Whether the reveal scored this player. Absent when the reveal itself was never seen. */
  counted?: boolean;
}

/** Every key the document can carry — `firestore.rules` lists exactly these plus `at`. */
export const TRACE_KEYS = [
  'gameId',
  'roomCode',
  'uid',
  'durationMs',
  'correctionMs',
  'priorSamples',
  'writes',
  'device',
  'network',
  'seenAfterOpenMs',
  'serverOffsetMs',
  'visibleForMs',
  'tapMs',
  'tapElapsedMs',
  'ackMs',
  'refused',
  'dropped',
  'revealMs',
  'counted',
] as const satisfies readonly (keyof Q1TraceDoc)[];

/** The bounds the rules hold, so a strange reading is clamped rather than refusing the trace. */
const SKEW_LIMIT_MS = 86_400_000;
const SPAN_LIMIT_MS = 600_000;
const COUNT_LIMIT = 1_000;
const NETWORK_LIMIT = 16;
const REFUSED_LIMIT = 40;

/** The first server-confirmed snapshot of a question, as `useRoom` hears it. */
export interface SeenQuestion {
  gameId: string | null;
  roomCode: string;
  uid: string;
  index: number;
  durationMs: number;
  openedAtMs: number | null;
  arrivedAt: number;
  serverOffsetMs: number | null;
  /** This tab's clock readings before this question's own. */
  priorDeltas: ClockDeltas;
  /** When the page last became visible, or null while hidden. */
  visibleSince: number | null;
  device: TraceDevice;
  network: string | null;
}

/** Any snapshot of the room: where it has got to, and who the last reveal scored. */
export interface SeenRoom {
  gameId: string | null;
  phase: Phase;
  index: number;
  scoredUids: readonly string[];
}

interface Observation {
  gameId: string;
  roomCode: string;
  uid: string;
  durationMs: number;
  seenAt: number;
  correctionMs: number;
  priorSamples: number;
  device: TraceDevice;
  network: string | null;
  seenAfterOpenMs: number | null;
  serverOffsetMs: number | null;
  visibleForMs: number | null;
  writes: number;
  token: number;
  pending: boolean;
  tapAt: number | null;
  tapElapsedMs: number | null;
  settledAt: number | null;
  refused: string | null;
  dropped: TraceDrop | null;
  revealAt: number | null;
  counted: boolean | null;
}

export interface Q1Tracer {
  sawQuestion(seen: SeenQuestion): void;
  sawRoom(room: SeenRoom): void;
  /** An answer write has started. The token goes back to {@link settled}; null when untraced. */
  tapped(tap: { gameId: string | null; index: number; elapsedMs: number }): number | null;
  dropped(drop: { gameId: string | null; index: number; reason: TraceDrop }): void;
  settled(token: number, refused?: string): void;
  /** This device left the room: write what is known. */
  leave(): void;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, Math.round(value)));
}

function span(value: number): number {
  return clamp(value, 0, SPAN_LIMIT_MS);
}

export function toTraceDoc(seen: Observation): Q1TraceDoc {
  const trace: Q1TraceDoc = {
    gameId: seen.gameId,
    roomCode: seen.roomCode,
    uid: seen.uid,
    durationMs: span(seen.durationMs),
    correctionMs: span(seen.correctionMs),
    priorSamples: clamp(seen.priorSamples, 0, COUNT_LIMIT),
    writes: clamp(seen.writes, 0, COUNT_LIMIT),
    device: seen.device,
  };
  if (seen.network !== null) trace.network = seen.network.slice(0, NETWORK_LIMIT);
  if (seen.seenAfterOpenMs !== null) {
    trace.seenAfterOpenMs = clamp(seen.seenAfterOpenMs, -SKEW_LIMIT_MS, SKEW_LIMIT_MS);
  }
  if (seen.serverOffsetMs !== null) {
    trace.serverOffsetMs = clamp(seen.serverOffsetMs, -SKEW_LIMIT_MS, SKEW_LIMIT_MS);
  }
  if (seen.visibleForMs !== null) trace.visibleForMs = clamp(seen.visibleForMs, 0, SKEW_LIMIT_MS);
  if (seen.tapAt !== null) trace.tapMs = span(seen.tapAt - seen.seenAt);
  if (seen.tapElapsedMs !== null) trace.tapElapsedMs = span(seen.tapElapsedMs);
  if (seen.tapAt !== null && seen.settledAt !== null) trace.ackMs = span(seen.settledAt - seen.tapAt);
  if (seen.refused !== null) trace.refused = seen.refused.slice(0, REFUSED_LIMIT);
  if (seen.dropped !== null) trace.dropped = seen.dropped;
  if (seen.revealAt !== null) trace.revealMs = span(seen.revealAt - seen.seenAt);
  if (seen.counted !== null) trace.counted = seen.counted;
  return trace;
}

export function createQ1Tracer({
  now,
  write,
}: {
  now: () => number;
  write: (trace: Q1TraceDoc) => void;
}): Q1Tracer {
  let open: Observation | null = null;
  // Rounds already written, so a replayed snapshot of question one cannot
  // start a second trace for the same round. The rules refuse an update anyway;
  // this keeps the refusal from ever being sent.
  const done = new Set<string>();

  /** Write the open trace if it is complete — or regardless, when `force`. */
  function flush(force: boolean): void {
    if (!open) return;
    if (!force && (open.revealAt === null || open.pending)) return;
    const trace = toTraceDoc(open);
    done.add(open.gameId);
    open = null;
    write(trace);
  }

  return {
    sawQuestion(seen) {
      if (seen.gameId === null) return;
      if (seen.index !== TRACED_INDEX) {
        if (open?.gameId === seen.gameId) flush(true);
        return;
      }
      if (done.has(seen.gameId) || open?.gameId === seen.gameId) return;
      flush(true);

      // The correction worked out exactly as `useRoom` does for the clock, so
      // the trace reports the origin the countdown actually used.
      const key = `${seen.gameId}:${seen.index}`;
      const delta = seen.openedAtMs === null ? null : seen.arrivedAt - seen.openedAtMs;
      const deltas = delta === null ? seen.priorDeltas : rememberDelta(seen.priorDeltas, key, delta);
      const origin = questionOriginMs({
        openedAtMs: seen.openedAtMs,
        skewMs: estimateSkew(deltas),
        arrivedAt: seen.arrivedAt,
      });

      open = {
        gameId: seen.gameId,
        roomCode: seen.roomCode,
        uid: seen.uid,
        durationMs: seen.durationMs,
        seenAt: seen.arrivedAt,
        correctionMs: origin === null ? 0 : seen.arrivedAt - origin,
        priorSamples: Object.keys(seen.priorDeltas).filter((held) => held !== key).length,
        device: seen.device,
        network: seen.network,
        seenAfterOpenMs: delta,
        serverOffsetMs: seen.serverOffsetMs,
        visibleForMs: seen.visibleSince === null ? null : seen.arrivedAt - seen.visibleSince,
        writes: 0,
        token: 0,
        pending: false,
        tapAt: null,
        tapElapsedMs: null,
        settledAt: null,
        refused: null,
        dropped: null,
        revealAt: null,
        counted: null,
      };
    },

    sawRoom(room) {
      if (!open) return;
      if (room.gameId !== open.gameId) {
        flush(true);
        return;
      }
      if (room.phase === 'question' && room.index === TRACED_INDEX) return;

      const onTheReveal = room.phase === 'reveal' && room.index === TRACED_INDEX;
      if (open.revealAt === null) {
        open.revealAt = now();
        if (onTheReveal) open.counted = room.scoredUids.includes(open.uid);
      }
      // Waiting on the ack only while the room is still showing that reveal.
      // Past it, an answer write that has not settled is the finding.
      flush(!onTheReveal);
    },

    tapped({ gameId, index, elapsedMs }) {
      if (!open || open.gameId !== gameId || index !== TRACED_INDEX) return null;
      open.token += 1;
      open.writes += 1;
      open.pending = true;
      open.tapAt = now();
      open.tapElapsedMs = elapsedMs;
      open.settledAt = null;
      open.refused = null;
      return open.token;
    },

    dropped({ gameId, index, reason }) {
      if (!open || open.gameId !== gameId || index !== TRACED_INDEX) return;
      open.dropped = reason;
    },

    settled(token, refused) {
      // A superseded write's answer says nothing about the one that stands.
      if (!open || token !== open.token) return;
      open.pending = false;
      open.settledAt = now();
      if (refused !== undefined) open.refused = refused;
      flush(false);
    },

    leave() {
      flush(true);
    },
  };
}

/** A coarse device class from a user agent: phone or laptop is the question, not the model. */
export function deviceFrom(userAgent: string): TraceDevice {
  if (/iPhone|iPad|iPod/.test(userAgent)) return 'ios';
  if (/Android/.test(userAgent)) return 'android';
  if (/Macintosh|Mac OS X/.test(userAgent)) return 'mac';
  if (/Windows/.test(userAgent)) return 'windows';
  if (/Linux|X11/.test(userAgent)) return 'linux';
  return 'other';
}

export type TraceReading = 'late delivery' | 'slow write' | 'both' | 'neither' | 'unknown';

/**
 * Which of the two candidates a trace points at.
 *
 * `seenLagMs` is the delay in server time: arrival − `openedAt` plus the
 * device's offset from the server. A write made and never settled counts as
 * slow — not settling inside the trace's own life is the slow write at its worst.
 */
export function explainTrace(trace: Q1TraceDoc): { seenLagMs: number | null; reading: TraceReading } {
  const seenLagMs =
    trace.seenAfterOpenMs === undefined || trace.serverOffsetMs === undefined
      ? null
      : trace.seenAfterOpenMs + trace.serverOffsetMs;
  const writeMs = trace.ackMs ?? (trace.writes > 0 ? Number.POSITIVE_INFINITY : null);

  if (seenLagMs === null && writeMs === null) return { seenLagMs, reading: 'unknown' };
  const late = seenLagMs !== null && seenLagMs > SLOW_MS;
  const slow = writeMs !== null && writeMs > SLOW_MS;
  const reading: TraceReading = late && slow ? 'both' : late ? 'late delivery' : slow ? 'slow write' : 'neither';
  return { seenLagMs, reading };
}

function isInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

/** A trace read back with the Admin SDK, or null for anything the tracer would not have written. */
export function parseTrace(data: unknown): Q1TraceDoc | null {
  if (typeof data !== 'object' || data === null) return null;
  const raw = data as Record<string, unknown>;
  const { gameId, roomCode, uid, durationMs, correctionMs, priorSamples, writes, device } = raw;
  if (typeof gameId !== 'string' || typeof roomCode !== 'string' || typeof uid !== 'string') return null;
  if (!isInt(durationMs) || !isInt(correctionMs) || !isInt(priorSamples) || !isInt(writes)) return null;
  const knownDevice = TRACE_DEVICES.find((candidate) => candidate === device);
  if (knownDevice === undefined) return null;

  const trace: Q1TraceDoc = {
    gameId,
    roomCode,
    uid,
    durationMs,
    correctionMs,
    priorSamples,
    writes,
    device: knownDevice,
  };
  for (const key of ['seenAfterOpenMs', 'serverOffsetMs', 'visibleForMs', 'tapMs', 'tapElapsedMs', 'ackMs', 'revealMs'] as const) {
    const value = raw[key];
    if (value === undefined) continue;
    if (!isInt(value)) return null;
    trace[key] = value;
  }
  if (typeof raw.network === 'string') trace.network = raw.network;
  if (typeof raw.refused === 'string') trace.refused = raw.refused;
  const knownDrop = TRACE_DROPS.find((candidate) => candidate === raw.dropped);
  if (knownDrop !== undefined) trace.dropped = knownDrop;
  if (typeof raw.counted === 'boolean') trace.counted = raw.counted;
  return trace;
}
