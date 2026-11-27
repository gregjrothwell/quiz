import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { TEST_SHOT, type Shot } from '../engine/cannon';
import { HOUSE_DEFAULTS, roundLine, type RoundPlan, type RoundSettings } from '../engine/houseRound';
import { createRoom, type RoomState } from '../engine/state';
import type { PackId, PackSummary } from '../questions/types';
import { Lobby } from './Lobby';

/**
 * The house round in the lobby: one line that says how the round will be run,
 * and the pickers behind Change. docs/decisions/house-round.md.
 */

afterEach(cleanup);

const noop = () => {};

function pack(id: PackId, title: string): PackSummary {
  return {
    id,
    title,
    blurb: '',
    count: 100,
    counts: { easy: 40, medium: 40, hard: 40 },
    ...(id === 'picture' ? { jigsawCount: 48 } : {}),
  };
}

const PACKS = [
  pack('science', 'Science'),
  pack('survey', 'Survey Says'),
  pack('themes', 'Theme Tunes'),
  pack('picture', 'Fine Art'),
];
const PLAYERS = { greg: { name: 'Greg', joinedAt: 1 }, priya: { name: 'Priya', joinedAt: 2 } };
const FRESH: RoomState = { ...createRoom('HKQ7'), players: PLAYERS };

const USUAL: RoundSettings = {
  count: 20,
  level: 'medium',
  durationSecs: 15,
  ending: 'standoff',
  steal: true,
  chaser: true,
};

interface Options {
  room?: RoomState;
  played?: boolean;
  remembered?: RoundSettings | null;
  isQuizmaster?: boolean;
  shots?: readonly Shot[];
  today?: string;
}

function lobby({ room = FRESH, played = false, remembered = null, isQuizmaster = true, shots = [], today }: Options = {}) {
  const onStart = vi.fn<(packId: PackId, plan: RoundPlan, settings: RoundSettings) => void>();
  render(
    <Lobby
      room={room}
      youUid={isQuizmaster ? 'greg' : 'priya'}
      isQuizmaster={isQuizmaster}
      packs={PACKS}
      busy={false}
      played={played}
      remembered={remembered}
      shots={shots}
      onVote={noop}
      onStart={onStart}
      onLeave={noop}
      // What's new is not this file's subject: its teaser is a button whose text
      // can name a pack (27 Nov 2026, "More Theme Tunes…"), and `choose` finds
      // pack cards by name. Lobby.newMode.test.tsx pins it the same way.
      notice={{ unseen: false, teaser: null }}
      {...(today === undefined ? {} : { today })}
    />,
  );
  return onStart;
}

const change = () => screen.getByRole('button', { name: 'Change' });
const open = () => fireEvent.click(change());
const choose = (title: RegExp) => fireEvent.click(screen.getByRole('button', { name: title }));

/** The line on screen. Found by Change's own wiring, and with the hard spaces that keep a dot off the start of a row read as spaces. */
const line = () =>
  (document.getElementById(change().getAttribute('aria-describedby') ?? '')?.textContent ?? '').replaceAll('\u00a0', ' ');

/** The pickers behind Change. Found by the disclosure's own wiring, so a wrong id fails here. */
function panel(): HTMLElement {
  const found = document.getElementById(change().getAttribute('aria-controls') ?? '');
  if (!found) throw new Error('Change controls nothing');
  return found;
}

function started(onStart: ReturnType<typeof lobby>): { packId: PackId; plan: RoundPlan; settings: RoundSettings } {
  fireEvent.click(screen.getByRole('button', { name: 'Start the show' }));
  const [packId, plan, settings] = onStart.mock.calls.at(-1) ?? [];
  if (!packId || !plan || !settings) throw new Error('Start did nothing');
  return { packId, plan, settings };
}

