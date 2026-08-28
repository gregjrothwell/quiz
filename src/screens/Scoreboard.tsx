import { SquadScore } from '../components/SquadScore';
import { Standings } from '../components/Standings';
import type { RoomState } from '../engine/state';
import { useCue } from '../lib/sound';

interface ScoreboardProps {
  room: RoomState;
  youUid: string | null;
  isQuizmaster: boolean;
  onNext: () => void;
}

const ORDINALS = [
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
] as const;

export function Scoreboard({ room, youUid, isQuizmaster, onNext }: ScoreboardProps) {
  const isLast = room.index + 1 >= room.questions.length;
  const skippedLast = room.skipped.includes(room.questions[room.index]?.id ?? '');
  const nextNumber = room.index + 2;
  const nextOrdinal = ORDINALS[nextNumber - 1] ?? String(nextNumber);

  // The sting belongs to the title card, so it only sounds when one is shown.
  useCue('sting', room.index, !isLast);

  return (
    <>
      {/*
        The title card lives here rather than over the question. Between rounds
        there is no clock running, so a beat of theatre costs nobody any
        answering time — laid over the question it would eat the first seconds
        of the answering window, which now goes as low as ten.
      */}
      {isLast ? null : (
        <div className="card">
          <span className="card__ghost" aria-hidden="true">
            {nextNumber}
          </span>
          <div className="chrome-wrap">
            <h1 className="display chrome card__round">Round {nextOrdinal}</h1>
          </div>
          <p className="card__topic">{room.packTitle ?? 'Next up'}</p>
        </div>
      )}

      <header>
        <p className="eyebrow">
          After {room.index + 1} of {room.questions.length}
        </p>
        <h2 className="display" style={{ fontSize: 'clamp(1.8rem, 7vw, 3rem)' }}>
          Standings
        </h2>
      </header>

      {skippedLast ? <p className="notice">That question was thrown out — no points awarded.</p> : null}

      <Standings
        players={room.players}
        scores={room.scores}
        deltas={room.lastDeltas}
        youUid={youUid}
      />

      {/*
        Under the individual table rather than above it. The round is still
        somebody's game to win; the squads are the second story, and putting
        them first would say otherwise. Renders nothing at all below two squads.
      */}
      <SquadScore players={room.players} scores={room.scores} />

      {isQuizmaster ? (
        <div className="btn-row">
          <button type="button" className="btn btn--primary" onClick={onNext}>
            {isLast ? 'Final results' : 'Next question'}
          </button>
        </div>
      ) : (
        <p className="muted">Waiting for the quizmaster…</p>
      )}
    </>
  );
}
