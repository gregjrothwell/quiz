/**
 * The rig probe: how closely the room's phones can change colour on one cue
 * (docs/decisions/rig-in-your-hand.md, part 1).
 *
 * The host writes a run to the Realtime Database — a start time on the shared
 * clock — and every device fades to amber at each cue time and writes back when
 * it actually painted, on the same clock. This file is the arithmetic: when the
 * cues fall, and what the paint times say. Nothing here reads a clock.
 */

export const RIG_CUES = 10;
/** Two seconds apart, so a 400 ms fade on and off is nowhere near a flash. */
export const RIG_EVERY_MS = 2_000;
/** Time for every device to hear about the run before the first cue. */
export const RIG_LEAD_MS = 3_000;
/** What a fade hides: devices within this of the median look like one light. */
export const RIG_TOLERANCE_MS = 50;
/** The pass line, from the story: 90% of devices within tolerance, on 9 cues of 10. */
export const RIG_PASS_SHARE = 0.9;
export const RIG_PASS_CUES = 9;

export interface RigRun {
  id: string;
  /** The first cue, on the shared clock (server milliseconds). */
  startAt: number;
  by: string;
}

/** When each cue falls, on the shared clock. */
export function cueTimes(startAt: number, cues: number = RIG_CUES, everyMs: number = RIG_EVERY_MS): number[] {
  return Array.from({ length: cues }, (_, index) => startAt + index * everyMs);
}

/** Cue colours alternate so every cue is a visible change: on, off, on… */
export function cueIsOn(index: number): boolean {
  return index % 2 === 0;
}

export interface CueReport {
  cue: number;
  devices: number;
  /** Latest paint minus earliest, in milliseconds. */
  spreadMs: number;
  /** Median paint minus the cue time: how late the room was, together. */
  lateMs: number;
  /** Share of devices whose paint was within tolerance of the median. */
  withinShare: number;
}

export interface RigReport {
  cues: CueReport[];
  /** Cues on which at least {@link RIG_PASS_SHARE} of devices were within tolerance. */
  cuesPassed: number;
  pass: boolean;
  /** The most devices seen on any cue. */
  devices: number;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? (sorted[middle] ?? 0) : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/**
 * What the paint times say. `painted[cue][uid]` is a device's paint time on the
 * shared clock. A cue with fewer than two devices proves nothing about spread,
 * so it counts as failed rather than as a perfect zero.
 */
export function reportRig(
  painted: Readonly<Record<number, Readonly<Record<string, number>>>>,
  times: readonly number[],
): RigReport {
  const cues: CueReport[] = times.map((at, cue) => {
    const paints = Object.values(painted[cue] ?? {}).filter((value) => Number.isFinite(value));
    if (paints.length === 0) return { cue, devices: 0, spreadMs: 0, lateMs: 0, withinShare: 0 };
    const middle = median(paints);
    const within = paints.filter((paint) => Math.abs(paint - middle) <= RIG_TOLERANCE_MS).length;
    return {
      cue,
      devices: paints.length,
      spreadMs: Math.max(...paints) - Math.min(...paints),
      lateMs: middle - at,
      withinShare: within / paints.length,
    };
  });
  const cuesPassed = cues.filter((cue) => cue.devices >= 2 && cue.withinShare >= RIG_PASS_SHARE).length;
  return {
    cues,
    cuesPassed,
    pass: cuesPassed >= Math.min(RIG_PASS_CUES, times.length),
    devices: Math.max(0, ...cues.map((cue) => cue.devices)),
  };
}

/** A run as read from the Realtime Database, or null if it is not one. */
export function rigRunFrom(value: unknown): RigRun | null {
  if (typeof value !== 'object' || value === null) return null;
  const { id, startAt, by } = value as Record<string, unknown>;
  if (typeof id !== 'string' || typeof startAt !== 'number' || typeof by !== 'string') return null;
  return { id, startAt, by };
}
