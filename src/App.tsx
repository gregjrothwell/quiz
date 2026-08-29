import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { ColdOpen } from './components/ColdOpen';
import { Stage } from './components/Stage';
import { arrivalFor, walkedIn, NO_ARRIVAL, type Arrival } from './engine/arrival';
import { shouldAutoJoin } from './engine/autoJoin';
import type { Verdict } from './engine/questionVote';
import { honoursFor, sawWholeGame, NO_HONOURS } from './engine/awards';
import { formFor } from './engine/form';
import { msUntilRevealGate, revealBackoffMs } from './engine/revealGate';
import { roomStandings } from './engine/scoring';
import { codeFromHash } from './engine/roomCode';
import {
  DEFAULT_QUESTION_DURATION_MS,
  buildQuizQuestions,
  currentQuestion,
  questionDurationMs,
  type Level,
} from './engine/state';
import { firestore, isFirebaseConfigured } from './firebase';
import { playerIdFor } from './lib/identity';
import { recordVote } from './lib/questionVotes';
import { rememberedName } from './lib/rememberedName';
import {
  rememberPlayingWith,
  rememberSquad,
  rememberedPlayingWith,
  rememberedSquad,
} from './lib/rememberedSquad';
import { useFinalSnapshot } from './lib/useFinalSnapshot';
import { useGameLog } from './lib/useGameLog';
import { loadAsked, loadForm, recordAsked, recordGame, type Banked } from './lib/season';
import { play } from './lib/sound';
import { loadPackQuestions, usePackIndex } from './lib/usePacks';
import { useQuestionClock } from './lib/useQuestionClock';
import { useRoom } from './lib/useRoom';
import { resolveAnswer } from './lib/vault';
import type { PackId } from './questions/types';
import { Final } from './screens/Final';
import { Landing } from './screens/Landing';
import { Lobby } from './screens/Lobby';
import { QuestionScreen } from './screens/QuestionScreen';
import { Scoreboard } from './screens/Scoreboard';

/*
  Split out of the main bundle, because neither is on the path into a game.

  `Preview` is the design gallery and its fixtures — the largest screen in the
  repo, reachable only from `#/preview`. `Season` is behind a button press.
  Every player was downloading both to play a round that touches neither.

  Named exports, so the dynamic import is mapped to a default for `lazy`.
*/
const Preview = lazy(() => import('./screens/Preview').then((m) => ({ default: m.Preview })));
const Season = lazy(() => import('./screens/Season').then((m) => ({ default: m.Season })));

/**
 * What shows while one of those chunks is in flight.
 *
 * Deliberately a word rather than a spinner: on a warm cache it is one frame,
 * and a spinner that flashes for 16ms reads as a glitch. It says which thing is
 * coming so a slow network looks like waiting rather than like nothing.
 */
function Loading({ what }: { what: string }) {
  return <p className="muted">Loading {what}…</p>;
}

/**
 * How many times to ask the vault before leaving it to the quizmaster's button.
 *
 * The wait between attempts is no longer flat — see `revealBackoffMs`. It was
 * 1500ms, chosen when a refusal was thought to mean the server disagreed by a
 * second or so. Measured on the live project on 20 August 2026 it disagrees by
 * one network hop, so the first retry is now 300ms and the cap is unchanged: the
 * same number of writes against the same read budget, recovering five times
 * faster in the case that actually happens.
 */
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
        <Suspense fallback={<Loading what="the gallery" />}>
          <Preview />
        </Suspense>
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

/**
 * Whether this page load has already acted on that link.
 *
 * Module scope for the same reason `linkedCode` is: the hash is never rewritten
 * while the app runs, so a link is consumed once and the fact has to outlive
 * every render and every trip back to the landing screen. Component state would
 * be reset by the unmount that leaving a room causes, and the link would fire
 * again the instant somebody pressed Leave.
 *
 * Set *before* the join is attempted rather than after it lands, which is what
 * stops a failure retrying for ever: a room that has gone, or a code that no
 * longer exists, is a thing to be told about once.
 */
let linkConsumed = false;

/**
 * Which room the link actually put this device into, if it put it into one.
 *
 * Held rather than a bare boolean so that leaving and rejoining by hand is not
 * still described as having arrived on a link, and read during render rather
 * than mirrored into state — an effect that calls `setState` is the pattern
 * this file avoids everywhere else, and the flag is only ever changed on paths
 * that re-render anyway: the join sets `busy`, and leaving clears the room.
 */
let autoJoinedCode: string | null = null;

