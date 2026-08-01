import { useEffect, useState } from 'react';
import type { DifficultyCounts, PackId, PackSummary, Question } from '../questions/types';

export type { PackSummary };

function packUrl(file: string): string {
  // BASE_URL carries the '/quiz/' prefix that GitHub Pages serves the app under.
  return `${import.meta.env.BASE_URL}packs/${file}`;
}

/**
 * The index as it arrives over the wire. Pages caches these static files
 * independently, so a browser can hold a copy of `index.json` written before
 * per-difficulty counts existed. Treating them as optional here means an old
 * index costs the level picker its numbers rather than crashing the lobby.
 */
type RawPackSummary = Omit<PackSummary, 'counts'> & { counts?: Partial<DifficultyCounts> };

function withCounts(pack: RawPackSummary): PackSummary {
  const { easy = 0, medium = 0, hard = 0 } = pack.counts ?? {};
  return { ...pack, counts: { easy, medium, hard } };
}

/** Loads the committed pack index. No third-party domain is involved. */
export function usePackIndex(): { packs: PackSummary[]; error: string | null } {
  const [packs, setPacks] = useState<PackSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(packUrl('index.json'))
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load question packs (${response.status})`);
        return response.json() as Promise<RawPackSummary[]>;
      })
      .then((loaded) => {
        if (!cancelled) setPacks(loaded.map(withCounts));
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load packs');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { packs, error };
}

export async function loadPackQuestions(id: PackId): Promise<Question[]> {
  const response = await fetch(packUrl(`${id}.json`));
  if (!response.ok) throw new Error(`Could not load the ${id} pack (${response.status})`);
  const pack = (await response.json()) as { questions: Question[] };
  return pack.questions;
}
