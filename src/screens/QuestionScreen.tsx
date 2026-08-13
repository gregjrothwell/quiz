import { useEffect, useMemo, useState } from 'react';
import { ArcTimer } from '../components/ArcTimer';
import { Ladder } from '../components/Ladder';
import { PodiumTile, type TileArrival, type TileState } from '../components/PodiumTile';
import { ScoreTicker } from '../components/ScoreTicker';
import { replayDurationMs, replayTimeline } from '../engine/replay';
import { currentQuestion, questionDurationMs, type RoomState } from '../engine/state';
import { play, useCue } from '../lib/sound';
import type { QuestionClock } from '../lib/useQuestionClock';
import { useReducedMotion } from '../lib/useReducedMotion';

/**
 * The beat between the clock stopping and the verdict landing, when there is no
 * replay to fill it. Long enough to be a drum roll, short enough that fifteen of
 * them don't add two minutes to a round.
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
   * stops — the pause is the whole moment.
   *
   * The pause used to be blank. It is now the replay: every device already holds
   * who picked what and how long each of them took, so the reveal spends that
   * beat retelling the question instead of waiting out a drum roll. The verdict
   * lands when the last player has arrived.
   *
   * Both are held as *which question* rather than as booleans, so the state is
   * derived on the way out and nothing has to reset it when the next question
   * opens.
   */
  const reducedMotion = useReducedMotion();
  const arrivals = useMemo(() => replayTimeline(room.answers), [room.answers]);
  const heldMs = replayDurationMs(arrivals, HUSH_MS);

  const [settledIndex, setSettledIndex] = useState<number | null>(null);
  const [landed, setLanded] = useState<{ index: number; count: number }>({ index: -1, count: 0 });

  const settled = revealed && (reducedMotion || settledIndex === room.index);
  const shown = !revealed
    ? []
    : reducedMotion
      ? arrivals
      : landed.index === room.index
        ? arrivals.slice(0, landed.count)
        : [];

  useEffect(() => {
    // Nothing to schedule: the whole sequence is already at its end state.
    if (!revealed || reducedMotion) return;

    const timers = arrivals.map((arrival, position) =>
      window.setTimeout(
        () => setLanded({ index: room.index, count: position + 1 }),
        arrival.atMs,
      ),
    );
    const settle = window.setTimeout(() => setSettledIndex(room.index), heldMs);

    return () => {
      for (const timer of timers) window.clearTimeout(timer);
      window.clearTimeout(settle);
    };
  }, [revealed, reducedMotion, room.index, arrivals, heldMs]);

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
      // Gated on the clock rather than on having answered, so a key can change a
      // pick as well as make one — and so a late press cannot write past expiry.
      if (pick >= 0 && !revealed && !clock.expired && pick < optionCount) {
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
  }, [revealed, optionCount, isQuizmaster, clock.expired, onAnswer, onReveal, onNext]);

  // Placed after the hooks above: an early return before them would change the
  // hook order between renders.
  if (!question) return <p className="notice">This round has no question at that position.</p>;

  const stateFor = (index: number): TileState => {
    if (revealed) {
      if (!settled) {
        // Every lectern stays readable while the replay runs — watching the room
        // arrive on all four is the point, and a blacked-out tile is one nobody
        // can be seen landing on. Your own pick still carries its light, so you
        // can follow your own fortunes without hunting for your name.
        if (arrivals.length > 0) return myAnswer?.optionIndex === index ? 'picked' : 'idle';
        // Nothing to replay, so the beat is the drum roll it always was: the set
        // goes dark and your own pick is the only thing still lit.
        return myAnswer?.optionIndex === index ? 'picked' : 'hushed';
      }
      if (index === question.correctIndex) return 'correct';
      if (myAnswer?.optionIndex === index) return 'wrong';
      return 'gone';
    }
    if (!myAnswer) return 'idle';
    // Only the pick itself is marked. The others stay `idle` rather than `dim`
    // because they are still live — you can change your mind until the clock
    // stops, and dimming a tile you can still press reads as "unavailable".
    return myAnswer.optionIndex === index ? 'picked' : 'idle';
  };

  const crowdFor = (optionIndex: number): TileArrival[] =>
    shown
      .filter((arrival) => arrival.optionIndex === optionIndex)
      .map((arrival) => ({
        uid: arrival.uid,
        name: room.players[arrival.uid]?.name ?? 'Someone',
        elapsedMs: arrival.elapsedMs,
        isYou: arrival.uid === youUid,
      }));

  const tiles = question.options.map((option, index) => (
    <PodiumTile
      key={`${question.id}-${index}`}
      index={index}
      text={option}
      state={stateFor(index)}
      arrivals={crowdFor(index)}
      // The clock closes the lecterns, not the first press. Expiry matters on
      // its own now: it used to be covered incidentally, because having answered
      // disabled the tiles and everyone had answered or run out of time.
      disabled={revealed || clock.expired}
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
            // Not "Locked in" any more, and worth saying rather than leaving to
            // be discovered: every other quiz app takes the first answer and
            // keeps it, so nobody will try a second lectern unless told they can.
            'You can still change it'
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