function Game() {
  const {
    uid,
    room,
    code,
    connection,
    error,
    isQuizmaster,
    presenceWorking,
    questionConfirmedAt,
    questionOriginAt,
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


  // What this device banked, and where. Held rather than re-derived so the week
  // board reads the bucket the write actually landed in — a game banked at one
  // minute to midnight on a Sunday belongs to the week that has just ended, not
  // to the one starting while the podium is still on screen.
  const [banked, setBanked] = useState<(Banked & { gameId: string }) | null>(null);

  // Which game this device has already banked, or is in the middle of banking,
  // so a re-render on the final screen cannot bank it twice. The season document
  // carries the same guard for anything this ref cannot see, such as a reload.
  //
  // Cleared again if the write fails, because otherwise a single flaky moment on
  // the final screen loses the game permanently: the ref would say it had been
  // banked, and nothing would ever look again. Retrying is safe by construction
  // — `recordGame` compares `lastGame` inside its transaction, so a retry that
  // races a write which actually landed is a no-op rather than a double count.
  const bankedRef = useRef<string | null>(null);


  // Built as the game runs, because nothing else keeps a record of it — see
  // useGameLog. Held here rather than in Final so it survives that screen
  // mounting, which happens after the last question has already gone.
  const gameLog = useGameLog(room);

  // The room as it stood at the whistle. Held here rather than in Final for the
  // same reason the log is — and because the season write below has to bank
  // against the same frozen table the screen is showing, or a winner going home
  // before your device banks promotes you into a win you did not take.
  const finalSnapshot = useFinalSnapshot(room);

  /**
   * Whether this device is in the room because a link put it there, rather than
   * because somebody typed their name and pressed a button.
   *
   * Only the lobby cares. Somebody who came straight in never saw the "change
   * it if you aren't Greg" line the landing screen shows, and the borrowed
   * laptop is exactly what that line is for.
   */
  const autoJoined = room !== null && room.code === autoJoinedCode;

  const phase = room?.phase ?? 'lobby';
  const durationMs = room ? questionDurationMs(room) : DEFAULT_QUESTION_DURATION_MS;
  const clock = useQuestionClock(
    phase === 'question',
    room?.index ?? 0,
    durationMs,
    // The room's clock where this device has been able to measure itself
    // against the server, and its own where it has not.
    questionOriginAt,
  );

  /**
   * The question this device walked in on, if it walked in on one.
   *
   * `useQuestionClock` counts from the moment *this* device saw a question open,
   * which is deliberate — see the note there about office laptops disagreeing
   * about the time by more than the speed bonus is worth. It holds for anybody
   * who was in the room when the question opened, because their clock can only
   * start a little late. It is false for somebody who joins halfway through: they
   * get a full fresh window on a question that is already nine seconds old, and
   * an answer typed on the buzzer is stamped as though it were instant.
   *
   * The rules for it are in `engine/arrival.ts`, where they can be tested against
   * a whole round rather than only watched in a live room.
   *
   * Adjusted during render, like the retry counter below: React re-renders before
   * committing, so no frame is painted from the previous room's arrival.
   */
  const [arrival, setArrival] = useState<Arrival>(NO_ARRIVAL);

  const seen = arrivalFor(arrival, room);
  if (seen !== arrival) setArrival(seen);

  const joinedMidQuestion = walkedIn(seen, room);

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
    (name: string, squad: string, playingWith: string) => {
      setBusy(true);
      setActionError(null);
      rememberSquad(squad);
      rememberPlayingWith(playingWith);
      createAndJoin(name)
        .catch(report)
        .finally(() => setBusy(false));
    },
    [createAndJoin, report],
  );

  const handleJoin = useCallback(
    (code: string, name: string, squad: string, playingWith: string) => {
      setBusy(true);
      setActionError(null);
      rememberSquad(squad);
      rememberPlayingWith(playingWith);
      join(code, name)
        .catch(report)
        .finally(() => setBusy(false));
    },
    [join, report],
  );

  /**
   * A link that carries a code, on a browser that already knows its own name,
   * goes straight into the room.
   *
   * Nothing here is new capability — it skips a press on the landing screen and
   * nothing else. Every reason not to is in `shouldAutoJoin`, where each one is
   * a test, and all of them fall back to that same screen with the code already
   * filled in.
   *
   * The squad and the side are read here rather than passed through, because
   * they are only ever *consumed* at the end of the game: `recordGame` reads
   * them when the final screen banks. So a player who fixes either one in the
   * meantime banks the corrected value, which is why the lobby can offer a way
   * out without this needing to know about it.
   */
  useEffect(() => {
    /*
      Named `target`, not `code`. It was `code` first, which silently shadowed
      the room code destructured from `useRoom` above — so `inRoom` below read
      the *link's* code, was never null, and auto-join could not fire at all.
      Caught in the browser, not by lint or by types: both names were strings.
    */
    const target = linkedCode;
    if (target === null) return;

    const name = rememberedName();
    const squad = rememberedSquad();
    const playingWith = rememberedPlayingWith();

    const go = shouldAutoJoin({
      linkedCode: target,
      name,
      squad,
      playingWith,
      uid,
      connected: connection === 'ready',
      consumed: linkConsumed,
      /*
        `code` as well as `room`, and not belt-and-braces. A reload restores the
        code on the first render and the room only when its snapshot lands, so
        for a beat this tab is in a room that `room` still reports as null — and
        the hash is never rewritten, so a link from an earlier visit is still
        sitting in it. On `room` alone that beat is long enough to fire a join at
        an entirely different room.
      */
      inRoom: room !== null || code !== null,
    });
    if (!go) return;

    linkConsumed = true;
    autoJoinedCode = target;

    /*
      `join` rather than `handleJoin`, and the difference is not cosmetic.
      `handleJoin` sets `busy` and clears the error synchronously, which is a
      `setState` inside an effect — the thing this file avoids everywhere, and
      the reveal effect's own note explains why. Neither is wanted here anyway:
      `busy` exists to disable a button, and there is no button in this path.

      The failure is put back on the landing screen, which is where the room
      code already is. `autoJoinedCode` is cleared with it, so the lobby cannot
      later claim a link brought somebody in when it did not — and
      `linkConsumed` deliberately is *not* cleared, because a code for a room
      that has gone will fail exactly the same way every time.
    */
    join(target, name).catch((cause: unknown) => {
      autoJoinedCode = null;
      report(cause);
    });
  }, [uid, connection, room, code, join, report]);

  /**
   * Leaving clears the auto-joined flag as well as the room.
   *
   * Without it, a player who used "not you?" and then joined again by hand
   * would be told a second time that a link had put them there.
   */
  const handleLeave = useCallback(() => {
    autoJoinedCode = null;
    void leave().catch(report);
  }, [leave, report]);

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
            The titles go up and the round waits there. Starting it is a second,
            deliberate press — see `handleBeginRound`.

            The window is parked inside the digest rather than kept on this
            device, so the round can still open on the window that was chosen if
            the quizmaster's chair changes hands while the titles are up. It
            cannot go on the room's own `durationSecs`, which the rules pin until
            a question actually opens.

            A room the season knows nothing about has no titles to show, and gets
            the round it asked for on the one press it made.
          */
          await dispatch([
            {
              type: 'selectPack',
              packId,
              packTitle: pack?.title ?? packId,
              questions,
            },
            ...(facts.length > 0
              ? [{ type: 'titles' as const, at: Date.now(), facts, durationSecs }]
              : [
                  {
                    type: 'start' as const,
                    at: Date.now(),
                    gameId: crypto.randomUUID(),
                    durationSecs,
                  },
                ]),
          ]);

          // After the round is safely under way, for the same reason.
          await recordAsked(
            packId,
            questions.map((question) => question.id),
            asked,
          ).catch(() => undefined);
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
      // Somebody who walked in on this question is timed from the end of the
      // window rather than from their own arrival: they still score the answer,
      // they are just ranked from a clock that says nothing about how fast they
      // were. The alternative was letting a mid-question join take first place
      // for an answer given on the buzzer.
      //
      // Under rank scoring this is a softer penalty than it was — the full window
      // sorts them last among the correct answers rather than stripping the
      // bonus outright, so in a room where two people got it right they are
      // second rather than on the base alone. Making it exact would need the
      // answer document to say "I walked in", which is a new field and a rules
      // paste for a case worth 100 points. See docs/decisions/scoring.md.
      submitAnswer(optionIndex, joinedMidQuestion ? durationMs : clock.elapsedMs).catch(report);
    },
    [submitAnswer, clock.elapsedMs, joinedMidQuestion, durationMs, report],
  );

  /**
   * What this player thought of the question just revealed.
   *
   * Written straight out and never read back. There is no tally on any screen,
   * which is what keeps this free: the collection is global rather than in the
   * room, so it adds no listener and no reads at all — one write per player per
   * question, ninety a game against twenty thousand a day. The argument in full
   * is in `src/lib/questionVotes.ts`.
   *
   * Failures are swallowed inside `recordVote`. A verdict is a nicety collected
   * during the reveal and must never put an error over the top of the round.
   */
  const handleVote = useCallback(
    (verdict: Verdict) => {
      if (!uid) return;
      const question = room ? currentQuestion(room) : null;
      if (!question) return;

      void recordVote(firestore(), question.id, uid, verdict);
    },
    [uid, room],
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
      const correctIndex = await resolveAnswer(firestore(), room.code, question);
      // Named rather than assumed: `dispatch` folds over the room as it is when
      // this returns, so that an answer landing during the round trip still
      // counts — and the reducer refuses to score this answer against anything
      // but the question it was asked about.
      await dispatch({ type: 'reveal', correctIndex, questionId: question.id });
    } catch (cause) {
      // Rethrown rather than reported here so the caller owns the error, which
      // keeps this callback free of state updates and the expiry effect below
      // free of a synchronous setState.
      revealingRef.current = null;
      throw cause;
    }
  }, [room, dispatch]);

  const form = room?.form ?? null;
  const showTitles = room?.phase === 'lobby' && form !== null;

  /**
   * Starts the round the titles are introducing.
   *
   * Nothing does this on a timer, and that is the whole point of it being here.
   * The titles used to run for six seconds and start the round themselves, which
   * meant pressing Start handed the beginning of the quiz to a `setTimeout` —
   * and the beginning is the one moment a quizmaster actually wants to hold,
   * while the room reads the card and somebody finds their drink.
   *
   * The room cannot get stuck behind a quizmaster who wandered off, because the
   * role is derived from who has been present longest: if they go, somebody else
   * inherits this button within a second.
   */
  const handleBeginRound = useCallback(() => {
    if (!form) return;
    setActionError(null);
    void dispatch({
      type: 'start',
      at: Date.now(),
      gameId: crypto.randomUUID(),
      durationSecs: form.durationSecs,
    }).catch(report);
  }, [form, dispatch, report]);

  const handleCancelTitles = useCallback(() => {
    setActionError(null);
    void dispatch({ type: 'clearTitles' }).catch(report);
  }, [dispatch, report]);


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
  // **`clock.expired` is not enough on its own, and this is the device where
  // that bites.** The quizmaster wrote the question open, so latency
  // compensation gave them a local snapshot of it a round trip before the server
  // stamped `openedAt` — their countdown expires marginally before the vault
  // will answer, and the two writes' latencies then cancel, leaving a margin of
  // single-digit milliseconds decided by jitter. Measured at about 7ms on 20
  // August 2026 (`npm run reveal-probe`), with 100ms early refused. So the gate
  // is asked separately, from a moment that is provably after the server's:
  // `revealGate.ts` has the argument.
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

    const gate = { confirmedAt: questionConfirmedAt, durationMs, now: Date.now() };
    const wait = msUntilRevealGate(gate);

    // Nothing to count from yet: the server has not acknowledged the question.
    // The effect re-runs when it does, because `questionConfirmedAt` changes.
    if (wait === null) return;

    let timer = 0;
    if (wait > 0) {
      // Woken rather than polled. Between the local clock expiring and the gate
      // opening there is nothing else to re-run this effect — in a room where
      // everybody has already answered, nothing is writing at all.
      // A fresh object, not the same one: `retry` is in the dependency list
      // below precisely so this wakes the effect. React re-renders on any
      // `setState`, but it only re-runs an effect whose dependencies changed —
      // so mutating nothing and returning `current` would schedule a timer that
      // fired into silence.
      timer = window.setTimeout(() => setRetry((current) => ({ ...current })), wait);
      return () => window.clearTimeout(timer);
    }

    void handleReveal().catch((cause: unknown) => {
      report(cause);
      if (retry.n >= MAX_REVEAL_RETRIES) return;
      timer = window.setTimeout(
        () => setRetry((current) => ({ ...current, n: current.n + 1 })),
        revealBackoffMs(retry.n),
      );
    });

    return () => window.clearTimeout(timer);
  }, [
    isQuizmaster,
    phase,
    clock.expired,
    questionConfirmedAt,
    durationMs,
    handleReveal,
    report,
    retry,
  ]);

  // Each device banks its own season row. Doing it per-client rather than having
  // the quizmaster write everybody's is what lets the rules restrict the write
  // to its owner — the room's own scores cannot be protected that way.
  useEffect(() => {
    if (!room || !uid || room.phase !== 'finished') return;

    const { gameId } = room;
    if (!gameId || bankedRef.current === gameId) return;

    const player = room.players[uid];
    if (!player) return;

    // A device that saw no question of this game did not play it, and banking
    // for it costs a real person a game on their season record for nothing.
    // Somebody joined room 6JA5 eight seconds before the final screen went up
    // and took `played` from eight to nine on a score of zero.
    //
    // One question is enough, because joining late and playing three of twenty
    // is still playing. The log is mirrored into session storage, so a reload
    // during the round does not read as never having been here.
    if (gameLog.length === 0) return;

    bankedRef.current = gameId;

    // The frozen table, not the live one. Both filter on membership, but this
    // one filters on who was in the room when the whistle went — otherwise a
    // winner pressing Leave before this device banks removes them from `rows`,
    // promotes whoever was second, and banks a win that never happened.
    const players = finalSnapshot?.players ?? room.players;
    const scores = finalSnapshot?.scores ?? room.scores;

    const rows = roomStandings(players, scores);
    const leadScore = rows[0]?.score ?? 0;
    const mine = rows.find((entry) => entry.uid === uid);

    recordGame({
      playerId: playerIdFor(uid),
      name: player.name,
      gameId,
      score: scores[uid] ?? 0,
      // A round where nobody scored is not a win for everybody.
      won: leadScore > 0 && mine?.position === 1,
      // Empty means "keep whatever the record says" rather than "no squad", so
      // a regular playing from a second device cannot silently clear theirs.
      squad: rememberedSquad(),
      // Only ever set by a Lurker, and only changes which squad's weekly board
      // these points land on. Their season record still says Lurkers.
      playingWith: rememberedPlayingWith(),
      // Only from a log covering the whole game. A device that joined late or
      // reloaded before the log was kept would otherwise bank a shelf it cannot
      // stand behind — and unlike a screen that says nothing, that is permanent.
      honours: sawWholeGame(gameLog, room.questions.length)
        ? honoursFor(gameLog, Object.keys(players), uid)
        : NO_HONOURS,
    })
      .then((written) => setBanked({ ...written, gameId }))
      .catch((cause: unknown) => {
        // Put the game back within reach of another attempt. Nothing retries on
        // a timer — the next room update or a reload is what tries again — so
        // this cannot spin: on a finished room the document is almost never
        // written.
        bankedRef.current = null;
        report(cause);
      });
  }, [room, uid, gameLog, finalSnapshot, report]);

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
        <Suspense fallback={<Loading what="the season" />}>
          <Season youUid={uid} onBack={() => setShowSeason(false)} />
        </Suspense>
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
    <Stage mood={room.phase}>
      {problem ? <p className="notice">{problem}</p> : null}

      {/*
        Presence is a tidying mechanism, not part of the game. Saying so plainly
        beats the previous behaviour, where a failed presence write was a console
        warning nobody would see and the room quietly filled with ghosts.
      */}
      {presenceWorking ? null : (
        <p className="muted hint">
          Can&rsquo;t track who&rsquo;s still here, so anyone who closes their tab will stay in the
          list. The round plays normally.
        </p>
      )}

      {(showTitles && form && (
        <ColdOpen
          facts={form.facts}
          players={room.players}
          isQuizmaster={isQuizmaster}
          onStart={handleBeginRound}
          onBack={handleCancelTitles}
        />
      )) ||
        (room.phase === 'lobby' && (
        <Lobby
          room={room}
          youUid={uid}
          isQuizmaster={isQuizmaster}
          packs={packs}
          busy={busy}
          autoJoined={autoJoined}
          squad={rememberedSquad()}
          onStart={handleStart}
          onLeave={handleLeave}
        />
      )) ||
        ((room.phase === 'question' || room.phase === 'reveal') && (
          <QuestionScreen
            room={room}
            youUid={uid}
            isQuizmaster={isQuizmaster}
            clock={clock}
            joinedMidQuestion={joinedMidQuestion}
            revealed={room.phase === 'reveal'}
            // Derived rather than held: an automatic reveal is outstanding from
            // the moment the clock expires until the attempts are used up,
            // whether it is currently waiting for the gate or waiting for a
            // refusal to come back. Holding it as state would mean a setState
            // inside the expiry effect, which is the thing that effect is
            // deliberately built to avoid.
            revealing={clock.expired && retry.n < MAX_REVEAL_RETRIES}
            onAnswer={handleAnswer}
            onReveal={() => void handleReveal().catch(report)}
            onNext={() => void dispatch({ type: 'next', at: Date.now() }).catch(report)}
            onVote={handleVote}
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
            snapshot={finalSnapshot}
            banked={banked?.gameId === room.gameId ? banked : null}
            youPlayerId={uid ? playerIdFor(uid) : null}
            youUid={uid}
            isQuizmaster={isQuizmaster}
            log={gameLog}
            onPlayAgain={() => void dispatch({ type: 'reset' }).catch(report)}
            onLeave={handleLeave}
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
                onClick={handleLeave}
              >
                Leave
              </button>
            </div>
          </div>
        )}
    </Stage>
  );
}
