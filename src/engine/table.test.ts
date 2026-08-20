import { describe, expect, test } from 'vitest';
import { MIN_GAMES_TO_QUALIFY, averageFor, rankByAverage } from './table';

function row(name: string, points: number, played: number) {
  return { name, points, played };
}

const names = (rows: { name: string }[]) => rows.map((entry) => entry.name);

describe('averageFor', () => {
  test('is points per round', () => {
    // #given a record of five rounds
    // #when the average is taken
    // #then it is the plain division
    expect(averageFor({ points: 45_010, played: 5 })).toBe(9_002);
  });

  test('reads a record with no rounds as zero rather than dividing by it', () => {
    // #given a row that has never banked a game, which the rules permit even
    // though bankGame cannot produce one
    // #when the average is taken
    // #then it is zero, not Infinity — which would otherwise top the board
    expect(averageFor({ points: 0, played: 0 })).toBe(0);
    expect(averageFor({ points: 5_000, played: 0 })).toBe(0);
  });
});

describe('rankByAverage', () => {
  test('ranks on the average, not on the total', () => {
    // #given the shape the live board actually has: the biggest total belongs
    // to whoever has played most
    const rows = [
      row('Greg', 138_052, 17),
      row('Rach', 100_996, 15),
      row('Joe', 45_010, 5),
    ];

    // #when the board is ranked
    const { ranked } = rankByAverage(rows);

    // #then the fewest points can lead it, and the most can come last
    expect(names(ranked)).toEqual(['Joe', 'Greg', 'Rach']);
  });

  test('holds back anybody with too few rounds to judge', () => {
    // #given somebody who played once and scored well
    const rows = [
      row('Greg', 24_000, 3),
      row('Lucky', 9_000, 1),
    ];

    // #when the board is ranked
    const { ranked, provisional } = rankByAverage(rows);

    // #then the one-round record is listed but not ranked, so a single good
    // night cannot lead a season
    expect(names(ranked)).toEqual(['Greg']);
    expect(names(provisional)).toEqual(['Lucky']);
  });

  test('qualifies on exactly the threshold, not one past it', () => {
    // #given records either side of the line
    const rows = [row('Three', 3_000, MIN_GAMES_TO_QUALIFY), row('Two', 2_000, MIN_GAMES_TO_QUALIFY - 1)];

    // #when the board is ranked
    const { ranked, provisional } = rankByAverage(rows);

    // #then three rounds is enough
    expect(names(ranked)).toEqual(['Three']);
    expect(names(provisional)).toEqual(['Two']);
  });

  test('orders the provisional rows too', () => {
    // #given several records short of qualifying
    const rows = [row('Low', 1_000, 1), row('High', 8_000, 1), row('Mid', 4_000, 2)];

    // #when the board is ranked
    const { provisional } = rankByAverage(rows);

    // #then they are in the same order the table uses, rather than left in
    // whatever order Firestore returned them
    expect(names(provisional)).toEqual(['High', 'Mid', 'Low']);
  });

  test('breaks a tied average on who has played more', () => {
    // #given two identical averages over different numbers of rounds
    const rows = [row('Few', 24_000, 3), row('Many', 80_000, 10)];

    // #when the board is ranked
    const { ranked } = rankByAverage(rows);

    // #then the longer record is the better claim on the same average
    expect(names(ranked)).toEqual(['Many', 'Few']);
  });

  test('breaks a fully tied row on the name, so no device invents an order', () => {
    // #given two records identical in every ranked field
    const rows = [row('Zoe', 24_000, 3), row('Adam', 24_000, 3)];

    // #when the board is ranked
    const { ranked } = rankByAverage(rows);

    // #then they are alphabetical — the same reason the awards sort their joint
    // winners, and the replay breaks ties on uid
    expect(names(ranked)).toEqual(['Adam', 'Zoe']);
  });

  test('renders the same order whatever order the rows arrived in', () => {
    // #given one board and the same board reversed
    const rows = [
      row('Greg', 138_052, 17),
      row('Alistair', 85_858, 10),
      row('Joe', 45_010, 5),
      row('Bret', 47_158, 12),
      row('Solo', 9_000, 1),
    ];

    // #when both are ranked
    const forwards = rankByAverage(rows);
    const backwards = rankByAverage([...rows].reverse());

    // #then two devices reading the same table cannot disagree about positions
    expect(names(backwards.ranked)).toEqual(names(forwards.ranked));
    expect(names(backwards.provisional)).toEqual(names(forwards.provisional));
  });

  test('does not reorder the array it was given', () => {
    // #given rows out of order, held by the caller — loadTable hands out a copy
    // of a cached array, and sorting it in place would corrupt every later read
    const rows = [row('Joe', 45_010, 5), row('Greg', 138_052, 17)];
    const before = names(rows);

    // #when the board is ranked
    rankByAverage(rows);

    // #then the caller's array is untouched
    expect(names(rows)).toEqual(before);
  });

  test('handles an empty board', () => {
    // #given nothing banked at all
    // #when the board is ranked
    const { ranked, provisional } = rankByAverage([]);

    // #then both halves are empty rather than undefined
    expect(ranked).toEqual([]);
    expect(provisional).toEqual([]);
  });

  test('a nil-scoring record does not divide by zero into the lead', () => {
    // #given a row with rounds played and no points, and a hand-edited one with
    // neither
    const rows = [row('Nil', 0, 4), row('Edited', 5_000, 0), row('Real', 20_000, 4)];

    // #when the board is ranked
    const { ranked, provisional } = rankByAverage(rows);

    // #then the scorer leads, the nil-scorer is last, and the row with no
    // rounds is held back rather than topping the table on an infinite average
    expect(names(ranked)).toEqual(['Real', 'Nil']);
    expect(names(provisional)).toEqual(['Edited']);
  });
});
