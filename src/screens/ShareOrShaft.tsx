import { useCallback, useEffect } from 'react';
import { Standings } from '../components/Standings';
import { roomStandings } from '../engine/scoring';
import { potOf, type StandoffPick } from '../engine/standoff';
import { standoffWords } from '../engine/standoffWords';
import type { RoomState } from '../engine/state';
import { play, useCue } from '../lib/sound';
import type { StandoffView } from '../lib/useStandoff';

interface ShareOrShaftProps {
  room: RoomState;
  youUid: string | null;
  isQuizmaster: boolean;
  view: StandoffView;
  /** Ends the talking early. The quizmaster's device ends it anyway when the clock runs out. */
  onOpenPicks: () => void;
  /** From the reveal to the results. */
  onNext: () => void;
}

const points = (value: number): string => value.toLocaleString('en-GB');

/**
 * The final: the top two, both their scores in the pot, sixty seconds to talk
 * and fifteen to pick. See `engine/standoff.ts` for the rules and
 * docs/decisions/share-or-shaft.md for why each one is what it is.
 *
 * Every screen shows the same two seats. What differs is only what a viewer can
 * do: a finalist gets the two buttons, the quizmaster gets the stage controls,
 * and everybody else watches. Nobody's screen shows a pick before the reveal —
 * the most a spectator ever sees is *locked in*.
 */
export function ShareOrShaft({
  room,
  youUid,
  isQuizmaster,
  view,
  onOpenPicks,
  onNext,
}: ShareOrShaftProps) {
  const standoff = room.standoff;
  const stage = standoff?.stage ?? 'talk';
  const amFinalist = youUid !== null && Boolean(standoff?.finalists.includes(youUid));
  const { pick, myPick } = view;

  useCue('sting', `${room.gameId ?? ''}:final`, stage === 'talk');
  useCue('gong', `${room.gameId ?? ''}:revealed`, stage === 'revealed');

  const choose = useCallback(
    (choice: StandoffPick) => {
      play('lock');
      pick(choice);
    },
    [pick],
  );

  // The whole final is playable from the keyboard, as the round is: 1 to share,
  // 2 to shaft, and space for the quizmaster to move it on.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();

      if (stage === 'pick' && amFinalist && myPick === null && (key === '1' || key === '2')) {
        event.preventDefault();
        choose(key === '1' ? 'share' : 'shaft');
        return;
      }

      if (!isQuizmaster || (key !== ' ' && key !== 'enter')) return;
      if (stage === 'talk') {
        event.preventDefault();
        onOpenPicks();
      } else if (stage === 'revealed') {
        event.preventDefault();
        onNext();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stage, amFinalist, myPick, isQuizmaster, choose, onOpenPicks, onNext]);

  if (!standoff) {
    return <p className="muted">Setting up the final…</p>;
  }

  const nameOf = (uid: string): string => room.players[uid]?.name ?? 'Somebody who left';
  const leaderAfter = roomStandings(room.players, room.scores)[0]?.uid ?? null;
  const words = standoffWords({ standoff, nameOf, youUid, leaderAfter });

  const seatState = (uid: string): { label: string; state: string } => {
    if (stage === 'revealed') {
      const picked = standoff.picks?.[uid] ?? null;
      return picked === null ? { label: 'No pick', state: 'none' } : { label: picked, state: picked };
    }
    if (stage === 'closed') {
      return standoff.sealed?.includes(uid)
        ? { label: 'Locked in', state: 'locked' }
        : { label: 'No pick', state: 'none' };
    }
    if (stage === 'pick') {
      return view.lockedIn[uid] ? { label: 'Locked in', state: 'locked' } : { label: 'Choosing…', state: 'waiting' };
    }
    return { label: 'Talking', state: 'waiting' };
  };

  return (
    <>
      <div className="card">
        <span className="card__ghost" aria-hidden="true">
          ?
        </span>
        <div className="chrome-wrap">
          <h1 className="display chrome card__round">Share or Shaft</h1>
        </div>
        <p className="card__topic">Playing for {points(potOf(standoff))}</p>
      </div>

      <div className="standoff" aria-live="polite">
        {standoff.finalists.map((uid) => {
          const { label, state } = seatState(uid);
          return (
            <div
              key={uid}
              className={uid === youUid ? 'standoff__seat standoff__seat--you' : 'standoff__seat'}
            >
              <p className="standoff__name">
                {nameOf(uid)}
                {uid === youUid ? <span className="standoff__you"> (you)</span> : null}
              </p>
              <p className="standoff__stake">{points(standoff.stakes[uid] ?? 0)} in the pot</p>
              <p className="standoff__state" data-state={state}>
                {label}
              </p>
            </div>
          );
        })}
      </div>

      {stage === 'talk' ? (
        <div className="stack standoff__stage">
          <p className="standoff__clock" aria-label={`${view.secondsLeft} seconds to talk`}>
            {view.secondsLeft}
          </p>
          <p className="lede">
            {amFinalist
              ? 'Sixty seconds, out loud on the call. Then you each pick in secret.'
              : 'Sixty seconds for them to talk it over. Then they each pick in secret.'}
          </p>
          <p className="muted hint">
            Both share: half each, joint winners. One shafts: they take the lot. Both shaft: both lose
            it all, and whoever is third wins.
          </p>
          {isQuizmaster ? (
            <div className="btn-row">
              <button type="button" className="btn btn--primary" onClick={onOpenPicks}>
                Time to choose
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {stage === 'pick' ? (
        <div className="stack standoff__stage">
          <p className="standoff__clock" aria-label={`${view.secondsLeft} seconds to pick`}>
            {view.secondsLeft}
          </p>
          {amFinalist ? (
            <>
              <div className="picker">
                <button
                  type="button"
                  className="pick"
                  aria-pressed={myPick === 'share'}
                  disabled={myPick !== null}
                  onClick={() => choose('share')}
                >
                  <b>Share</b>
                  <span>Split the pot, level</span>
                  <i>Press 1</i>
                </button>
                <button
                  type="button"
                  className="pick"
                  aria-pressed={myPick === 'shaft'}
                  disabled={myPick !== null}
                  onClick={() => choose('shaft')}
                >
                  <b>Shaft</b>
                  <span>Take the lot, unless they do too</span>
                  <i>Press 2</i>
                </button>
              </div>
              <p className="muted hint">
                {myPick === null
                  ? 'Nobody sees your pick until both of you are in. No pick counts as share.'
                  : 'Locked in. Nobody can see it, and it cannot change.'}
              </p>
            </>
          ) : (
            <p className="lede">
              They are choosing. Nobody sees either pick until both are in.
            </p>
          )}
        </div>
      ) : null}

      {stage === 'closed' ? (
        <div className="stack standoff__stage">
          <p className="lede">Turning them over…</p>
        </div>
      ) : null}

      {stage === 'revealed' && words ? (
        <div className="stack standoff__stage">
          <p className="standoff__headline">{words.headline}</p>
          {words.note ? <p className="muted hint">{words.note}</p> : null}
          <Standings players={room.players} scores={room.scores} deltas={room.lastDeltas} youUid={youUid} />
          {isQuizmaster ? (
            <div className="btn-row">
              <button type="button" className="btn btn--primary" onClick={onNext}>
                Final results
              </button>
            </div>
          ) : (
            <p className="muted">Waiting for the quizmaster…</p>
          )}
        </div>
      ) : null}
    </>
  );
}
