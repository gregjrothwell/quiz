import { useEffect, useState } from 'react';
import type { FinalsTally } from '../engine/finals';
import type { RoomState } from '../engine/state';
import { finalistReadFor, finalistReadFromKey, finalistReadKey } from './finalistRead';
import { loadFinalistRecords } from './season';

/**
 * The two finalists' season rows, read once when the final opens.
 *
 * A failed read is the same shape as one that has not come back yet: no line,
 * and the final carries on. The opening titles swallow a failed read the same
 * way. Nothing here retries, and nothing here writes. The effect depends on
 * the key alone, so a stage change that still names the same two rows does
 * not read again.
 */
export function useFinalistRecords(room: RoomState | null): Record<string, FinalsTally> | null {
  const read = finalistReadFor(room);
  const key = read ? finalistReadKey(read) : '';

  const [held, setHeld] = useState<{ key: string; records: Record<string, FinalsTally> | null } | null>(null);

  useEffect(() => {
    const current = key ? finalistReadFromKey(key) : null;
    if (!current) return;

    let live = true;
    loadFinalistRecords(current.finalists)
      .then((records) => {
        if (live) setHeld({ key, records });
      })
      .catch(() => {
        if (live) setHeld({ key, records: null });
      });
    return () => {
      live = false;
    };
  }, [key]);

  if (!key || held?.key !== key) return null;
  return held.records;
}
