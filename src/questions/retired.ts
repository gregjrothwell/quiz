import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The questions the office has voted out.
 *
 * **A committed file, not a pack edit, and that distinction is the whole
 * point.** Deleting a question from `public/packs/*.json` does not retire it:
 * `npm run fetch-questions -- --resort` rebuilds every pack from `.cache/`, so
 * the next re-sort would put it straight back with nothing to say it had ever
 * gone. The blocklist is the record; the pack is a consequence of it.
 *
 * Each entry keeps the tally that retired it. A retirement is permanent — the
 * question is never served again and nothing will surface it for review — so
 * the reason has to outlive the run that decided it. Two integers is also all
 * there is: no option breakdown, for the same reason the vote document carries
 * none.
 *
 * Read with `fs` rather than imported, so no `resolveJsonModule` is needed and
 * the file stays readable by the build scripts and the seal test alike. Both
 * run in Node; nothing here ships to a browser.
 */

export interface RetiredQuestion {
  id: string;
  good: number;
  bad: number;
  /** ISO date the fold retired it. */
  at: string;
}

interface RetiredFile {
  note?: string;
  retired: RetiredQuestion[];
}

export const RETIRED_PATH = join(import.meta.dirname, 'retired.json');

export function loadRetired(path: string = RETIRED_PATH): RetiredQuestion[] {
  const raw = readFileSync(path, 'utf8');
  const parsed = JSON.parse(raw) as RetiredFile;
  return parsed.retired;
}

export function retiredIds(path: string = RETIRED_PATH): Set<string> {
  return new Set(loadRetired(path).map((entry) => entry.id));
}
