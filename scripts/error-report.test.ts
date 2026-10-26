import { describe, expect, it } from 'vitest';
import { PROBE_MESSAGE, formatGroup, groupErrors, parseErrorRow, parseSince, type ErrorRow } from './error-report';

const at = Date.UTC(2026, 9, 22, 8, 58);

function row(overrides: Partial<ErrorRow> = {}): ErrorRow {
  return {
    message: 'Missing or insufficient permissions.',
    source: 'notice',
    room: 'B498',
    phase: 'finished',
    build: 'index-t7PF9llL',
    device: 'ios',
    at,
    ...overrides,
  };
}

describe('read-errors', () => {
  it('reads 22 October as one line: 8 × the refusal, B498, finished', () => {
    const rows = Array.from({ length: 8 }, (_, i) => row({ at: at + i * 1000, device: i % 2 ? 'ios' : 'android' }));
    const { groups } = groupErrors(rows);
    expect(groups).toHaveLength(1);
    const text = formatGroup(groups[0]!);
    expect(text).toContain('8 × Missing or insufficient permissions.');
    expect(text).toContain('B498 · finished');
  });

  it('splits by room, most frequent first, and skips check-rules probes', () => {
    const { groups, probes } = groupErrors([
      row({ room: 'AAAA' }),
      row(),
      row(),
      row({ message: PROBE_MESSAGE, room: null }),
    ]);
    expect(groups.map((g) => [g.room, g.count])).toEqual([['B498', 2], ['AAAA', 1]]);
    expect(probes).toBe(1);
  });

  it('drops a row missing what the rules require', () => {
    expect(parseErrorRow({ message: 'm', source: 'notice', build: 'dev', device: 'mac' }, at)).not.toBeNull();
    expect(parseErrorRow({ message: 'm', source: 'notice', build: 'dev' }, at)).toBeNull();
    expect(parseErrorRow({ message: 'm', source: 'notice', build: 'dev', device: 'mac' }, null)).toBeNull();
  });

  it('parses --since', () => {
    expect(parseSince('1d')).toBe(86_400_000);
    expect(parseSince('12h')).toBe(43_200_000);
    expect(() => parseSince('soon')).toThrow();
  });
});
