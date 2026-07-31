import { useEffect, useState } from 'react';
import type { PackId, Question } from '../questions/types';

export interface PackSummary {
  id: PackId;
  title: string;
  blurb: string;
  count: number;
}

function packUrl(file: string): string {
  // BASE_URL carries the '/quiz/' prefix that GitHub Pages serves the app under.
  return `${import.meta.env.BASE_URL}packs/${file}`;
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
        return response.json() as Promise<PackSummary[]>;
      })
      .then((loaded) => {
        if (!cancelled) setPacks(loaded);
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
