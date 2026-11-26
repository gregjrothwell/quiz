import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { HOUSE_DEFAULTS, type RoundSettings } from '../engine/houseRound';
import { createRoom, type RoomState } from '../engine/state';
import type { PackId, PackSummary } from '../questions/types';
import { Lobby } from './Lobby';

/**
 * How a round ends, chosen once, and every option carried into the next lobby.
 * docs/decisions/round-end.md.
 */

afterEach(cleanup);

const noop = () => {};

function pack(id: PackId, title: string): PackSummary {
  return { id, title, blurb: '', count: 100, counts: { easy: 40, medium: 40, hard: 40 } };
}

const PACKS = [pack('science', 'Science'), pack('survey', 'Survey Says')];
const PLAYERS = { greg: { name: 'Greg', joinedAt: 1 }, priya: { name: 'Priya', joinedAt: 2 } };
const FRESH: RoomState = { ...createRoom('HKQ7'), players: PLAYERS };
const SECOND_HALF: RoomState = {
  ...FRESH,
  doubleEnabled: true,
  double: { gameId: 'first-half', scores: { greg: 6_000, priya: 3_000 } },
};

/** The lobby with Change open, in a room that has played a round unless told otherwise. */
function lobby(room: RoomState, remembered: RoundSettings | null = null, played = true) {
  const onStart = vi.fn();
  render(
    <Lobby
      room={room}
      youUid="greg"
      isQuizmaster
      packs={PACKS}
      busy={false}
      played={played}
      remembered={remembered}
      onVote={noop}
      onStart={onStart}
      onLeave={noop}
    />,
  );
  press(/^Change$/);
  return onStart;
}

const button = (name: RegExp) => screen.getByRole('button', { name });
const press = (name: RegExp) => fireEvent.click(button(name));

/** The plan `onStart` was given. */
function started(onStart: ReturnType<typeof vi.fn>) {
  press(/Science/);
  press(/Start the show/);
  return onStart.mock.calls.at(-1)?.[1];
}

describe('How it ends', () => {
  test('stakes and Share or Shaft are one choice, so one cancels the other', () => {
    const onStart = lobby(FRESH);
    press(/^(New ?)?Share or Shaft/);
    press(/Played for stakes/);
    expect(button(/^(New ?)?Share or Shaft/)).toHaveAttribute('aria-pressed', 'false');
    expect(started(onStart)).toMatchObject({ wagerEnabled: true, standoffEnabled: false });
  });

  test('a fresh room ends on the last answer, with neither', () => {
    const onStart = lobby(FRESH);
    expect(button(/On the last answer/)).toHaveAttribute('aria-pressed', 'true');
    expect(started(onStart)).toMatchObject({ wagerEnabled: false, standoffEnabled: false });
  });

  test('Survey Says offers no stakes, and a stake already picked does not carry onto it', () => {
    const onStart = lobby({ ...FRESH, wagerEnabled: true });
    press(/Survey Says/);
    expect(button(/Played for stakes/)).toBeDisabled();
    expect(button(/On the last answer/)).toHaveAttribute('aria-pressed', 'true');
    press(/Start the show/);
    expect(onStart.mock.calls.at(-1)?.[1]).toMatchObject({ wagerEnabled: false });
  });
});

describe('the next lobby starts from the last round', () => {
  test('the second half keeps Share or Shaft, untouched (the bug: it silently never played)', () => {
    const onStart = lobby({ ...SECOND_HALF, standoffEnabled: true });
    expect(started(onStart)).toMatchObject({ standoffEnabled: true, doubleEnabled: true });
  });

  test('stakes, steals, Mr Fries and the clock are all kept', () => {
    const onStart = lobby({ ...FRESH, wagerEnabled: true, stealEnabled: true, chaserEnabled: true, durationSecs: 15 });
    expect(started(onStart)).toMatchObject({ wagerEnabled: true, stealEnabled: true, chaserEnabled: true, durationSecs: 15 });
  });

  test('the clock kept is the answering time, not the window with the lead-in on it (PROJ-179)', () => {
    const onStart = lobby({ ...FRESH, durationSecs: 17, leadInSecs: 2 });
    expect(started(onStart)).toMatchObject({ durationSecs: 15 });
  });

  test('both on from an older room reads as Share or Shaft', () => {
    const onStart = lobby({ ...FRESH, wagerEnabled: true, standoffEnabled: true });
    expect(started(onStart)).toMatchObject({ wagerEnabled: false, standoffEnabled: true });
  });

  test('the length and the level this device last dealt are kept', () => {
    const onStart = lobby(FRESH, { ...HOUSE_DEFAULTS, count: 20, level: 'medium' });
    expect(started(onStart)).toMatchObject({ count: 20, level: 'medium' });
  });

  test('The Double itself is not carried: Another round after one is ordinary', () => {
    const onStart = lobby({ ...FRESH, standoffEnabled: true, doubleEnabled: false, double: null });
    expect(started(onStart)).toMatchObject({ doubleEnabled: false });
  });
});

describe('where Start is', () => {
  test('in the transport, so it stays on screen with every option open', () => {
    lobby(FRESH);
    expect(button(/Start the show/).closest('.transport')).not.toBeNull();
  });
});