describe('1 · a new room starts from this device’s last round', () => {
  test('and starts the round on it untouched', () => {
    const onStart = lobby({ remembered: USUAL });
    choose(/Science/);
    expect(started(onStart).plan).toMatchObject({
      count: 20,
      level: 'medium',
      durationSecs: 15,
      standoffEnabled: true,
      wagerEnabled: false,
      stealEnabled: true,
      chaserEnabled: true,
    });
  });

  test('a brand-new device starts from the defaults it always did', () => {
    const onStart = lobby();
    choose(/Science/);
    expect(started(onStart).plan).toEqual({
      count: 15,
      level: 'ramp',
      durationSecs: 10,
      wagerEnabled: false,
      stealEnabled: false,
      jigsawEnabled: false,
      standoffEnabled: false,
      chaserEnabled: false,
      doubleEnabled: false,
      cannon: {},
    });
  });

  test('Start hands back what was picked, for the device to remember', () => {
    const onStart = lobby({ remembered: USUAL });
    open();
    choose(/Played for stakes/);
    choose(/Science/);
    expect(started(onStart).settings).toEqual({ ...USUAL, ending: 'stakes' });
  });

  test('a pick the pack could not play is still the pick that is remembered', () => {
    // Theme Tunes is always ten seconds and Survey Says takes no stakes. Neither
    // is the quizmaster changing their mind.
    const onStart = lobby({ remembered: { ...USUAL, ending: 'stakes' } });
    choose(/Theme Tunes/);
    const tunes = started(onStart);
    expect(tunes.plan.durationSecs).toBe(10);
    expect(tunes.settings.durationSecs).toBe(15);
    choose(/Survey Says/);
    const survey = started(onStart);
    expect(survey.plan).toMatchObject({ count: 10, wagerEnabled: false, stealEnabled: false, chaserEnabled: false });
    expect(survey.settings).toEqual({ ...USUAL, ending: 'stakes' });
  });

  test("in a room that has been played in, its last round wins", () => {
    const onStart = lobby({
      room: { ...FRESH, wagerEnabled: true, durationSecs: 22, leadInSecs: 2 },
      played: true,
      remembered: USUAL,
    });
    choose(/Science/);
    expect(started(onStart).plan).toMatchObject({
      wagerEnabled: true,
      standoffEnabled: false,
      stealEnabled: false,
      durationSecs: 20,
    });
  });
});

