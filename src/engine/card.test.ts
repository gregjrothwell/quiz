import { describe, expect, test } from 'vitest';
import { cardModel } from './card';
import type { QuestionRecord } from './awards';
import { awardsFor, reviewFor, sawWholeGame } from './awards';
import { roomStandings } from './scoring';
import type { Player } from './state';

const AT = Date.UTC(2026, 7, 20, 17, 30);

function playersNamed(...names: string[]): Record<string, Player> {
  return Object.fromEntries(
    names.map((name, i) => [name.toLowerCase(), { name, joinedAt: i }]),
  );
}

/**
 * The same inputs `Final` holds, assembled the way `Final` assembles them — so a
 * test here is a test of the card the screen would actually make.
 */
function modelFor(params: {
  players: Record<string, Player>;
  scores: Record<string, number>;
  log?: QuestionRecord[];
  questionCount?: number;
  packTitle?: string | null;
}) {
  const { players, scores, log = [], questionCount = log.length, packTitle = 'Geography' } = params;
  const rows = roomStandings(players, scores);
  const sawItAll = sawWholeGame(log, questionCount);

  return cardModel({
    packTitle,
    players,
    scores,
    rows,
    awards: sawItAll ? awardsFor(log, Object.keys(players)) : [],
    sawWholeGame: sawItAll,
    questionCount,
    at: AT,
  });
}

/** A whole two-question game, so the awards have something to say. */
const WHOLE_GAME: QuestionRecord[] = [
  {
    index: 0,
    correctIndex: 0,
    answers: {
      greg: { optionIndex: 0, elapsedMs: 900 },
      sam: { optionIndex: 1, elapsedMs: 1_500 },
      priya: { optionIndex: 1, elapsedMs: 2_000 },
    },
    deltas: { greg: 1_000, sam: 0, priya: 0 },
  },
  {
    index: 1,
    correctIndex: 0,
    answers: {
      greg: { optionIndex: 0, elapsedMs: 1_200 },
      sam: { optionIndex: 0, elapsedMs: 2_400 },
      priya: { optionIndex: 3, elapsedMs: 3_000 },
    },
    deltas: { greg: 1_000, sam: 900, priya: 0 },
  },
];

