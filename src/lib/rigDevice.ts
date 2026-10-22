import { onValue, ref, set, type Database } from 'firebase/database';
import { RIG_LEAD_MS, cueIsOn, cueTimes, reportRig, rigRunFrom, type RigReport, type RigRun } from '../engine/rigProbe';

/**
 * The rig probe on one device, over the Realtime Database
 * (docs/decisions/rig-in-your-hand.md, part 1). Shared by the browser
 * (`components/RigCheck.tsx`) and the Node clients in the e2e and `read-rig`, so
 * both measure the same thing. Imports nothing that reaches `src/firebase.ts`.
 *
 * The shared clock here is the Realtime Database's own estimate,
 * `.info/serverTimeOffset`, rather than the room clock `useRoom` builds: that one
 * only measures itself when a question opens, and the probe runs in the lobby.
 * How good this estimate is, is part of what the probe measures.
 */

/**
 * `onlyOnce` rather than unsubscribing in the callback: `.info` values are local,
 * so the callback can run before `onValue` has returned its unsubscribe.
 */
function offsetOf(db: Database): Promise<number> {
  return new Promise((resolve) => {
    onValue(ref(db, '.info/serverTimeOffset'), (snapshot) => resolve(Number(snapshot.val() ?? 0)), { onlyOnce: true });
  });
}

/** Starts a run: the first cue {@link RIG_LEAD_MS} from now, on the shared clock. */
export async function startRig(db: Database, code: string, uid: string): Promise<RigRun> {
  const offset = await offsetOf(db);
  const run: RigRun = {
    id: `${String(Date.now())}-${uid.slice(0, 6)}`,
    startAt: Date.now() + offset + RIG_LEAD_MS,
    by: uid,
  };
  await set(ref(db, `rig/${code}/run`), run);
  return run;
}

export interface FollowOptions {
  /** Called at each cue: fade to on, or back off. */
  onCue: (index: number, on: boolean) => void;
  /** Runs `then` once the change has been painted: `requestAnimationFrame` twice in a browser. */
  afterPaint: (then: () => void) => void;
  onError?: (cause: unknown) => void;
}

/**
 * Follows the room's runs: schedules each cue on the shared clock, and writes
 * back when this device painted it. A run whose first cue is already in the past
 * — a device that joined late — is ignored rather than played out of step.
 */
export function followRig(db: Database, code: string, uid: string, options: FollowOptions): () => void {
  let timers: ReturnType<typeof setTimeout>[] = [];
  let offset = 0;
  let live = true;

  const clear = (): void => {
    for (const timer of timers) clearTimeout(timer);
    timers = [];
  };

  const stop = onValue(ref(db, `rig/${code}/run`), (snapshot) => {
    const run = rigRunFrom(snapshot.val());
    clear();
    if (!run || !live) return;
    void offsetOf(db).then((value) => {
      offset = value;
      if (!live) return;
      const now = Date.now() + offset;
      if (run.startAt < now) return;
      cueTimes(run.startAt).forEach((at, index) => {
        timers.push(
          setTimeout(() => {
            options.onCue(index, cueIsOn(index));
            options.afterPaint(() => {
              const painted = Date.now() + offset;
              set(ref(db, `rig/${code}/paints/${run.id}/${String(index)}/${uid}`), painted).catch((cause: unknown) =>
                options.onError?.(cause),
              );
            });
          }, at - now),
        );
      });
    });
  });

  return () => {
    live = false;
    clear();
    stop();
  };
}

/** The report for a run, kept current as paints arrive. */
export function watchRig(db: Database, code: string, run: RigRun, onReport: (report: RigReport) => void): () => void {
  const times = cueTimes(run.startAt);
  return onValue(ref(db, `rig/${code}/paints/${run.id}`), (snapshot) => {
    const raw = (snapshot.val() ?? {}) as Record<string, Record<string, unknown>>;
    const painted: Record<number, Record<string, number>> = {};
    for (const [cue, byUid] of Object.entries(raw)) {
      painted[Number(cue)] = Object.fromEntries(
        Object.entries(byUid).filter((entry): entry is [string, number] => typeof entry[1] === 'number'),
      );
    }
    onReport(reportRig(painted, times));
  });
}
