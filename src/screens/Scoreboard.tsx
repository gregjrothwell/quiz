import { Standings } from '../components/Standings';
import type { RoomState } from '../engine/state';

interface ScoreboardProps {
  room: RoomState;
  youUid: string | null;
  isQuizmaster: boolean;
  onNext: () => void;
}

export function Scoreboard({ room, youUid, isQuizmaster, onNext }: ScoreboardProps) {
  const isLast = room.index + 1 >= room.questions.length;
  const skippedLast = room.skipped.includes(room.questions[room.index]?.id ?? '');

  return (
    <>
      <header>
        <p className="eyebrow">
          After {room.index + 1} of {room.questions.length}
        </p>
        <h1 className="display" style={{ fontSize: 'clamp(2.2rem, 9vw, 4rem)' }}>
          Standings
        </h1>
      </header>

      {skippedLast ? <p className="notice">That question was thrown out — no points awarded.</p> : null}

      <Standings
        players={room.players}
        scores={room.scores}
        deltas={room.lastDeltas}
        youUid={youUid}
      />

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