describe('cardModel', () => {
  test('names the winner and stands the top three on the podium', () => {
    // #given a four-player round with a clear result
    const players = playersNamed('Greg', 'Sam', 'Priya', 'Alex');
    const scores = { greg: 2_000, sam: 900, priya: 600, alex: 100 };

    // #when the card is modelled
    const card = modelFor({ players, scores });

    // #then one winner, and three rows in finishing order
    expect({ winners: card.winners, podium: card.podium }).toEqual({
      winners: ['Greg'],
      podium: [
        { position: 1, name: 'Greg', score: 2_000 },
        { position: 2, name: 'Sam', score: 900 },
        { position: 3, name: 'Priya', score: 600 },
      ],
    });
  });

  test('names both winners of a dead heat and invents no second place', () => {
    // #given two players level at the top
    const players = playersNamed('Greg', 'Sam', 'Priya');
    const scores = { greg: 1_800, sam: 1_800, priya: 600 };

    // #when the card is modelled
    const card = modelFor({ players, scores });

    // #then both are named, and the podium carries the shared position rather
    // than a position 2 nobody holds
    expect(card.winners).toEqual(['Greg', 'Sam']);
    expect(card.podium.map((row) => row.position)).toEqual([1, 1, 3]);
  });

  test('seats the player below the podium in the chair', () => {
    // #given a four-player round with a clear bottom
    const players = playersNamed('Greg', 'Sam', 'Priya', 'Alex');
    const scores = { greg: 2_000, sam: 900, priya: 600, alex: 100 };

    // #when the card is modelled
    const card = modelFor({ players, scores });

    // #then the chair holds whoever finished last
    expect(card.chair).toEqual({ names: ['Alex'], score: 100 });
  });

  test('seats everybody who tied for last, not just the first of them', () => {
    /*
      #given the finishing scores of live room XS4A — a 25-question round played
      for stakes on 4 September 2026, whose scores map holds three zeros.

      Two of those three are still listed in the room; scores outlive membership
      on purpose, so `roomStandings` filters the third out and the chair seats
      two. Either count is more than one, which is the case that was drawing a
      single figure.

      A share-based stake floors at exactly zero, so this is not a rare shape:
      it is what the wager does to the bottom of a table. `wager.md` records "a
      player on zero stakes nothing" as a known limit and this is the other end
      of it.
    */
    const players = playersNamed('Greg', 'Sam', 'Priya', 'Alex', 'Jo', 'Rach', 'Dev');
    const scores = {
      greg: 22_800, sam: 14_100, priya: 8_025, alex: 5_400, jo: 0, rach: 0, dev: 0,
    };

    // #when the card is modelled
    const card = modelFor({ players, scores });

    /*
      #then all three are named and the score is the one they share. The model
      has always carried the whole tie; both renderers used to collapse it to one
      figure, so this is what the drawing is now checked against.

      **In uid order, not join order** — `standings` breaks a tie on uid so every
      device orders the field identically. That is why it is safe to draw the
      first of them in the chair and the rest piled on: everybody's screen and
      everybody's shared PNG put the same person in the seat.
    */
    expect(card.chair).toEqual({ names: ['Dev', 'Jo', 'Rach'], score: 0 });
  });

  test('seats nobody in a room of three, matching the screen', () => {
    // #given a round small enough that last place is already on a riser
    const players = playersNamed('Greg', 'Sam', 'Priya');
    const scores = { greg: 2_000, sam: 900, priya: 600 };

    // #when the card is modelled
    const card = modelFor({ players, scores });

    // #then nobody is stood on a riser and sat in the chair at once. This is
    // `seatedLast` rather than a second rule, so the card cannot disagree with
    // the podium it was made from.
    expect(card.chair).toBeNull();
  });

  test('carries the rosettes when this device saw the whole game', () => {
    // #given a complete log of a two-question game
    const players = playersNamed('Greg', 'Sam', 'Priya');
    const scores = { greg: 2_000, sam: 900, priya: 0 };

    // #when the card is modelled
    const card = modelFor({ players, scores, log: WHOLE_GAME });

    // #then the rosettes are on it, named rather than counted
    expect(card.rosettes).not.toBeNull();
    expect(card.rosettes?.some((rosette) => rosette.id === 'fastest')).toBe(true);
  });

  test('withholds the rosettes entirely on a partial log, rather than showing zeros', () => {
    // #given a device that saw one question of a two-question game
    const players = playersNamed('Greg', 'Sam', 'Priya');
    const scores = { greg: 2_000, sam: 900, priya: 0 };

    // #when the card is modelled
    const card = modelFor({
      players,
      scores,
      log: WHOLE_GAME.slice(0, 1),
      questionCount: 2,
    });

    // #then there is no rosette section at all. An empty list would draw a
    // heading over nothing, and two people pasting different cards of the same
    // round into one channel is the failure the awards already avoid.
    expect(card.rosettes).toBeNull();
  });

  test('makes a card for a round nobody scored rather than throwing', () => {
    // #given a round that beat everybody
    const players = playersNamed('Greg', 'Sam', 'Priya');
    const scores = { greg: 0, sam: 0, priya: 0 };

    // #when the card is modelled
    const card = modelFor({ players, scores });

    // #then everybody is a joint winner and nobody is in the chair.
    //
    // **This asymmetry is the final screen's, not the card's**, and it is
    // asserted here rather than corrected. `seatedLast` refuses to seat anybody
    // on an all-zero table on the stated principle that "a round nobody scored
    // is not a round somebody lost" — but `Final` has always called the same
    // table a dead heat, so a 0–0–0 round already renders as everyone winning
    // and nobody losing. The card follows the screen, because a card that
    // reached a different verdict on the same round is the one failure this
    // whole model exists to avoid. Changing the rule is a decision about the
    // podium, not something to do while building a card.
    expect({ winners: card.winners, chair: card.chair, podium: card.podium.length }).toEqual({
      winners: ['Greg', 'Priya', 'Sam'],
      chair: null,
      podium: 3,
    });
  });

  test('makes a card for an empty room', () => {
    // #given nobody at all
    const card = modelFor({ players: {}, scores: {} });

    // #then nothing is named and nothing throws
    expect({ winners: card.winners, podium: card.podium, chair: card.chair }).toEqual({
      winners: [],
      podium: [],
      chair: null,
    });
  });

  test('drops anybody the frozen room no longer lists', () => {
    // #given a score belonging to somebody who is not in the players map
    const players = playersNamed('Greg', 'Sam');
    const scores = { greg: 900, sam: 600, ghost: 5_000 };

    // #when the card is modelled
    const card = modelFor({ players, scores });

    // #then the ghost is not on the podium, because the card reads the same
    // filtered rows the screen does
    expect(card.podium.map((row) => row.name)).toEqual(['Greg', 'Sam']);
  });

  test('says which pack it was, and falls back rather than printing nothing', () => {
    const players = playersNamed('Greg');
    const named = modelFor({ players, scores: { greg: 1_000 }, packTitle: 'Best of British' });
    const unnamed = modelFor({ players, scores: { greg: 1_000 }, packTitle: null });

    expect([named.pack, unnamed.pack]).toEqual(['Best of British', null]);
  });

  test('carries the round length and the moment it was made', () => {
    const card = modelFor({
      players: playersNamed('Greg'),
      scores: { greg: 1_000 },
      log: WHOLE_GAME,
      questionCount: 15,
    });

    expect({ questionCount: card.questionCount, at: card.at }).toEqual({
      questionCount: 15,
      at: AT,
    });
  });

  test('the room code appears nowhere in the model', () => {
    // The code is the capability that lets anyone into the room, the room lives
    // thirty days, and the round is over — so a card designed to be forwarded
    // must not carry it. This is a test rather than a convention because the
    // model is where somebody would helpfully add it.
    const card = modelFor({
      players: playersNamed('Greg', 'Sam'),
      scores: { greg: 1_000, sam: 600 },
      log: WHOLE_GAME,
    });

    expect(JSON.stringify(card)).not.toMatch(/\bcode\b/i);
  });
});

