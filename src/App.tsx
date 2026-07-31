import { useCallback, useEffect, useState } from 'react';
import { Stage } from './components/Stage';
import { buildQuizQuestions } from './engine/state';
import { isFirebaseConfigured } from './firebase';
import { loadPackQuestions, usePackIndex } from './lib/usePacks';
import { useQuestionClock } from './lib/useQuestionClock';
import { useRoom } from './lib/useRoom';
import type { PackId } from './questions/types';
import { Final } from './screens/Final';
import { Landing } from './screens/Landing';
import { Lobby } from './screens/Lobby';
import { Preview } from './screens/Preview';
import { QuestionScreen } from './screens/QuestionScreen';
import { Scoreboard } from './screens/Scoreboard';

function SetupNotice() {
  return (
    <Stage>
      <header>
        <p className="eyebrow">Setup needed</p>
        <h1 className="wordmark">
          The
          <br />
          Round
        </h1>
        <hr className="wordmark__rule" />
      </header>
      <div className="panel stack">
        <p className="lede">
          No Firebase project is configured yet, so rooms cannot be created. Copy{' '}
          <code>.env.example</code> to <code>.env.local</code> and fill in the values from your
          Firebase console.
        </p>
        <p className="muted">
          You need Firestore, Realtime Database, and Anonymous Authentication enabled on the
          project.
        </p>
      </div>
    </Stage>
  );
}

export function App() {
  // A design gallery of every screen, so the look can be reviewed without a
  // Firebase project or four other people in a room.
  if (window.location.hash.startsWith('#/preview')) {
    return (
      <Stage>
        <Preview />
      </Stage>
    );
  }

  if (!isFirebaseConfigured) return <SetupNotice />;
  return <Game />;
}

function Game() {
  const {
    uid,
    room,
    connection,
    error,
    isQuizmaster,
    createAndJoin,
    join,
    leave,
    dispatch,
    submitAnswer,
  } = useRoom();
  const { packs, error: packsError } = usePackIndex();

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const phase = room?.phase ?? 'lobby';
  const clock = useQuestionClock(phase === 'question', room?.index ?? 0);

  const report = useCallback((cause: unknown) => {
    setActionError(cause instanceof Error ? cause.message : 'Something went wrong');
  }, []);

  const handleCreate = useCallback(
    (name: string) => {
      setBusy(true);
      setActionError(null);
      createAndJoin(name)
        .catch(report)
        .finally(() => setBusy(false));
    },
    [createAndJoin, report],
  );

  const handleJoin = useCallback(
    (code: string, name: string) => {
      setBusy(true);
      setActionError(null);
      join(code, name)
        .catch(report)
        .finally(() => setBusy(false));
    },
    [join, report],
  );

  const handleStart = useCallback(
    (packId: PackId, count: number) => {
      setBusy(true);
      setActionError(null);
      loadPackQuestions(packId)
        .then(async (pool) => {
          const pack = packs.find((entry) => entry.id === packId);
          await dispatch([
            {
              type: 'selectPack',
              packId,
              packTitle: pack?.title ?? packId,
              questions: buildQuizQuestions(pool, count),
            },
            { type: 'start', at: Date.now() },
          ]);
        })
        .catch(report)
        .finally(() => setBusy(false));
    },
    [dispatch, packs, report],
  );

  const handleAnswer = useCallback(
    (optionIndex: number) => {
      submitAnswer(optionIndex, clock.elapsedMs).catch(report);
    },
    [submitAnswer, clock.elapsedMs, report],
  );

  // The quizmaster's device closes the question when the clock runs out, so a
  // round keeps moving even if nobody remembers to press Reveal.
  useEffect(() => {
    if (!isQuizmaster || phase !== 'question' || !clock.expired) return;
    dispatch({ type: 'reveal' }).catch(report);
  }, [isQuizmaster, phase, clock.expired, dispatch, report]);

  if (connection === 'error') {
    return (
      <Stage>
        <p className="eyebrow">Cannot reach the server</p>
        <p className="notice">{error ?? 'Unknown connection error.'}</p>
        <p className="lede">
          The quiz needs to reach Firebase. If this is a work network, the domains{' '}
          <code>firestore.googleapis.com</code> and <code>*.firebasedatabase.app</code> must be
          allowed.
        </p>
      </Stage>
    );
  }

  const problem = actionError ?? packsError;

  if (!room) {
    return (
      <Stage>
        <Landing
          busy={busy || connection === 'connecting'}
          error={problem}
          onCreate={handleCreate}
          onJoin={handleJoin}
        />
      </Stage>
    );
  }

  return (
    <Stage>
      {problem ? <p className="notice">{problem}</p> : null}

      {(room.phase === 'lobby' && (
        <Lobby
          room={room}
          youUid={uid}
          isQuizmaster={isQuizmaster}
          packs={packs}
          busy={busy}
          onStart={handleStart}
          onLeave={() => void leave().catch(report)}
        />
      )) ||
        ((room.phase === 'question' || room.phase === 'reveal') && (
          <QuestionScreen
            room={room}
            youUid={uid}
            isQuizmaster={isQuizmaster}
            clock={clock}
            revealed={room.phase === 'reveal'}
            onAnswer={handleAnswer}
            onReveal={() => void dispatch({ type: 'reveal' }).catch(report)}
            onNext={() => void dispatch({ type: 'next', at: Date.now() }).catch(report)}
          />
        )) ||
        (room.phase === 'scoreboard' && (
          <Scoreboard
            room={room}
            youUid={uid}
            isQuizmaster={isQuizmaster}
            onNext={() => void dispatch({ type: 'next', at: Date.now() }).catch(report)}
          />
        )) ||
        (room.phase === 'finished' && (
          <Final
            room={room}
            youUid={uid}
            isQuizmaster={isQuizmaster}
            onPlayAgain={() => void dispatch({ type: 'reset' }).catch(report)}
            onLeave={() => void leave().catch(report)}
          />
        ))}
    </Stage>
  );
}
