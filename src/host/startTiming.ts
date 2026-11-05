import type { RoundStartTiming } from '../engine/q1Trace';
import type { PackPorts } from './ports';

/**
 * Where **Start the show** spends its time, for the quizmaster's question-one
 * trace. Greg, 5 Nov 2026: the button sat on "Loading questions…" before the
 * pre-game facts, and nothing recorded how long or why.
 * See docs/decisions/cass-q1-cold-write.md.
 *
 * `ports` are the deal's own, timed. A Random Round reads six packs side by
 * side, so each reports its slowest rather than a sum nobody waited for.
 */
export interface StartTimer {
  ports: PackPorts;
  /** The deal has finished. */
  dealt: () => void;
  /** The season rows for the facts are in. */
  formRead: () => void;
  /** The server has acknowledged the room write. */
  written: () => void;
  /** Whatever has been measured so far. A step that never ran is absent. */
  timing: () => RoundStartTiming;
}

export function createStartTimer(now: () => number, ports: PackPorts): StartTimer {
  const pressedAt = now();
  let dealtAt: number | null = null;
  let formReadAt: number | null = null;
  const measured: RoundStartTiming = {};

  function slowest(key: 'packMs' | 'askedMs', startedAt: number): void {
    measured[key] = Math.max(measured[key] ?? 0, now() - startedAt);
  }

  /** Times a call whether it resolves or rejects, and hands back its outcome. */
  function timed<T>(key: 'packMs' | 'askedMs', call: () => Promise<T>): Promise<T> {
    const startedAt = now();
    return call().finally(() => slowest(key, startedAt));
  }

  return {
    ports: {
      ...ports,
      loadPack: (packId) => timed('packMs', () => ports.loadPack(packId)),
      loadAsked: (packId, group) => timed('askedMs', () => ports.loadAsked(packId, group)),
    },
    dealt() {
      dealtAt = now();
      measured.dealMs = dealtAt - pressedAt;
    },
    formRead() {
      formReadAt = now();
      if (dealtAt !== null) measured.formMs = formReadAt - dealtAt;
    },
    written() {
      if (formReadAt !== null) measured.dealWriteMs = now() - formReadAt;
    },
    timing: () => ({ ...measured }),
  };
}
