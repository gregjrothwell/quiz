import { useEffect, useRef, useState } from 'react';
import { AnswerLamps } from '../components/AnswerLamps';
import { ArcTimer } from '../components/ArcTimer';
import { Ladder } from '../components/Ladder';
import { PodiumTile, type TileArrival, type TileState } from '../components/PodiumTile';
import { QuestionVote } from '../components/QuestionVote';
import { ScoreTicker } from '../components/ScoreTicker';
import { replayDurationMs, replayTimeline, type Arrival } from '../engine/replay';
import type { Verdict } from '../engine/questionVote';
import { verdictFor } from '../engine/scoring';
import { currentQuestion, questionDurationMs, type RoomState } from '../engine/state';
import { CLOCK_LEAD_SECONDS, startClock, stopClock, useCue } from '../lib/sound';
import type { QuestionClock } from '../lib/useQuestionClock';
import { useReducedMotion } from '../lib/useReducedMotion';

/**
 * The beat between the clock stopping and the verdict landing, when there is no
 * replay to fill it. Long enough to be a drum roll, short enough that fifteen of
 * them don't add two minutes to a round.
 */
const HUSH_MS = 700;

const CLOCK_LEAD_MS = CLOCK_LEAD_SECONDS * 1000;

/**
 * Shared so that "no replay" is the same array every render. A fresh `[]` would
 * change the scheduling effect's dependencies on every clock tick, tearing its
 * timers down and rebuilding them once a second for the whole question.
 */
const NO_ARRIVALS: Arrival[] = [];

