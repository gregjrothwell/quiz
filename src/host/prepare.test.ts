import { describe, expect, test } from 'vitest';
import { NO_HISTORY, type AskedHistory } from '../engine/askedHistory';
import type { SealedQuestion } from '../questions/types';
import type { PackPorts } from './ports';
import { dealRound } from './prepare';

/*
  Dealing a round through fake packs and a fake season history: what is
  remembered, and that a history which could not be read is never written back
  as empty.
*/

function pool(prefix: string, size: number): SealedQuestion[] {
  return Array.from({ length: size }, (_, index) => ({
    id: `${prefix}-${String(index)}`,
    question: `${prefix} ${String(index)}`,
    options: ['a', 'b', 'c', 'd'],
    category: prefix,
    difficulty: 'easy' as const,
  }));
}

function ports(history: AskedHistory | Error): { ports: PackPorts; written: { packId: string; ids: readonly string[]; history: AskedHistory }[] } {
  const written: { packId: string; ids: readonly string[]; history: AskedHistory }[] = [];
  return {
    written,
    ports: {
      loadPack: (packId) => Promise.resolve(pool(packId, 30)),
      loadAsked: () => (history instanceof Error ? Promise.reject(history) : Promise.resolve(history)),
      recordAsked: (packId, ids, previous) => {
        written.push({ packId, ids, history: previous });
        return Promise.resolve();
      },
    },
  };
}

const request = { packId: 'general-knowledge' as const, count: 10, level: 'mixed' as const, jigsawEnabled: false };

describe('dealRound', () => {
  test('deals the count asked for and remembers exactly those ids, only when told to', async () => {
    const { ports: packs, written } = ports({ ids: new Set(), known: true });
    const dealt = await dealRound(request, packs);
    expect(dealt.questions).toHaveLength(10);
    expect(written).toEqual([]);
    await dealt.remember();
    expect(written).toHaveLength(1);
    expect(written[0]?.ids).toEqual(dealt.questions.map((question) => question.id));
  });

  test('a history that could not be read is passed on as "we do not know", never as empty', async () => {
    const { ports: packs, written } = ports(new Error('unavailable'));
    const dealt = await dealRound(request, packs);
    await dealt.remember();
    expect(written[0]?.history).toBe(NO_HISTORY);
  });

  test('remembering never fails the round', async () => {
    const { ports: packs } = ports({ ids: new Set(), known: true });
    const dealt = await dealRound(request, { ...packs, recordAsked: () => Promise.reject(new Error('refused')) });
    await expect(dealt.remember()).resolves.toBeUndefined();
  });

  test('a random round remembers each question against the pack it came from', async () => {
    const { ports: packs, written } = ports({ ids: new Set(), known: true });
    const dealt = await dealRound({ ...request, packId: 'random' }, packs);
    await dealt.remember();
    for (const row of written) {
      for (const id of row.ids) expect(id.startsWith(`${row.packId}-`)).toBe(true);
    }
    expect(written.flatMap((row) => row.ids).sort()).toEqual(dealt.questions.map((question) => question.id).sort());
  });
});
