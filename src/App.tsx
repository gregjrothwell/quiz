import { useCallback, useEffect, useRef, useState } from 'react';
import { ColdOpen } from './components/ColdOpen';
import { Stage } from './components/Stage';
import { honoursFor, sawWholeGame, NO_HONOURS } from './engine/awards';
import { formFor } from './engine/form';
import { standings } from './engine/scoring';
import { codeFromHash } from './engine/roomCode';
import {
  COLD_OPEN_MS,
  DEFAULT_QUESTION_DURATION_MS,
  buildQuizQuestions,
  currentQuestion,
  questionDurationMs,
  type Level,
} from './engine/state';
import { isFirebaseConfigured } from './firebase';
import { playerIdFor } from './lib/identity';
import { useGameLog } from './lib/useGameLog';
import { loadAsked, loadForm, recordAsked, recordGame } from './lib/season';
import { play } from './lib/sound';
import { loadPackQuestions, usePackIndex } from './lib/usePacks';
import { useQuestionClock } from './lib/useQuestionClock';
import { useRoom } from './lib/useRoom';
import { openTheVault } from './lib/vault';
import type { PackId } from './questions/types';
import { Final } from './screens/Final';
import { Landing } from './screens/Landing';
import { Lobby } from './screens/Lobby';
import { Preview } from './screens/Preview';
import { QuestionScreen } from './screens/QuestionScreen';
import { Scoreboard } from './screens/Scoreboard';
import { Season } from './screens/Season';

/**
 * How long to wait before asking the vault again, and how many times. The gate
 * it is waiting on is the server agreeing the answer window has passed, which
 * resolves in a second or two — so this is a short flurry rather than a poll.
 */
const REVEAL_RETRY_MS = 1_500;
const MAX_REVEAL_RETRIES = 8;

interface ActionError {
  message: string;
  /** The room state it was raised against; null on the landing screen. */
  step: string | null;
}

