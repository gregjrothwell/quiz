import { useEffect, useState } from 'react';
import { ArcTimer } from '../components/ArcTimer';
import { Ladder } from '../components/Ladder';
import { PodiumTile, type TileState } from '../components/PodiumTile';
import { ScoreTicker } from '../components/ScoreTicker';
import { currentQuestion, questionDurationMs, type RoomState } from '../engine/state';
import { play, useCue } from '../lib/sound';
import type { QuestionClock } from '../lib/useQuestionClock';

/**
 * The beat between the clock stopping and the verdict landing. Long enough to
 * be a drum roll, short enough that fifteen of them don't add two minutes to a
 * round.
 */
const HUSH_MS = 700;

/** The clock only becomes audible for the closing seconds. */
const TICKING_FROM_SECONDS = 5;

interface QuestionScreenProps {
  room: RoomState;
  youUid: string | null;
  isQuizmaster: boolean;
  clock: QuestionClock;
  revealed: boolean;
  onAnswer: (optionIndex: number) => void;
  onReveal: () => void;
  onNext: () => void;
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
}: QuestionScreenProps) {
  const question = currentQuestion(room);
  const optionCount = question?.options.length ?? 0;

  const myAnswer = youUid ? room.answers[youUid] : undefined;
  const answeredCount = Object.keys(room.answers).length;
  const playerCount = Object.keys(room.players).length;
  const myDelta = youUid ? (room.lastDeltas[youUid] ?? 0) : 0;
  const gotItRight = Boolean(myAnswer && myAnswer.optionIndex === question?.correctIndex);
  const verdictTone = gotItRight ? 'correct' : myAnswer ? 'wrong' : 'silent';
  const verdictLabel = gotItRight ? 'Correct' : myAnswer ? 'Not this time' : 'You didn’t answer';

  /**
   * The verdict is worth nothing if it arrives at the same instant the clock
   * stops — the pause is the whole moment. So for the first {@link HUSH_MS} of
   * a reveal every lectern but your own pick goes dark, and only then does the
   * answer land.
   *
   * Held as *which question has settled* rather than a boolean, so the state is
   * derived on the way out and nothing has to reset it when the next question
   * opens.
   */
  const [settledIndex, setSettledIndex] = useState<number | null>(null);
  const settled = revealed && settledIndex === room.index;

  useEffect(() => {
    if (!revealed) return;
    const timer = setTimeout(() => setSettledIndex(room.index), HUSH_MS);
    return () => clearTimeout(timer);
  }, [revealed, room.index]);

  useCue('hush', room.index, revealed);
  useCue(gotItRight ? 'correct' : 'wrong', room.index, revealed && settled);

  // The clock leans on you audibly as well as visually for the last few seconds.
  const { secondsLeft } = clock;
  useEffect(() => {
    if (revealed || secondsLeft <= 0 || secondsLeft > TICKING_FROM_SECONDS) return;
    play(secondsLeft % 2 === 0 ? 'tick' : 'tock');
  }, [revealed, secondsLeft]);

  // Desktop is the primary surface, so the whole round is playable from the
  // keyboard: A–D or 1–4 to answer, space to advance, S to skip.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();

      const letter = ['a', 'b', 'c', 'd'].indexOf(key);
      const digit = ['1', '2', '3', '4'].indexOf(key);
      const pick = letter >= 0 ? letter : digit;
      if (pick >= 0 && !revealed && !myAnswer && pick < optionCount) {
        event.preventDefault();
        onAnswer(pick);
        return;
      }

      if (!isQuizmaster) return;
      if (key === ' ' || key === 'enter') {
        event.preventDefault();
        if (revealed) onNext();
        // Matches the button: the vault will not open before the clock does.
        else if (clock.expired) onReveal();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [revealed, myAnswer, optionCount, isQuizmaster, clock.expired, onAnswer, onReveal, onNext]);

  // Placed after the hooks above: an early return before them would change the
  // hook order between renders.
  if (!question) return <p className="notice">This round has no question at that position.</p>;

  const stateFor = (index: number): TileState => {
    if (revealed) {
      // The drum roll: the set goes dark and your own pick is the only thing
      // still lit, so the green landing somewhere else is a visible defeat.
      if (!settled) return myAnswer?.optionIndex === index ? 'picked' : 'hushed';
      if (index === question.correctIndex) return 'correct';
      if (myAnswer?.optionIndex === index) return 'wrong';
      return 'gone';
    }
    if (!myAnswer) return 'idle';
    return myAnswer.optionIndex === index ? 'picked' : 'dim';
  };

  const tiles = question.options.map((option, index) => (
    <PodiumTile
      key={`${question.id}-${index}`}
      index={index}
      text={option}
      state={stateFor(index)}
      disabled={revealed || Boolean(myAnswer)}
      onPick={onAnswer}
      order={index}
    />
  ));

  return (
    <>
      <header className="qhead">
        <div className="qhead__meta">
          <p className="display" style={{ fontSize: 'clamp(1.3rem, 5vw, 1.9rem)' }}>
            Question {room.index + 1}
            <span className="muted"> / {room.questions.length}</span>
          </p>
        </div>
        <div className="qhead__tags">
          <span className="chip">{question.category}</span>
          <span className={question.difficulty === 'hard' ? 'chip chip--hard' : 'chip'}>
            {question.difficulty}
          </span>
        </div>
        {revealed ? null : (
          <ArcTimer
            secondsLeft={clock.secondsLeft}
            remainingMs={clock.remainingMs}
            totalMs={questionDurationMs(room)}
          />
        )}
      </header>

      <div className="qgrid">
        <div className="stack">
          {/* Keyed on the question so the CSS entrance replays for each new one. */}
          <h1 key={question.id} className="prompt">
            {question.prompt}
          </h1>

          {/*
            There was a gloss-floor reflection here — a flipped second copy of
            the podium. Removed rather than tuned: the only part of a tile worth
            reflecting is the letter chip and its label, which sit mid-tile, so
            any setting that showed them rendered legible upside-down text and
            read as a rendering fault. Clipping tighter to avoid that reflected
            nothing but flat panel edges, which read as a stray empty box. There
            is no value between the two that looks like a floor.
          */}
          <div className="podium">{tiles}</div>
        </div>

        <Ladder questions={room.questions} current={room.index} />
      </div>

      <p className="legend" aria-hidden="true">
        <span>
          <kbd>A</kbd>–<kbd>D</kbd> answer
        </span>
        {isQuizmaster ? (
          <span>
            <kbd>Space</kbd>
            {revealed ? 'standings' : 'reveal'}
          </span>
        ) : null}
      </p>

      {/*
        The desk. One strip carrying your own state, how much of the room has
        committed, and — for whoever is running it — the transport. Lit along
        its top edge like the rig bar above the stage, so the controls read as
        part of the set rather than as a form at the bottom of a page.
      */}
      <div className="transport row row--between">
        {/*
          Mounted for the whole reveal rather than swapped in when the verdict
          lands, so the delta has somewhere to count up from: ScoreTicker only
          animates on a change, and a ticker that mounts already holding its
          final number just prints it.
        */}
        <p className="tally">
          {revealed ? (
            <span className={settled ? 'verdict verdict--in' : 'verdict'} data-tone={verdictTone}>
              {verdictLabel}
              {gotItRight ? (
                <>
                  {' · +'}
                  <ScoreTicker value={settled ? myDelta : 0} />
                </>
              ) : null}
            </span>
          ) : myAnswer ? (
            'Locked in'
          ) : clock.expired ? (
            'Time’s up'
          ) : (
            'Pick an answer'
          )}
        </p>

        <div className="btn-row">
          {/*
            Anonymous on purpose. Watching the room commit is most of the
            tension in a live round, but which lectern anybody picked is the one
            thing that must not leak before the reveal.
          */}
          {revealed ? null : (
            <span className="pips" title={`${answeredCount} of ${playerCount} answered`}>
              <span className="sr-only">
                {answeredCount} of {playerCount} answered
              </span>
              {Array.from({ length: playerCount }, (_, pip) => (
                <span
                  key={pip}
                  className={pip < answeredCount ? 'pip pip--in' : 'pip'}
                  aria-hidden="true"
                />
              ))}
            </span>
          )}

          {isQuizmaster ? (
            <>
              {/*
                Nobody in the room needs telling who is driving, but the person
                driving does — it is the difference between waiting for the
                quizmaster and being the quizmaster.
              */}
              <span className="onair" aria-hidden="true">
                <span className="onair__lamp" />
                On air
              </span>

              {/*
                Skip is deliberately not exposed. The rules cannot restrict
                writes to the quizmaster without storing their uid, so a button
                here is a button anyone in DevTools can press — and one player
                who dislikes a question should not be able to void it for the
                room. The engine action stays (and stays tested) in case it is
                wanted behind a proper permission model later.
              */}
              {revealed ? (
                <button type="button" className="btn btn--primary" onClick={onNext}>
                  Standings
                </button>
              ) : (
                /*
                  Revealing early is no longer possible, and that is the price
                  of the vault: the rules refuse to confirm an answer until the
                  server agrees the room's answer window is up, and no
                  device — this one included — holds it before then. The button
                  stays visible as a retry for a reveal that errored, since the
                  clock running out fires one automatically.
                */
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={!clock.expired}
                  onClick={onReveal}
                >
                  {clock.expired ? 'Reveal' : `Reveal in ${clock.secondsLeft}s`}
                </button>
              )}
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