describe('2 · one line above the packs', () => {
  test('says the round, before a pack is even chosen', () => {
    lobby({ remembered: { ...USUAL, steal: false, chaser: false } });
    expect(line()).toBe('20 questions · 15 seconds · Standard · ends on a final');
  });

  test('is above the packs and below the room', () => {
    lobby();
    const order = [
      screen.getByText('Room code'),
      screen.getByText(/In the room/),
      change(),
      screen.getByText('Choose a set'),
      screen.getByRole('button', { name: /Science/ }),
    ];
    for (const [index, after] of order.slice(1).entries()) {
      const before = order[index];
      expect(before?.compareDocumentPosition(after)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    }
  });

  test('says what the chosen pack will really play', () => {
    lobby({ remembered: { ...USUAL, ending: 'stakes' } });
    choose(/Theme Tunes/);
    expect(line()).toContain('10 seconds');
    choose(/Survey Says/);
    expect(line()).toBe('10 questions · 15 seconds · ends on the last answer');
    choose(/Science/);
    expect(line()).toContain('15 seconds');
    expect(line()).toContain('ends on stakes');
  });

  test('changes as an option is pressed', () => {
    lobby();
    open();
    choose(/Share or Shaft/);
    expect(line()).toContain('ends on a final');
    choose(/First right answer steals/);
    expect(line()).toContain('first right answer steals');
  });

  test('the second half of The Double says it is one', () => {
    lobby({
      room: { ...FRESH, standoffEnabled: true, doubleEnabled: true, double: { gameId: 'first', scores: {} } },
      played: true,
    });
    expect(line()).toContain('The Double');
    expect(line()).toContain('ends on a final');
  });
});

describe('3 · the pickers are behind Change', () => {
  test('shut to begin with, and nothing in them can be reached', () => {
    lobby();
    expect(change()).toHaveAttribute('aria-expanded', 'false');
    expect(panel()).not.toBeVisible();
    expect(screen.queryByRole('button', { name: /The Ladder/ })).toBeNull();
  });

  test('open and shut by keyboard, and focus stays on Change', async () => {
    const user = userEvent.setup();
    lobby();
    change().focus();
    await user.keyboard('{Enter}');
    expect(change()).toHaveAttribute('aria-expanded', 'true');
    expect(panel()).toBeVisible();
    expect(change()).toHaveFocus();
    await user.keyboard(' ');
    expect(change()).toHaveAttribute('aria-expanded', 'false');
    expect(panel()).not.toBeVisible();
    expect(change()).toHaveFocus();
  });

  test('Tab goes from Change straight into what it opened', async () => {
    const user = userEvent.setup();
    lobby();
    change().focus();
    await user.keyboard('{Enter}');
    await user.tab();
    expect(panel()).toContainElement(document.activeElement as HTMLElement);
  });

  test('its name does not change with its state, which aria-expanded already says', () => {
    lobby();
    open();
    expect(change()).toHaveAccessibleName('Change');
    expect(change().getAttribute('aria-describedby')).toBe(screen.getByText(/15 questions/).id);
  });

  test('every picker is in there, and none has been left outside', () => {
    lobby({ shots: [TEST_SHOT] });
    choose(/Fine Art/);
    open();
    for (const label of [
      'Set the level',
      'Time to answer',
      'Questions this round',
      'How it ends',
      'How long',
      'Chasing the leader',
      'Against the house',
      'How the pictures show',
      'Slop Cannon',
    ]) {
      expect(panel()).toContainElement(screen.getByText(label));
    }
    for (const pick of document.querySelectorAll('.pick')) expect(panel()).toContainElement(pick as HTMLElement);
  });

  test('shutting it keeps what was picked', () => {
    const onStart = lobby();
    open();
    choose(/Played for stakes/);
    open();
    choose(/Science/);
    expect(started(onStart).plan.wagerEnabled).toBe(true);
  });

  test('a mode still wearing its sticker is announced beside Change, or nobody would meet it', () => {
    lobby({ today: '2026-11-05' });
    expect(within(screen.getByRole('group', { name: 'This round' })).getByText('New')).toBeVisible();
    cleanup();
    lobby({ today: '2026-11-25' });
    expect(within(screen.getByRole('group', { name: 'This round' })).queryByText('New')).toBeNull();
  });
});

describe('4 · nothing is on that the line does not say', () => {
  /*
    Every button behind Change, found rather than listed, so a picker added
    later is covered by being added. Each is pressed on its own in a fresh
    lobby: if it changes the round that Start sends, it has to change the line,
    and the line always has to be the one for exactly the round that was sent.
  */
  const everyButton = (title: RegExp): string[] => {
    lobby({ shots: [TEST_SHOT] });
    choose(title);
    open();
    const names = within(panel()).getAllByRole('button').map((each) => each.textContent ?? '');
    cleanup();
    return names;
  };

  /*
    A whole lobby rendered once per button, twenty-odd times a test: 1.3–1.6s
    here, 5.5–6.6s on CI's runner, so Vitest's 5s refused three of the four on
    #216's first run (26 Nov 2026). Real work rather than a hang, so it gets
    room rather than fewer buttons.
  */
  const EVERY_BUTTON_MS = 30_000;

  for (const [title, matcher] of [
    ['an ordinary pack', /Science/],
    ['Survey Says', /Survey Says/],
    ['a pack that fixes its clock', /Theme Tunes/],
    ['Fine Art', /Fine Art/],
  ] as const) {
    test(`on ${title}, every button`, () => {
      const names = everyButton(matcher);
      expect(names.length).toBeGreaterThan(8);
      let moved = 0;

      for (const name of names) {
        const onStart = lobby({ shots: [TEST_SHOT] });
        choose(matcher);
        const before = { plan: started(onStart).plan, line: line() };
        open();
        const button = within(panel()).getAllByRole('button').find((each) => each.textContent === name);
        if (!button) throw new Error(`no ${name}`);
        if (!(button as HTMLButtonElement).disabled) fireEvent.click(button);

        const { packId, plan } = started(onStart);
        expect(line(), name).toBe(roundLine(packId, plan, [TEST_SHOT]).join(' · '));

        const changed = JSON.stringify(plan) !== JSON.stringify(before.plan);
        expect(line() !== before.line, name).toBe(changed);
        if (changed) moved += 1;
        cleanup();
      }
      // Not vacuous: on every pack a good few of them do change the round.
      expect(moved).toBeGreaterThan(4);
    }, EVERY_BUTTON_MS);
  }

  test('and whatever was remembered is said too', () => {
    for (const ending of ['top', 'stakes', 'standoff'] as const) {
      for (const steal of [false, true]) {
        for (const chaser of [false, true]) {
          const onStart = lobby({ remembered: { ...USUAL, ending, steal, chaser } });
          choose(/Science/);
          const { packId, plan } = started(onStart);
          expect(line()).toBe(roundLine(packId, plan, []).join(' · '));
          expect(line().includes('steals')).toBe(steal);
          expect(line().includes('Mr Fries')).toBe(chaser);
          cleanup();
        }
      }
    }
  });
});

describe('5 · what is never carried', () => {
  // More than the type allows, which is what a hand-edited or older store holds.
  const tooMuch = { ...USUAL, packId: 'science', double: true, doubleEnabled: true, jigsaw: true } as RoundSettings;

  test('the pack', () => {
    lobby({ remembered: tooMuch });
    expect(document.querySelectorAll('.pack[aria-pressed="true"]')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Start the show' })).toBeDisabled();
  });

  test('The Double, the jigsaw and the Slop Cannon', () => {
    const onStart = lobby({ remembered: tooMuch, shots: [TEST_SHOT] });
    choose(/Fine Art/);
    expect(started(onStart).plan).toMatchObject({ doubleEnabled: false, jigsawEnabled: false, cannon: {} });
    expect(line()).not.toMatch(/Double|jigsaw|Slop/);
  });

  test('none of the three is in what Start hands back to be remembered', () => {
    const onStart = lobby({ shots: [TEST_SHOT] });
    choose(/Fine Art/);
    open();
    choose(/^(New ?)?The Double/);
    choose(/As a 3×3 jigsaw/);
    choose(/Test shot/);
    const { plan, settings } = started(onStart);
    expect(plan).toMatchObject({ doubleEnabled: true, jigsawEnabled: true, cannon: { 'test-shot': true } });
    expect(Object.keys(settings).sort()).toEqual(Object.keys(HOUSE_DEFAULTS).sort());
  });
});

describe('a player who is not the quizmaster', () => {
  test('sees no line, no Change and no pickers', () => {
    lobby({ isQuizmaster: false, remembered: USUAL });
    expect(screen.queryByRole('button', { name: 'Change' })).toBeNull();
    expect(screen.queryByText(/questions · /)).toBeNull();
    expect(document.querySelectorAll('.pick')).toHaveLength(0);
  });

  test('keeps their squad and the sound check above the vote, where they were', () => {
    lobby({ isQuizmaster: false });
    const vote = screen.getByText('Vote for a set');
    for (const above of [screen.getByText(/Your squad/), screen.getByText('Sound check')]) {
      expect(above.compareDocumentPosition(vote)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    }
  });
});

describe('the quizmaster’s own bits', () => {
  test('squad and sound check move below the packs, and are still there', () => {
    lobby();
    const packs = screen.getByText('Choose a set');
    for (const below of [screen.getByText(/Your squad/), screen.getByText('Sound check')]) {
      expect(packs.compareDocumentPosition(below)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    }
  });
});