function SetupNotice() {
  return (
    <Stage>
      <header>
        <p className="eyebrow">Setup needed</p>
        <h1 className="wordmark">
          Vibe
          <br />
          Quiz
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

/**
 * Read once, at module scope. A join link is consumed on arrival: reading it
 * per render would refill the code box after somebody had cleared it, and the
 * hash is never rewritten while the app runs.
 */
const linkedCode = codeFromHash(window.location.hash);

function Game() {
  const {
    uid,
    room,
    connection,
    error,
    isQuizmaster,
    presenceWorking,
    createAndJoin,
    join,
    leave,
    dispatch,
    submitAnswer,
  } = useRoom();
  const { packs, error: packsError } = usePackIndex();

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<ActionError | null>(null);
  const [showSeason, setShowSeason] = useState(false);

  // Which game this device has already banked, so a re-render on the final
  // screen cannot bank it twice. The season document carries the same guard for
  // anything this ref cannot see, such as a reload.
  const bankedRef = useRef<string | null>(null);

  /**
   * The round the opening titles are introducing, held until they finish.
   *
   * A ref rather than state because nothing renders from it, and because the
   * effect that starts the round must read the value the quizmaster settled on
   * when they pressed Start — not one re-derived six seconds later from whatever
   * the lobby controls happen to say now.
   */
  const pendingStartRef = useRef<{ durationSecs: number; gameId: string } | null>(null);

  // Built as the game runs, because nothing else keeps a record of it — see
  // useGameLog. Held here rather than in Final so it survives that screen
  // mounting, which happens after the last question has already gone.
  const gameLog = useGameLog(room);

  const phase = room?.phase ?? 'lobby';
  const clock = useQuestionClock(
    phase === 'question',
    room?.index ?? 0,
    room ? questionDurationMs(room) : DEFAULT_QUESTION_DURATION_MS,
  );

  /**
   * Which state of the room an action was attempted against. A failure
   * describes the room as it was, so once the room moves past that point the
   * notice is describing something that is no longer true.
   *
   * The vault is why this matters. Its refusal is routine and self-correcting —
   * the rules will not open it until the server agrees the window has passed, so
   * a reveal fired on a client clock running a moment ahead is refused, and the
   * message says exactly that: give it a moment and try again. The retry lands
   * on the next room update. Before this, that one refusal left "the vault would
   * not confirm an answer" pinned above every screen for the rest of the game,
   * including over the questions it then revealed perfectly well.
   *
   * Derived rather than cleared in an effect, so there is no window where the
   * room has moved on and the stale notice is still painted.
   */
  const roomStep = room ? `${room.gameId ?? ''}:${room.index}:${room.phase}` : null;

  const report = useCallback(
    (cause: unknown) => {
      setActionError({
        message: cause instanceof Error ? cause.message : 'Something went wrong',
        step: roomStep,
      });
    },
    [roomStep],
  );

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
    (packId: PackId, count: number, level: Level, durationSecs: number) => {
      setBusy(true);
      setActionError(null);
      loadPackQuestions(packId)
        .then(async (pool) => {
          const pack = packs.find((entry) => entry.id === packId);
          // A history this round cannot read is a round that repeats a
          // question, which is a far smaller problem than a round that will not
          // start — so this failure is swallowed rather than reported.
          const asked = await loadAsked(packId).catch(() => new Set<string>());
          const questions = buildQuizQuestions(pool, count, level, Math.random, asked);

          /*
            The opening titles, and the reason the round does not simply start
            here. The digest is assembled once, by this device, and written into
            the room while it is still in the lobby — every other client reads it
            from the update it was already listening to, which is the reveal's
            pattern. Six reads for the room rather than fifty per person.

            Swallowed on failure, like the question history above: a round that
            opens without its titles is a much smaller problem than a round that
            will not open.
          */
          const roster = Object.entries(room?.players ?? {}).map(([uid, player]) => ({
            uid,
            playerId: player.playerId ?? uid,
          }));
          const facts = await loadForm(roster).then(formFor).catch(() => []);

          /*
            The round itself is started by the effect below rather than after a
            sleep here, and the difference is not stylistic. `dispatch` closes
            over `room`, so anything awaited between taking that closure and
            writing folds the round over a snapshot that is however many seconds
            old — the same staleness that once let a pack fetch erase everyone
            who joined while it ran. Six seconds of titles is a far wider window
            than that fetch ever was.
          */
          pendingStartRef.current = { durationSecs, gameId: crypto.randomUUID() };

          await dispatch([
            {
              type: 'selectPack',
              packId,
              packTitle: pack?.title ?? packId,
              questions,
            },
            ...(facts.length > 0
              ? [{ type: 'titles' as const, at: Date.now(), facts }]
              : [{ type: 'start' as const, at: Date.now(), ...pendingStartRef.current }]),
          ]);

          if (facts.length === 0) pendingStartRef.current = null;

          // After the round is safely under way, for the same reason.
          await recordAsked(packId, questions.map((question) => question.id)).catch(
            () => undefined,
          );
        })
        .catch(report)
        .finally(() => setBusy(false));
    },
    [dispatch, packs, report, room?.players],
  );

  const handleAnswer = useCallback(
    (optionIndex: number) => {
      // Cued on the tap rather than on the write landing: the point of the
      // sound is to confirm the press, and a round-trip to Firestore is long
      // enough for the delay to read as a missed input.
      play('lock');
      submitAnswer(optionIndex, clock.elapsedMs).catch(report);
    },
    [submitAnswer, clock.elapsedMs, report],
  );

  /**
   * Which question this device is already revealing, so the expiry effect and
   * the button cannot both fire the same reveal. Cleared on failure, because a
   * reveal that errored is exactly the one worth pressing again.
   */
  const revealingRef = useRef<string | null>(null);

  const handleReveal = useCallback(async (): Promise<void> => {
    if (!room || room.phase !== 'question') return;

    const question = currentQuestion(room);
    if (!question) return;

    const key = `${room.gameId ?? ''}:${room.index}`;
    if (revealingRef.current === key) return;
    revealingRef.current = key;

    try {
      // The answer is not in the room, the pack or this bundle. It comes back
      // from the vault, and only once the server agrees the clock has run out.
      const correctIndex = await openTheVault(room.code, question);
      await dispatch({ type: 'reveal', correctIndex });
    } catch (cause) {
      // Rethrown rather than reported here so the caller owns the error, which
      // keeps this callback free of state updates and the expiry effect below
      // free of a synchronous setState.
      revealingRef.current = null;
      throw cause;
    }
  }, [room, dispatch]);

  /*
    The titles come down on a timer as well as on the round starting, so a room
    whose quizmaster closed their laptop mid-sequence returns to a working lobby
    on its own rather than sitting on a card nobody can clear. Every device runs
    this, not just the one that put them up.
  */
  const formAt = room?.form?.at ?? null;
  const [titlesExpired, setTitlesExpired] = useState(false);
  const [titlesKey, setTitlesKey] = useState(formAt);

  // Adjusted during render so a fresh set of titles is not born expired,
  // the same pattern as the reveal retry counter below.
  if (titlesKey !== formAt) {
    setTitlesKey(formAt);
    setTitlesExpired(false);
  }

  useEffect(() => {
    if (formAt === null) return;

    // Always through a timeout, never set directly here — `react-hooks/
    // set-state-in-effect` exists to catch exactly that, and a zero delay
    // lands on the next tick which is all this needs.
    const remaining = Math.max(0, formAt + COLD_OPEN_MS - Date.now());
    const timer = window.setTimeout(() => setTitlesExpired(true), remaining);
    return () => window.clearTimeout(timer);
  }, [formAt]);

  // No clock reading in render — `Date.now()` is impure and React is right to
  // refuse it. Joining a room whose titles are already half over therefore shows
  // the card for the single frame before the zero-delay timeout above lands,
  // which is the cheapest possible price for keeping render pure.
  const showTitles = room?.phase === 'lobby' && room.form !== null && !titlesExpired;

  /*
    The round starts when the opening titles have run.

    Here rather than after an `await sleep(...)` inside `handleStart`, because
    `dispatch` closes over `room` and six seconds is long enough for that
    snapshot to be badly out of date — it is the same trap that once let a pack
    fetch erase everybody who joined while it was running. This effect re-reads
    the room on every update, so the round is folded over what is actually there.

    Only the device that put the titles up finishes the job, which `pendingStartRef`
    settles: it is set by whoever pressed Start and is null everywhere else. If
    that device disappears mid-sequence nobody starts the round, the card times
    out on its own, and the room falls back to a working lobby for whoever
    inherits the quizmaster's chair.
  */
  useEffect(() => {
    if (!room || room.phase !== 'lobby' || !room.form) return;

    const pending = pendingStartRef.current;
    if (!pending) return;

    const remaining = room.form.at + COLD_OPEN_MS - Date.now();
    const timer = window.setTimeout(() => {
      pendingStartRef.current = null;
      void dispatch({ type: 'start', at: Date.now(), ...pending }).catch(report);
    }, Math.max(0, remaining));

    return () => window.clearTimeout(timer);
  }, [room, dispatch, report]);

  // The quizmaster's device closes the question when the clock runs out, so a
  // round keeps moving even if nobody remembers to press Reveal.
  //
  // A refused reveal used to stall the round outright. The vault turns one down
  // until the server agrees the answer window has passed, which is routine and
  // self-correcting — but nothing here retried it. This effect only re-fires
  // when `handleReveal` changes identity, and that needs a room update; in a
  // room where everybody has already answered, nothing is writing, so nothing
  // ever arrived to trigger it. Seen live on 13 August 2026: question one sat on
  // "the vault would not confirm an answer" for minutes until Reveal was pressed
  // by hand.
  //
  // Capped rather than open-ended. A vault that genuinely lacks the answer would
  // otherwise be asked forever, and every attempt is a write against a read
  // budget this game has already exhausted once. After the cap the quizmaster's
  // own Reveal button is still there, which is how it was rescued before.
  const revealKey = `${room?.gameId ?? ''}:${room?.index ?? -1}`;
  const [retry, setRetry] = useState({ key: revealKey, n: 0 });

  // Adjusted during render so a new question starts with its full allowance
  // rather than inheriting the last one's exhausted count.
  if (retry.key !== revealKey) setRetry({ key: revealKey, n: 0 });

  useEffect(() => {
    if (!isQuizmaster || phase !== 'question' || !clock.expired) return;

    let timer = 0;
    void handleReveal().catch((cause: unknown) => {
      report(cause);
      if (retry.n >= MAX_REVEAL_RETRIES) return;
      timer = window.setTimeout(
        () => setRetry((current) => ({ ...current, n: current.n + 1 })),
        REVEAL_RETRY_MS,
      );
    });

    return () => window.clearTimeout(timer);
  }, [isQuizmaster, phase, clock.expired, handleReveal, report, retry.n]);

  // Each device banks its own season row. Doing it per-client rather than having
  // the quizmaster write everybody's is what lets the rules restrict the write
  // to its owner — the room's own scores cannot be protected that way.
  useEffect(() => {
    if (!room || !uid || room.phase !== 'finished') return;

    const { gameId } = room;
    if (!gameId || bankedRef.current === gameId) return;

    const player = room.players[uid];
    if (!player) return;

    bankedRef.current = gameId;

    const rows = standings(room.scores).filter((entry) => room.players[entry.uid]);
    const leadScore = rows[0]?.score ?? 0;
    const mine = rows.find((entry) => entry.uid === uid);

    recordGame({
      playerId: playerIdFor(uid),
      name: player.name,
      gameId,
      score: room.scores[uid] ?? 0,
      // A round where nobody scored is not a win for everybody.
      won: leadScore > 0 && mine?.position === 1,
      // Only from a log covering the whole game. A device that joined late or
      // reloaded before the log was kept would otherwise bank a shelf it cannot
      // stand behind — and unlike a screen that says nothing, that is permanent.
      honours: sawWholeGame(gameLog, room.questions.length)
        ? honoursFor(gameLog, Object.keys(room.players), uid)
        : NO_HONOURS,
    }).catch(report);
  }, [room, uid, gameLog, report]);

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

  const problem = (actionError?.step === roomStep ? actionError.message : null) ?? packsError;

  if (showSeason) {
    return (
      <Stage>
        <Season youUid={uid} onBack={() => setShowSeason(false)} />
      </Stage>
    );
  }

  if (!room) {
    return (
      <Stage>
        <Landing
          busy={busy || connection === 'connecting'}
          error={problem}
          initialCode={linkedCode ?? ''}
          onCreate={handleCreate}
          onJoin={handleJoin}
          onSeason={() => setShowSeason(true)}
        />
      </Stage>
    );
  }

  return (
    <Stage>
      {problem ? <p className="notice">{problem}</p> : null}

      {/*
        Presence is a tidying mechanism, not part of the game. Saying so plainly
        beats the previous behaviour, where a failed presence write was a console
        warning nobody would see and the room quietly filled with ghosts.
      */}
      {presenceWorking ? null : (
        <p className="muted" style={{ fontSize: '0.85rem', margin: 0 }}>
          Can&rsquo;t track who&rsquo;s still here, so anyone who closes their tab will stay in the
          list. The round plays normally.
        </p>
      )}

      {(showTitles && room.form && (
        <ColdOpen facts={room.form.facts} players={room.players} />
      )) ||
        (room.phase === 'lobby' && (
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
            onReveal={() => void handleReveal().catch(report)}
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
            log={gameLog}
            onPlayAgain={() => void dispatch({ type: 'reset' }).catch(report)}
            onLeave={() => void leave().catch(report)}
            onSeason={() => setShowSeason(true)}
          />
        )) || (
          /*
            A phase this build does not recognise. The rules now reject one, but
            without this the chain above falls through to `false` and the whole
            room stares at an empty screen with no way out — which is what any
            member writing a junk phase from the console used to cause, and what a
            client left open across a deploy that adds a phase would hit anyway.
          */
          <div className="stack">
            <p className="eyebrow">Out of step</p>
            <p className="lede">
              This room is in a state this version of the quiz doesn&rsquo;t know how to show.
              Reload to pick up the latest version, or leave and rejoin.
            </p>
            <div className="btn-row">
              <button type="button" className="btn" onClick={() => window.location.reload()}>
                Reload
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => void leave().catch(report)}
              >
                Leave
              </button>
            </div>
          </div>
        )}
    </Stage>
  );
}
