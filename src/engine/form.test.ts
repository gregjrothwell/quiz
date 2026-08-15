import { describe, expect, test } from 'vitest';
import { formFor, type FormFact, type FormRecord } from './form';

function record(uid: string, overrides: Partial<FormRecord> = {}): FormRecord {
  return { uid, played: 5, wins: 0, best: 2_000, rosettes: 0, ...overrides };
}

function find<T extends FormFact['id']>(
  facts: FormFact[],
  id: T,
): Extract<FormFact, { id: T }> | undefined {
  return facts.find((fact) => fact.id === id) as Extract<FormFact, { id: T }> | undefined;
}

describe('formFor', () => {
  test('names the player in the room with the most wins', () => {
    // #given three players with different records
    const records = [
      record('greg', { wins: 3 }),
      record('sam', { wins: 1 }),
      record('alex', { wins: 0 }),
    ];

    // #when the room's form is worked out
    const facts = formFor(records);

    // #then the defending champion is the one with the most wins
    expect(find(facts, 'champion')).toEqual({ id: 'champion', uids: ['greg'], wins: 3 });
  });

  test('names every joint holder, in a stable order', () => {
    // #given two players tied on wins
    const records = [record('sam', { wins: 2 }), record('alex', { wins: 2 })];

    // #when the room's form is worked out
    const facts = formFor(records);

    // #then both are named and sorted, so every device renders the same card
    expect(find(facts, 'champion')?.uids).toEqual(['alex', 'sam']);
  });

  test('leaves out a champion when nobody has ever won', () => {
    // #given a room of players who have all played and none won
    const records = [record('greg', { wins: 0 }), record('sam', { wins: 0 })];

    // #when the room's form is worked out
    const facts = formFor(records);

    // #then there is no champion rather than one with no wins — a lie told in
    // sixty-point type is still a lie
    expect(find(facts, 'champion')).toBeUndefined();
  });

  test('names the best single game in the room', () => {
    // #given a player whose best round beats the others
    const records = [
      record('greg', { best: 4_200 }),
      record('sam', { best: 8_100 }),
      record('alex', { best: 3_000 }),
    ];

    // #when the room's form is worked out
    const facts = formFor(records);

    // #then the highest single score is named, not the highest total
    expect(find(facts, 'best')).toEqual({ id: 'best', uids: ['sam'], points: 8_100 });
  });

  test('names who has collected the most rosettes', () => {
    // #given a room where one player has a shelf
    const records = [record('greg', { rosettes: 7 }), record('sam', { rosettes: 2 })];

    // #when the room's form is worked out
    const facts = formFor(records);

    // #then the shelf is the fact worth stating
    expect(find(facts, 'rosettes')).toEqual({ id: 'rosettes', uids: ['greg'], count: 7 });
  });

  test('names everybody playing for the first time, not just one of them', () => {
    // #given two players with no completed rounds and one regular
    const records = [
      record('greg', { played: 12, wins: 4 }),
      record('nadia', { played: 0, best: 0 }),
      record('tom', { played: 0, best: 0 }),
    ];

    // #when the room's form is worked out
    const facts = formFor(records);

    // #then both newcomers are named — this is the one fact here that is not a
    // competition
    expect(find(facts, 'newcomers')?.uids).toEqual(['nadia', 'tom']);
  });

  test('says nothing at all about an empty room', () => {
    // #given no records
    // #when the room's form is worked out
    // #then there is no card rather than an empty one
    expect(formFor([])).toEqual([]);
  });

  test('says nothing about a room where nobody has played', () => {
    // #given a room of complete newcomers
    const records = [record('nadia', { played: 0, wins: 0, best: 0 }), record('tom', { played: 0, wins: 0, best: 0 })];

    // #when the room's form is worked out
    const facts = formFor(records);

    // #then the only fact is that they are new — no champion, no best round, no
    // rosettes invented out of nothing
    expect(facts.map((fact) => fact.id)).toEqual(['newcomers']);
  });
});