interface QuestionScreenProps {
  room: RoomState;
  youUid: string | null;
  isQuizmaster: boolean;
  clock: QuestionClock;
  /**
   * Whether this device arrived after this question was already open, in which
   * case its clock is counting from the wrong zero — see App.tsx. The answer
   * still counts; it is ranked as though it landed on the buzzer.
   */
  joinedMidQuestion?: boolean;
  revealed: boolean;
  /**
   * Whether the reveal is already on its way, so the button says so instead of
   * offering itself again.
   *
   * The clock hitting zero used to leave a live-looking **Reveal** next to a
   * dead timer, which is an invitation to press it — and pressing it while the
   * automatic one is in flight does nothing except make the wait feel like a
   * fault. It is only ever true while an attempt is actually outstanding, so a
   * reveal that has genuinely failed still puts the button back.
   */
  revealing?: boolean;
  onAnswer: (optionIndex: number) => void;
  onReveal: () => void;
  onNext: () => void;
  /**
   * What this player thought of the question, asked once the answer is out.
   *
   * Required rather than optional, which is worth a line. It could only ever be
   * absent without a uid, and there is no uid without a room, and no room
   * without this screen having nothing to render — so the optional version
   * described a state that cannot happen while costing every caller a
   * conditional. It also keeps the design gallery honest: four fixtures render
   * this screen, and an optional prop is one they would all have quietly
   * omitted.
   */
  onVote: (verdict: Verdict) => void;
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
  joinedMidQuestion = false,
  revealed,
  revealing = false,
  onAnswer,
  onReveal,
  onNext,
  onVote,
}: QuestionScreenProps) {
  const question = currentQuestion(room);
  const optionCount = question?.options.length ?? 0;

  const myAnswer = youUid ? room.answers[youUid] : undefined;
  const myDelta = youUid ? (room.lastDeltas[youUid] ?? 0) : 0;

  /*
    Read off the reveal rather than worked out here, because "your answer was not
    in the room when it was scored" is not something a screen can infer from the
    answer alone — see `verdictFor`. It used to render as "Correct · +0".
  */
  const verdict = verdictFor({
    answer: myAnswer,
    correctIndex: question?.correctIndex ?? null,
    deltas: room.lastDeltas,
    uid: youUid,
  });
  const gotItRight = verdict === 'correct';
  const verdictLabel =
    verdict === 'correct'
      ? 'Correct'
      : verdict === 'wrong'
        ? 'Not this time'
        : verdict === 'lost'
          ? 'Your answer didn’t reach the room in time'
          : 'You didn’t answer';

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

  /**
   * The timeline is fixed the moment there is one, and not recomputed after.
   *
   * `useRoom` rebuilds `room.answers` from scratch on every snapshot of the
   * subcollection, so anything memoised on its identity is recomputed whenever
   * that listener fires — which reschedules the timers below from zero, sending
   * every chip back off the screen to land again and pushing the verdict late. A
   * player tapping right on the buzzer is enough to fire it.
   *
   * Frozen on the first render that has answers rather than on the first render
   * of the reveal, because a client that joined mid-question may still be
   * waiting on that listener when the question closes — freezing an empty
   * timeline would cost them the replay entirely.
   */
  const replayKey = `${room.gameId ?? ''}:${room.index}`;
  const [frozen, setFrozen] = useState<{ key: string; arrivals: Arrival[] }>({
    key: '',
    arrivals: [],
  });

  // Adjusted during render rather than in an effect: React re-renders before
  // committing, so no frame is ever painted from the stale timeline.
  if (revealed && frozen.key !== replayKey && Object.keys(room.answers).length > 0) {
    setFrozen({ key: replayKey, arrivals: replayTimeline(room.answers) });
  }

  const arrivals = revealed && frozen.key === replayKey ? frozen.arrivals : NO_ARRIVALS;
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

  useCue('gong', room.index, revealed);
  useCue(gotItRight ? 'correct' : 'wrong', room.index, revealed && settled);

  /**
   * The clock leans on you audibly as well as visually for the closing seconds.
   *
   * Started once per question and then left alone: the bed schedules itself all
   * the way to the buzzer, so re-firing it on a later render would stack a
   * second copy a fraction of a beat behind the first. The ref is what makes
   * that safe, since the effect re-runs every time the clock reading changes.
   */
  const { remainingMs } = clock;
  const clockKey = `${room.gameId ?? ''}:${room.index}`;
  const startedClockRef = useRef<string | null>(null);

  useEffect(() => {
    if (revealed || startedClockRef.current === clockKey) return;
    if (remainingMs <= 0 || remainingMs > CLOCK_LEAD_MS) return;
    startedClockRef.current = clockKey;
    startClock(remainingMs);
  }, [revealed, clockKey, remainingMs]);

  // Nothing else stops it. A reveal that arrives early, a question that ends
  // while this screen is being torn down, and StrictMode's remount in
  // development all land here — and clearing the ref on the way out is what
  // lets the effect above start a fresh bed rather than count itself done.
  useEffect(() => {
    if (revealed) stopClock();
    return () => {
      startedClockRef.current = null;
      stopClock();
    };
  }, [revealed]);

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
        {/*
          No arc for somebody who walked in on the question. Their clock started
          when they arrived, so it would count down a window the room does not
          have left and then be cut off by a reveal several seconds early —
          which reads as the round jumping rather than as arriving late.
        */}
        {revealed ? null : joinedMidQuestion ? (
          <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
            You joined mid-question, so this one is scored as if you answered on the buzzer.
          </p>
        ) : (
          <ArcTimer
            secondsLeft={clock.secondsLeft}
            remainingMs={clock.remainingMs}
            totalMs={questionDurationMs(room)}
          />
        )}
      </header>

      {/*
        Sealed only while the question is open.

        What this buys is narrow and worth stating exactly: it kills
        select → copy → paste into a search box or an LLM, which takes about
        four seconds and is the only cheat anybody in an office would actually
        try mid-question. It stops nothing else — view-source, DevTools, the
        network tab, a screenshot through OCR, or simply typing the question out
        all still work. Anyone willing to do those was already willing to
        harvest OpenTDB, which is the real ceiling and is documented as such in
        the handover.

        It lifts at the reveal rather than staying on, because by then the
        answer is on screen anyway and copying a good question to send to
        somebody afterwards is a thing people legitimately do. The cheat window
        is exactly the answering window, so that is exactly how long the lock
        lasts.

        `onCopy` as well as the CSS: `user-select: none` stops a mouse
        selection, and a keyboard select-all plus ⌘C would otherwise still put
        the prompt on the clipboard.
      */}
      <div
        className={revealed ? 'qgrid' : 'qgrid qgrid--sealed'}
        onCopy={revealed ? undefined : (event) => event.preventDefault()}
        onCut={revealed ? undefined : (event) => event.preventDefault()}
      >
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
      <div className="transport">
        {/*
          Above the controls rather than beside them, because this row wraps: a
          full office is ten names, and they need the width of the strip on a
          phone rather than whatever the button leaves over.
        */}
        {revealed ? (
          /*
            Keyed on the question, so a new one asks again rather than showing
            the last one's answer. Cheaper and clearer than lifting the choice
            into state the parent would then have to reset.
          */
          <QuestionVote key={room.index} onVote={onVote} />
        ) : (
          <AnswerLamps players={room.players} answers={room.answers} youUid={youUid} />
        )}

        <div className="row row--between">
          {/*
          Mounted for the whole reveal rather than swapped in when the verdict
          lands, so the delta has somewhere to count up from: ScoreTicker only
          animates on a change, and a ticker that mounts already holding its
          final number just prints it.
        */}
          <p className="tally">
            {revealed ? (
              <span className={settled ? 'verdict verdict--in' : 'verdict'} data-tone={verdict}>
                {verdictLabel}
                {gotItRight ? (
                  <>
                    {' · +'}
                    <ScoreTicker value={settled ? myDelta : 0} />
                  </>
                ) : null}
              </span>
            ) : clock.expired ? (
              // Before `myAnswer`, not after it. The lecterns disable on expiry
              // (see the grid below), so a player who had answered was being told
              // "You can still change it" next to four dead tiles — the app
              // contradicting itself at exactly the moment the room is waiting and
              // wondering whether something has broken.
              'Time’s up'
            ) : myAnswer ? (
              // Not "Locked in" any more, and worth saying rather than leaving to
              // be discovered: every other quiz app takes the first answer and
              // keeps it, so nobody will try a second lectern unless told they can.
              'You can still change it'
            ) : (
              'Pick an answer'
            )}
          </p>

          <div className="btn-row">
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
                    disabled={!clock.expired || revealing}
                    onClick={onReveal}
                  >
                    {!clock.expired
                      ? `Reveal in ${clock.secondsLeft}s`
                      : revealing
                        ? 'Revealing…'
                        : 'Reveal'}
                  </button>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
