import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { createRoom, type QuizQuestion, type RoomState } from '../engine/state';
import { QuestionScreen } from './QuestionScreen';

/**
 * Which questions put the picture beside the answers.
 *
 * jsdom does no layout, so nothing here can measure the two columns — the
 * widths were measured in a real browser and are in
 * `docs/decisions/picture-loading.md`. What this pins is the decision the
 * stylesheet keys off: **only a question with a picture splits the row.**
 *
 * That is the half that would regress silently. A text round has nothing to put
 * in the left column, so splitting its row leaves every lectern at half width
 * with a column of nothing beside it — and no test that only checked the
 * picture questions would ever notice.
 */

afterEach(cleanup);

const noop = () => {};

const CLOCK = { elapsedMs: 6_000, remainingMs: 14_000, secondsLeft: 14, expired: false };

function roomWith(question: QuizQuestion): RoomState {
  return {
    ...createRoom('HKQ7'),
    phase: 'question',
    packId: 'uk-leaning',
    packTitle: 'Best of British',
    players: { greg: { name: 'Greg', joinedAt: 100 } },
    questions: [question],
  };
}

function show(question: QuizQuestion, revealed = false) {
  return render(
    <QuestionScreen
      room={roomWith(question)}
      youUid="greg"
      isQuizmaster
      clock={CLOCK}
      revealed={revealed}
      onAnswer={noop}
      onReveal={noop}
      onNext={noop}
      onVote={noop}
    />,
  );
}

const BASE = {
  id: 'q1',
  prompt: 'Which one is it?',
  options: ['A', 'B', 'C', 'D'],
  correctIndex: null,
  category: 'Film',
  difficulty: 'easy',
} satisfies Omit<QuizQuestion, never>;

describe('the question row', () => {
  test('a hashed still puts the picture beside the answers', () => {
    // #given an On the box question
    const { container } = show({ ...BASE, image: 'abc.jpg', imageWidth: 780, imageHeight: 439 });

    // #then the row is the split one, and the lecterns are inside its second
    // column rather than under the picture
    const split = container.querySelector('.qsplit--split');
    expect(split).not.toBeNull();
    expect(split?.querySelector('.qsplit__answers .podium')).not.toBeNull();
    expect(split?.querySelector('.still')).not.toBeNull();
  });

  test('Apple artwork splits the row too', () => {
    // #given a sleeve, whose picture is hotlinked rather than hashed
    const { container } = show({
      ...BASE,
      artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/x/600x600bb.jpg',
    });

    // #then the same row. Every picture round gets this, not just the one Greg
    // was looking at when he asked.
    expect(container.querySelector('.qsplit--split')).not.toBeNull();
  });

  test('a text question does not split the row', () => {
    // #given an ordinary question with nothing to show
    const { container } = show(BASE);

    // #then the plain column. Splitting here would halve every lectern and put
    // a column of nothing beside them.
    expect(container.querySelector('.qsplit')).not.toBeNull();
    expect(container.querySelector('.qsplit--split')).toBeNull();
    expect(container.querySelector('.podium')).not.toBeNull();
  });

  test('a tune question does not split the row', () => {
    // #given Name that Tune — a question whose prompt is a sound
    const { container } = show({
      ...BASE,
      previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/x.m4a',
      storeUrl: 'https://music.apple.com/gb/album/1',
    });

    // #then no split, and no picture to have caused one
    expect(container.querySelector('.qsplit--split')).toBeNull();
    expect(container.querySelector('.still')).toBeNull();
  });

  test('all four options are in the row whether it splits or not', () => {
    // #given the two shapes side by side
    const withPicture = show({ ...BASE, image: 'abc.jpg', imageWidth: 780, imageHeight: 439 });
    const withoutPicture = show(BASE);

    // #then four lecterns either way. The point of the layout is that the
    // answers stay visible next to the bigger picture, so losing one to the
    // second column would be the whole thing failing.
    expect(withPicture.container.querySelectorAll('.podium > *')).toHaveLength(4);
    expect(withoutPicture.container.querySelectorAll('.podium > *')).toHaveLength(4);
  });
});


/**
 * The store link is one tap from the answer, so it waits for the reveal.
 *
 * "View in Apple Music" under *Which album is this?* opens the album's own
 * page. It sat there for the whole answering window on all 44 sleeves and all
 * 177 tunes — Greg, 22 September 2026: "it literally tells you the answer."
 *
 * **The tune case is a decision against Apple's terms, not an oversight.** The
 * badge is one of six conditions the iTunes Search API attaches to using a
 * preview, and hiding it during playback is the reading Apple would argue
 * with. Greg took that call on 22 September 2026 knowing it; the reasoning is
 * in `docs/decisions/tunes-round.md` and the exposure in
 * `docs/decisions/known-limits.md`. **Do not quietly put it back** — if it
 * returns it should be because that decision was revisited, not because a
 * later tidy found a test that looked odd.
 */
describe('the Apple Music badge', () => {
  const SLEEVE = {
    ...BASE,
    prompt: 'Which album is this?',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/x/600x600bb.jpg',
    storeUrl: 'https://music.apple.com/gb/album/1474815798?uo=4',
  };
  const TUNE = {
    ...BASE,
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/x.m4a',
    storeUrl: 'https://music.apple.com/gb/album/1440717563?i=1440717826&uo=4',
  };

  test('a sleeve does not offer the link while the clock is running', () => {
    // #given a sleeve question, still being answered
    const { container } = show(SLEEVE);

    // #then no way through to the album's page, which is the answer
    expect(container.querySelector('.store-badge')).toBeNull();
  });

  test('a sleeve offers it at the reveal', () => {
    // #given the same question once the answer is out
    const { container } = show(SLEEVE, true);

    // #then the link is back. Hiding it for good would drop the attribution
    // as well as the giveaway, and by now there is nothing left to give away.
    const badge = container.querySelector('.store-badge');
    expect(badge).not.toBeNull();
    expect(badge?.getAttribute('href')).toBe(SLEEVE.storeUrl);
  });

  test('a tune does not offer the link while the clock is running either', () => {
    // #given Name that Tune, mid-question, with a preview playing
    const { container } = show(TUNE);

    // #then no badge. Same reasoning as the sleeve: the link opens the song's
    // own page, which is the answer, on all 177 of them.
    expect(container.querySelector('.store-badge')).toBeNull();
  });

  test('a tune offers it at the reveal', () => {
    // #given the same question once the answer is out
    const { container } = show(TUNE, true);

    // #then the link is back, pointing at the track it streamed.
    expect(container.querySelector('.store-badge')?.getAttribute('href')).toBe(TUNE.storeUrl);
  });

  test('a question with no store link shows no badge either way', () => {
    // #given an ordinary question
    // #then nothing to show, revealed or not
    expect(show(BASE).container.querySelector('.store-badge')).toBeNull();
    expect(show(BASE, true).container.querySelector('.store-badge')).toBeNull();
  });
});