describe('cardModel agrees with the screen it is made from', () => {
  test('the winners are the rows the final screen calls first', () => {
    // #given the inputs `Final` holds
    const players = playersNamed('Greg', 'Sam', 'Priya');
    const scores = { greg: 1_800, sam: 1_800, priya: 600 };
    const rows = roomStandings(players, scores);

    // #when both work out who won
    const screenLeaders = rows
      .filter((entry) => entry.position === 1)
      .map((entry) => players[entry.uid]?.name);
    const card = modelFor({ players, scores });

    // #then they name the same people, in the same order. Two surfaces
    // disagreeing about who won the same round is the failure this exists to
    // avoid, and it is the one thing a card can do that a screen cannot: leave
    // the building.
    expect(card.winners).toEqual(screenLeaders);
  });

  test('the review is not on the card, which is deliberate', () => {
    // #given a round with a genuine highlight in it — one question that beat
    // everybody, which is what `reviewFor` calls a stumper
    const stumped: QuestionRecord[] = [
      {
        index: 0,
        correctIndex: 0,
        answers: {
          greg: { optionIndex: 1, elapsedMs: 900 },
          sam: { optionIndex: 2, elapsedMs: 1_500 },
          priya: { optionIndex: 3, elapsedMs: 2_000 },
        },
        deltas: { greg: 0, sam: 0, priya: 0 },
      },
    ];

    // #when the card is modelled from it
    const card = modelFor({
      players: playersNamed('Greg', 'Sam', 'Priya'),
      scores: { greg: 0, sam: 0, priya: 0 },
      log: stumped,
    });

    // #then the review had something to say and the card still does not carry
    // it. A good panel to read on a screen is noise at the size a chat client
    // shows an image; asserted so that adding it later is a decision rather
    // than a drift.
    expect(reviewFor(stumped).length).toBeGreaterThan(0);
    expect('review' in card).toBe(false);
  });
});
