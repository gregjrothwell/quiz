import { describe, expect, test } from 'vitest';
import { foldGameRecord } from '../engine/gameRecord';
import type { Action } from '../engine/reducer';
import { createRoom, type QuizQuestion, type RoomState } from '../engine/state';
import { TimeoutError } from '../lib/withTimeout';
import type { HostPorts } from './ports';
import { foldActions, perform, removePlayers, revealQuestion } from './moves';

/*
  Performing the host's moves through fake ports (host-loop.md, A4): the right
  action reaches `dispatch`, and every failure comes back to the caller.
*/

function question(id: string, survey?: QuizQuestion['survey']): QuizQuestion {
  return {
    id,
    prompt: id,
    options: ['a', 'b', 'c', 'd'],
    correctIndex: null,
    category: 'general',
    difficulty: 'easy',
    ...(survey ? { survey } : {}),
  };
}

function room(questions: QuizQuestion[], index = 0): RoomState {
  return { ...createRoom('ABCD'), phase: 'question', gameId: 'g1', index, questions };
}

interface Fake {
  ports: HostPorts;
  dispatched: (Action | Action[])[];
}

function fake(overrides: Partial<HostPorts> = {}): Fake {
  const dispatched: (Action | Action[])[] = [];
  let clock = 0;
  return {
    dispatched,
    ports: {
      dispatch: (action) => {
        dispatched.push(action);
        return Promise.resolve();
      },
      beat: () => Promise.resolve(),
      removePlayer: () => Promise.resolve(),
      resolveAnswer: () => Promise.resolve(2),
      keepGame: () => Promise.resolve('kept'),
      now: () => (clock += 10),
      ...overrides,
    },
  };
}

describe('revealQuestion', () => {
  test('asks the vault, then reveals that answer for that question', async () => {
    const { ports, dispatched } = fake();
    await revealQuestion(room([question('q0')]), [], ports);
    expect(dispatched).toEqual([{ type: 'reveal', correctIndex: 2, questionId: 'q0' }]);
  });

  test('a Survey Says tell reveals on option 0 and never asks the vault', async () => {
    const { ports, dispatched } = fake({ resolveAnswer: () => Promise.reject(new Error('no vault for a survey')) });
    await revealQuestion(room([question('s0', { part: 'tell', promptId: 'p1' })]), [], ports);
    expect(dispatched).toEqual([{ type: 'reveal', correctIndex: 0, questionId: 's0' }]);
  });

  test('a guess reveals the room\'s top answer from the telling', async () => {
    const { ports, dispatched } = fake();
    const questions = [
      question('tell', { part: 'tell', promptId: 'p1' }),
      question('guess', { part: 'guess', promptId: 'p1' }),
    ];
    const told = {
      index: 0,
      correctIndex: 0,
      answers: {
        a: { optionIndex: 1, elapsedMs: 1 },
        b: { optionIndex: 1, elapsedMs: 1 },
        c: { optionIndex: 3, elapsedMs: 1 },
      },
      deltas: {},
    };
    await revealQuestion(room(questions, 1), [told], ports);
    expect(dispatched).toEqual([
      { type: 'reveal', correctIndex: 1, top: [1], counts: [0, 2, 0, 1], questionId: 'guess' },
    ]);
  });

  test('a guess with no telling on this device is skipped', async () => {
    const { ports, dispatched } = fake();
    const questions = [
      question('tell', { part: 'tell', promptId: 'p1' }),
      question('guess', { part: 'guess', promptId: 'p1' }),
    ];
    await revealQuestion(room(questions, 1), [], ports);
    expect(dispatched).toEqual([{ type: 'skip' }]);
  });

  test('a refusal comes back to the caller, and nothing is revealed', async () => {
    const refused = new Error('permission-denied');
    const { ports, dispatched } = fake({ resolveAnswer: () => Promise.reject(refused) });
    await expect(revealQuestion(room([question('q0')]), [], ports)).rejects.toBe(refused);
    expect(dispatched).toEqual([]);
  });

  test('a stalled line becomes a failure at the deadline instead of hanging the room', async () => {
    const { ports } = fake({ resolveAnswer: () => new Promise<number>(() => undefined) });
    await expect(revealQuestion(room([question('q0')]), [], ports, 20)).rejects.toBeInstanceOf(TimeoutError);
  });

  test('outside a question it does nothing', async () => {
    const { ports, dispatched } = fake();
    await revealQuestion({ ...room([question('q0')]), phase: 'reveal' }, [], ports);
    expect(dispatched).toEqual([]);
  });
});

describe('perform', () => {
  test('a stage of the final is the action it names', async () => {
    const { ports, dispatched } = fake();
    await perform({ kind: 'standoff', key: 'g1:talk', action: { type: 'openPicks' } }, { room: room([]), gameLog: [] }, ports);
    expect(dispatched).toEqual([{ type: 'openPicks' }]);
  });

  test('a keep reports how it went, so a failure can be tried again and a refusal not', async () => {
    const { ports } = fake({ keepGame: () => Promise.resolve('refused') });
    const finished: RoomState = {
      ...room([question('q0')]),
      phase: 'finished',
      packId: 'general-knowledge',
      packTitle: 'General',
    };
    const record = foldGameRecord(finished, [{ index: 0, correctIndex: 0, answers: {}, deltas: {} }], 'host');
    if (!record) throw new Error('expected a record');
    await expect(
      perform({ kind: 'keepGame', gameId: 'g1', record }, { room: room([]), gameLog: [] }, ports),
    ).resolves.toEqual({ kind: 'keepGame', outcome: 'refused' });
  });

  test('a failed beat rejects; whether to mind is the caller\'s', async () => {
    const down = new Error('unavailable');
    const { ports } = fake({ beat: () => Promise.reject(down) });
    await expect(perform({ kind: 'beat' }, { room: room([]), gameLog: [] }, ports)).rejects.toBe(down);
  });
});

describe('removePlayers', () => {
  test('tries every removal even when one fails, then reports the failure', async () => {
    const tried: string[] = [];
    const refused = new Error('permission-denied');
    const ports = {
      removePlayer: (uid: string) => {
        tried.push(uid);
        return uid === 'b' ? Promise.reject(refused) : Promise.resolve();
      },
    };
    await expect(removePlayers(['a', 'b', 'c'], ports)).rejects.toBe(refused);
    expect(tried).toEqual(['a', 'b', 'c']);
  });
});

describe('foldActions', () => {
  test('is null when nothing changed, so nothing is written', () => {
    const lobby = createRoom('ABCD');
    expect(foldActions(lobby, { type: 'openPicks' })).toBeNull();
  });

  test('folds several actions into one room', () => {
    const lobby = { ...createRoom('ABCD'), players: { a: { name: 'A', joinedAt: 1 } } };
    const next = foldActions(lobby, [
      {
        type: 'selectPack',
        packId: 'general-knowledge',
        packTitle: 'General',
        questions: [question('q0')],
        wagerEnabled: false,
        stealEnabled: false,
      },
      { type: 'start', at: 1_000, gameId: 'g1', durationSecs: 20 },
    ]);
    expect(next?.phase).toBe('question');
    expect(next?.questions.map((entry) => entry.id)).toEqual(['q0']);
  });
});
