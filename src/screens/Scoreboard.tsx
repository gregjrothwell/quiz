import { chaserScore, chaserTally } from '../engine/chaser';
import { Commentary } from '../components/Commentary';
import { NewSticker } from '../components/NewSticker';
import { SquadScore } from '../components/SquadScore';
import { Standings } from '../components/Standings';
import { morningTotals } from '../engine/double';
import type { Shot } from '../engine/cannon';
import { LOST_LINE, verdictFor } from '../engine/scoring';
import { currentQuestion, type RoomState } from '../engine/state';
import { useCue } from '../lib/sound';
import { isNewRound, todayIso } from '../questions/newRounds';

interface ScoreboardProps {
  room: RoomState;
  /** The Slop Cannon's shots loaded into this round, named so the room knows (B2). */
  shots?: readonly Shot[];
  youUid: string | null;
  isQuizmaster: boolean;
  onNext: () => void;
  /** Office date, `YYYY-MM-DD`. Defaults to today in London. */
  today?: string;
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

export function Scoreboard({ room, shots = [], youUid, isQuizmaster, onNext, today = todayIso() }: ScoreboardProps) {
  const isLast = room.index + 1 >= room.questions.length;
  // The reducer sends a room of one straight to the results, so this does too.
  const toFinal = isLast && room.standoffEnabled && Object.keys(room.players).length >= 2;
  const skippedLast = room.skipped.includes(room.questions[room.index]?.id ?? '');
  const question = currentQuestion(room);
  // Next leaves the reveal. The late answer and the tally are still on the
  // room, so the amber line stays here for anyone whose answer missed the cut-off.
  const lost = verdictFor({
    answer: youUid ? room.answers[youUid] : undefined,
    correctIndex: question?.correctIndex ?? null,
    deltas: room.lastDeltas,
    uid: youUid,
    ...(question?.survey?.top ? { top: question.survey.top } : {}),
  }) === 'lost';
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
          {isNewRound(room.packId, today) ? <NewSticker /> : null}
        </div>
      )}

      <header>
        <p className="eyebrow">
          After {room.index + 1} of {room.questions.length}
        </p>
        <h2 className="display display--section">
          Standings
        </h2>
        {room.chaserEnabled ? <p className="chaser-line">{chaserTally(chaserScore(room.questions))} 🍟</p> : null}
        {shots.length > 0 ? (
          <p className="cannon-line">Slop Cannon: {shots.map((shot) => shot.title).join(', ')}</p>
        ) : null}
        <Commentary room={room} moment="scoreboard" speakHere={isQuizmaster} />
      </header>

      {skippedLast ? (
        <p className="notice">
          {room.questions[room.index]?.survey
            ? // G2a, G3: too few answered part one, or the chair changed hands
              // and the new host never saw it.
              'Not enough of the room’s answers to count on that one — no points awarded.'
            : 'That question was thrown out — no points awarded.'}
        </p>
      ) : null}

      {lost ? (
        <p className="nudge" role="status">
          {LOST_LINE}
        </p>
      ) : null}

      {/* Round two of The Double ranks the morning, with the round beside it. */}
      <Standings
        players={room.players}
        scores={morningTotals(room)}
        deltas={room.lastDeltas}
        youUid={youUid}
        {...(room.double ? { round: room.scores } : {})}
      />

      {/*
        Under the individual table rather than above it. The round is still
        somebody's game to win; the squads are the second story, and putting
        them first would say otherwise. Renders nothing at all below two squads.
      */}
      <SquadScore players={room.players} scores={morningTotals(room)} />

      {/*
        In the transport, as the question screen's controls are, so it stays on
        screen however long the table is. At thirty players it sat three
        screens down on a 1440×900 laptop, and this screen comes round after
        every question.
      */}
      {isQuizmaster ? (
        <div className="transport">
          <div className="btn-row">
            <button type="button" className="btn btn--primary" onClick={onNext}>
              {toFinal ? 'To Share or Shaft' : isLast ? 'Final results' : 'Next question'}
            </button>
          </div>
        </div>
      ) : (
        <p className="muted">Waiting for the quizmaster…</p>
      )}
    </>
  );
}
