import { act, cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { RigReport } from '../engine/rigProbe';
import { RigCheck } from './RigCheck';

const rig = vi.hoisted(() => ({
  startRig: vi.fn(),
  followRig: vi.fn(),
  watchRig: vi.fn(),
}));

vi.mock('../firebase', () => ({ realtimeDb: () => ({}) }));
vi.mock('../lib/rigDevice', () => rig);

const RUN = { id: 'run-1', startAt: 1, by: 'host' };

beforeEach(() => {
  rig.startRig.mockReset().mockResolvedValue(RUN);
  rig.followRig.mockReset().mockReturnValue(() => undefined);
  rig.watchRig.mockReset().mockReturnValue(() => undefined);
});

afterEach(cleanup);

describe('RigCheck', () => {
  test('pressing the button asks first and starts nothing', async () => {
    // #given the host in the lobby
    render(<RigCheck code="ABCD" uid="host" isHost />);

    // #when they press the button once
    await userEvent.click(screen.getByRole('button', { name: 'Run the rig check' }));

    // #then nothing has started and the question is on screen
    expect(rig.startRig).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Yes, run it' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  test('saying yes starts the run', async () => {
    // #given the host has been asked
    render(<RigCheck code="ABCD" uid="host" isHost />);
    await userEvent.click(screen.getByRole('button', { name: 'Run the rig check' }));

    // #when they say yes
    await userEvent.click(screen.getByRole('button', { name: 'Yes, run it' }));

    // #then the run starts, once, and the question goes away
    expect(rig.startRig).toHaveBeenCalledTimes(1);
    expect(rig.startRig).toHaveBeenCalledWith({}, 'ABCD', 'host');
    expect(screen.queryByRole('button', { name: 'Yes, run it' })).not.toBeInTheDocument();
  });

  test('cancel goes back without starting anything', async () => {
    // #given the host has been asked
    render(<RigCheck code="ABCD" uid="host" isHost />);
    await userEvent.click(screen.getByRole('button', { name: 'Run the rig check' }));

    // #when they cancel
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    // #then the original button is back and nothing started
    expect(rig.startRig).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Run the rig check' })).toBeInTheDocument();
  });

  test('a double-click on the button does not start a run', async () => {
    // #given the host in the lobby, where the second click of a double-click
    // lands on the same element, which by then says Cancel
    render(<RigCheck code="ABCD" uid="host" isHost />);

    // #when they double-click it
    await userEvent.dblClick(screen.getByRole('button', { name: 'Run the rig check' }));

    // #then no run started
    expect(rig.startRig).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Run the rig check' })).toBeInTheDocument();
  });

  test('a player who is not the host gets no button', () => {
    // #given a player in the lobby
    // #when the check is drawn
    render(<RigCheck code="ABCD" uid="player" isHost={false} />);

    // #then there is nothing to press
    expect(screen.queryByRole('button', { name: 'Run the rig check' })).not.toBeInTheDocument();
  });

  test('the wording does not assume a phone', async () => {
    // #given a host whose run has reported
    const report: RigReport = { devices: 7, cues: [], cuesPassed: 10, pass: true };
    render(<RigCheck code="ABCD" uid="host" isHost />);

    // #then the description says screens
    expect(screen.getByText(/on every screen in the room/)).toBeInTheDocument();

    // #when the run reports
    await userEvent.click(screen.getByRole('button', { name: 'Run the rig check' }));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, run it' }));
    const onReport = rig.watchRig.mock.calls[0]?.[3] as (next: RigReport) => void;
    act(() => onReport(report));

    // #then it counts devices, not phones
    expect(screen.getByText(/^7 devices · 10 of 10 cues/)).toBeInTheDocument();

    // #and during a cue only a phone is told to hold itself up
    const onCue = (rig.followRig.mock.calls[0]?.[3] as { onCue: (index: number, on: boolean) => void }).onCue;
    act(() => onCue(0, true));
    expect(screen.getByText('On a phone? Hold it up: cue 1 of 10')).toBeInTheDocument();
  });
});
