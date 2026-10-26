/**
 * The error beacon read back, for `read-errors` (docs/decisions/slop-cannon.md,
 * A5). Pure, so `npm test` covers it; the script only fetches and prints.
 *
 * Grouped by message and room, so 22 October 2026 would read as one line —
 * *8 × Missing or insufficient permissions · B498 · finished* — rather than
 * eight.
 */

/** What `check-rules` writes for its allow case. No uid means no client delete, so it is skipped here. */
export const PROBE_MESSAGE = 'rules-check probe';

export interface ErrorRow {
  message: string;
  source: string;
  room: string | null;
  phase: string | null;
  build: string;
  device: string;
  /** Server time, ms. */
  at: number;
}

export interface ErrorGroup {
  message: string;
  room: string | null;
  count: number;
  phases: string[];
  builds: string[];
  devices: string[];
  sources: string[];
  first: number;
  last: number;
}

/** A row from Firestore, or null when it is not one this collection should hold. */
export function parseErrorRow(data: Record<string, unknown>, at: number | null): ErrorRow | null {
  const text = (key: string): string | null => {
    const value = data[key];
    return typeof value === 'string' ? value : null;
  };
  const message = text('message');
  const source = text('source');
  const build = text('build');
  const device = text('device');
  if (!message || !source || !build || !device || at === null) return null;
  return { message, source, room: text('room'), phase: text('phase'), build, device, at };
}

function addOnce(list: string[], value: string | null): void {
  if (value !== null && !list.includes(value)) list.push(value);
}

/** Most frequent first; probe rows dropped and counted. */
export function groupErrors(rows: readonly ErrorRow[]): { groups: ErrorGroup[]; probes: number } {
  const groups = new Map<string, ErrorGroup>();
  let probes = 0;
  for (const row of rows) {
    if (row.message === PROBE_MESSAGE) {
      probes += 1;
      continue;
    }
    const key = `${row.message}\u0000${row.room ?? ''}`;
    let group = groups.get(key);
    if (!group) {
      group = { message: row.message, room: row.room, count: 0, phases: [], builds: [], devices: [], sources: [], first: row.at, last: row.at };
      groups.set(key, group);
    }
    group.count += 1;
    addOnce(group.phases, row.phase);
    addOnce(group.builds, row.build);
    addOnce(group.devices, row.device);
    addOnce(group.sources, row.source);
    group.first = Math.min(group.first, row.at);
    group.last = Math.max(group.last, row.at);
  }
  const sorted = [...groups.values()].sort((a, b) => b.count - a.count || b.last - a.last);
  return { groups: sorted, probes };
}

function stamp(ms: number): string {
  return new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
}

export function formatGroup(group: ErrorGroup): string {
  const where = [group.room ?? 'no room', ...group.phases].join(' · ');
  return [
    `${String(group.count).padStart(3)} × ${group.message}`,
    `      ${where}  ·  ${group.sources.join('/')}  ·  ${group.devices.join(', ')}  ·  ${group.builds.join(', ')}`,
    `      ${stamp(group.first)} → ${stamp(group.last)}`,
  ].join('\n');
}

/** `--since 1d`, `12h`, `30m` as milliseconds. */
export function parseSince(value: string): number {
  const match = /^(\d+)([dhm])$/.exec(value);
  if (!match?.[1] || !match[2]) throw new Error(`--since wants a number and d, h or m, like 1d — got ${value}`);
  const unit = { d: 86_400_000, h: 3_600_000, m: 60_000 }[match[2] as 'd' | 'h' | 'm'];
  return Number.parseInt(match[1], 10) * unit;
}
