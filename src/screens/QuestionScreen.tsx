import { ArcTimer } from '../components/ArcTimer';
import { PodiumTile, type TileState } from '../components/PodiumTile';
import { QUESTION_DURATION_MS, currentQuestion, type RoomState } from '../engine/state';
import type { QuestionClock } from '../lib/useQuestionClock';

interface QuestionScreenProps {
  room: RoomState;
  youUid: string | null;
  isQuizmaster: boolean;
  clock: QuestionClock;
  revealed: boolean;
  onAnswer: (optionIndex: number) => void;
  onReveal: () => void;
  onNext: () => void;
  onSkip: () => void;
}

/**
 * Serves both the answering and reveal phases. They share a layout on purpose:
 * the tiles stay put and only their lighting changes, so the verdict reads as
 * the same podiums lighting up rather than a new screen.
 */
export function QuestionScreen({
  room,
  youUid,
  isQuizmaster,
  clock,
  revealed,
  onAnswer,
  onReveal,
  onNext,
  onSkip,
}: QuestionScreenProps) {
  const question = currentQuestion(room);
  if (!question) return <p className="notice">This round has no question at that position.</p>;

  const myAnswer = youUid ? room.answers[youUid] : undefined;
  const answeredCount = Object.keys(room.answers).length;
  const playerCount = Object.keys(room.players).length;
  const myDelta = youUid ? (room.lastDeltas[youUid] ?? 0) : 0;

  const stateFor = (index: number): TileState => {
    if (revealed) {
      if (index === question.correctIndex) return 'correct';
      if (myAnswer?.optionIndex === index) return 'wrong';
      return 'dim';
    }
    if (!myAnswer) return 'idle';
    return myAnswer.optionIndex === index ? 'picked' : 'dim';
  };

  return (
    <>
      <header className="qhead">
        <div className="qhead__meta">
          <p className="display" style={{ fontSize: 'clamp(1.4rem, 5vw, 2.2rem)' }}>
            Question {room.index + 1}
            <span className="muted"> / {room.questions.length}</span>
          </p>
          <span className="chip">{question.category}</span>
          <span className="chip">{question.difficulty}</span>
        </div>
        {revealed ? null : (
          <ArcTimer
            secondsLeft={clock.secondsLeft}
            remainingMs={clock.remainingMs}
            totalMs={QUESTION_DURATION_MS}
          />
        )}
      </header>

      {/* Keyed on the question so the CSS entrance replays for each new one. */}
      <h1 key={question.id} className="prompt">
        {question.prompt}
      </h1>

      <div className="podium">
        {question.options.map((option, index) => (
          <PodiumTile
            key={`${question.id}-${index}`}
            index={index}
            text={option}
            state={stateFor(index)}
            disabled={revealed || Boolean(myAnswer)}
            onPick={onAnswer}
          />
        ))}
      </div>

      <div className="row row--between">
        <p className="tally">
          {revealed ? (
            myAnswer ? (
              myAnswer.optionIndex === question.correctIndex ? (
                <span style={{ color: 'var(--correct)' }}>Correct · +{myDelta}</span>
              ) : (
                <span style={{ color: 'var(--wrong)' }}>Not this time</span>
              )
            ) : (
              <span className="muted">You didn&rsquo;t answer</span>
            )
          ) : myAnswer ? (
            'Locked in'
          ) : clock.expired ? (
            'Time’s up'
          ) : (
            'Pick an answer'
          )}
        </p>

        {isQuizmaster ? (
          <div className="btn-row">
            <span className="tally">
              {answeredCount} / {playerCount} answered
            </span>
            <button type="button" className="btn btn--ghost" onClick={onSkip}>
              Skip
            </button>
            {revealed ? (
              <button type="button" className="btn btn--primary" onClick={onNext}>
                Standings
              </button>
            ) : (
              <button type="button" className="btn btn--primary" onClick={onReveal}>
                Reveal
              </button>
            )}
          </div>
        ) : null}
      </div>
    </>
  );
}
