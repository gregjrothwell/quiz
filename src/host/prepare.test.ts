import { describe, expect, test } from 'vitest';
import { NO_HISTORY, type AskedHistory, type HistoryGroup } from '../engine/askedHistory';
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

  test('a ramp that cannot climb says so, and a mixed round does not', async () => {
    const { ports: packs } = ports({ ids: new Set(), known: true });
    // The fake pack is thirty easy questions and nothing else.
    const ramp = await dealRound({ ...request, level: 'ramp' }, packs);
    expect(ramp.ladderNotices).toEqual(['Out of medium and hard questions in this pack — using easy']);
    const mixed = await dealRound(request, packs);
    expect(mixed.ladderNotices).toEqual([]);
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

describe('dealRound for Geekend', () => {
  /*
    A fake season holding a history per group, so what one group has had can be
    told apart from what the other has.
  */
  function grouped(office: readonly string[]) {
    const reads: { packId: string; group: HistoryGroup }[] = [];
    const writes: { packId: string; group: HistoryGroup; ids: readonly string[] }[] = [];
    const held: Record<HistoryGroup, ReadonlySet<string>> = { office: new Set(office), geekend: new Set() };
    const packs: PackPorts = {
      loadPack: (packId) => Promise.resolve(pool(packId, 30)),
      loadAsked: (packId, group) => {
        reads.push({ packId, group });
        return Promise.resolve({ ids: held[group], known: true });
      },
      recordAsked: (packId, ids, _previous, group) => {
        writes.push({ packId, group, ids });
        return Promise.resolve();
      },
    };
    return { packs, reads, writes };
  }

  // Everything in the pack but the last ten, as the office has it.
  const officeHasHad = pool('general-knowledge', 30)
    .slice(0, 20)
    .map((question) => question.id);

  test('the office, by default, is dealt only what it has not had', async () => {
    const { packs, reads } = grouped(officeHasHad);
    const dealt = await dealRound(request, packs);
    expect(reads.map((read) => read.group)).toEqual(['office']);
    for (const question of dealt.questions) expect(officeHasHad).not.toContain(question.id);
  });

  test('Geekend are dealt from the whole pack, whatever the office has had', async () => {
    const { packs, reads } = grouped(officeHasHad);
    // Twenty-five of thirty: more than the ten the office has left, so it can only
    // be dealt if the office's history is not in the way.
    const dealt = await dealRound({ ...request, count: 25, history: 'geekend' }, packs);
    expect(reads.map((read) => read.group)).toEqual(['geekend']);
    expect(dealt.questions.some((question) => officeHasHad.includes(question.id))).toBe(true);
  });

  test('a Geekend round is banked to Geekend, and leaves the office history alone', async () => {
    const { packs, writes } = grouped(officeHasHad);
    const dealt = await dealRound({ ...request, history: 'geekend' }, packs);
    await dealt.remember();
    expect(writes.map((write) => write.group)).toEqual(['geekend']);
  });

  test('a Geekend random round reads and banks every source as Geekend', async () => {
    const { packs, reads, writes } = grouped([]);
    const dealt = await dealRound({ ...request, packId: 'random', history: 'geekend' }, packs);
    await dealt.remember();
    expect(reads.length).toBeGreaterThan(0);
    expect(new Set([...reads, ...writes].map((row) => row.group))).toEqual(new Set(['geekend']));
  });
});
