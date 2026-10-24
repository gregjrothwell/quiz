import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { ChaserIntro } from './components/ChaserIntro';
import { ColdOpen } from './components/ColdOpen';
import { RigCheck } from './components/RigCheck';
import { Stage } from './components/Stage';
import { arrivalFor, walkedIn, NO_ARRIVAL, type Arrival } from './engine/arrival';
import type { HistoryGroup } from './engine/askedHistory';
import { shouldAutoJoin } from './engine/autoJoin';
import type { Verdict } from './engine/questionVote';
import { honoursFor, sawWholeGame, NO_HONOURS } from './engine/awards';
import { finalFor } from './engine/finals';
import { formFor } from './engine/form';
import { roomStandings } from './engine/scoring';
import { skippedIndices, streakOf } from './engine/streak';
import { codeFromHash } from './engine/roomCode';
import {
  DEFAULT_QUESTION_DURATION_MS,
  currentQuestion,
  questionDurationMs,
  type Level,
} from './engine/state';
import { firestore, isFirebaseConfigured } from './firebase';
import { BUZZ_LOCK, buzz } from './lib/haptics';
import { playerIdFor } from './lib/identity';
import { recordVote } from './lib/questionVotes';
import { rememberedName } from './lib/rememberedName';
import {
  rememberPlayingWith,
  rememberSquad,
  rememberedPlayingWith,
  rememberedSquad,
} from './lib/rememberedSquad';
import { useFinalistRecords } from './lib/useFinalistRecords';
import { useFinalSnapshot } from './lib/useFinalSnapshot';
import { useGameLog } from './lib/useGameLog';
import { loadAsked, loadForm, recordAsked, recordGame, type Banked } from './lib/season';
import { answerStillInFlight } from './host/due';
import { dealRound } from './host/prepare';
import type { PackPorts } from './host/ports';
import { play } from './lib/sound';
import { useStillPreload } from './lib/stills';
import { loadPackQuestions, loadRates, usePackIndex } from './lib/usePacks';
import { useHost } from './lib/useHost';
import { useQuestionClock } from './lib/useQuestionClock';
import { useRoom } from './lib/useRoom';
import { useStandoff } from './lib/useStandoff';
import type { PackId } from './questions/types';
import { Final } from './screens/Final';
import { Landing } from './screens/Landing';
import { Lobby } from './screens/Lobby';
import { QuestionScreen } from './screens/QuestionScreen';
import { Scoreboard } from './screens/Scoreboard';
import { ShareOrShaft } from './screens/ShareOrShaft';

/*
  Split out of the main bundle, because neither is on the path into a game.

  `Preview` is the design gallery and its fixtures — the largest screen in the
  repo, reachable only from `#/preview`. `Season` is behind a button press.
  Every player was downloading both to play a round that touches neither.

  Named exports, so the dynamic import is mapped to a default for `lazy`.
*/
const Preview = lazy(() => import('./screens/Preview').then((m) => ({ default: m.Preview })));
const Season = lazy(() => import('./screens/Season').then((m) => ({ default: m.Season })));
const Updates = lazy(() => import('./screens/Updates').then((m) => ({ default: m.Updates })));

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

/** The packs and the season's question history, for dealing a round (`src/host/prepare.ts`). */
const PACK_PORTS: PackPorts = { loadPack: loadPackQuestions, loadAsked, recordAsked, loadRates };

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
    answersError,
    isQuizmaster,
    lamps,
    answersReady,
    presenceWorking,
    questionConfirmedAt,
    questionOriginAt,
    createAndJoin,
    join,
    leave,
    dispatch,
    submitAnswer,
    writeOwnSquad,
    writeOwnVote,
    writeBrowsing,
  } = useRoom();
  const { packs, error: packsError } = usePackIndex();

  /*
    Pull the round's pictures down while the lobby is open.

    Every device holds all fifteen questions from the moment the round is built,
    so every filename is known long before the first one is shown — and then the
    lobby sits there while people join. Before this the first request for a
    still went out when the question rendered, which is the same frame the
    countdown starts in: on a slow connection the picture and the answer window
    were racing, and on 18 September 2026 the picture lost.

    Cheap to the point of free on the packs that have images — fifteen stills is
    about 1.2MB for On the box — and a no-op for the eleven text packs.
  */
  useStillPreload(room?.questions);

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<ActionError | null>(null);
  const [showSeason, setShowSeason] = useState(false);
  const [showUpdates, setShowUpdates] = useState(false);


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
   * Adjusted during render: React re-renders before
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

  // The final, when the room chose one: the sealed picks, and the quizmaster's
  // moves from talk to pick to the settle. Idle — no listener, no clock — in
  // every other phase. See `lib/useStandoff.ts`.
  const standoffView = useStandoff({ code, uid, room, isQuizmaster, onError: report });

  // Everything the host's device does for the room — reveal on the clock, beat,
  // move the final on, keep the round, reap the lobby — decided in
  // `src/host/due.ts` and run by `lib/useHost.ts`. Idle on every other device.
  const host = useHost({
    code,
    uid,
    room,
    isHost: isQuizmaster,
    answersReady,
    clockExpired: clock.expired,
    answerInFlight: room !== null && answerStillInFlight(room.players, room.answers, lamps),
    confirmedAt: questionConfirmedAt,
    durationMs,
    gameLog,
    finalTable: finalSnapshot,
    committed: standoffView.committed,
    opened: standoffView.opened,
    dispatch,
    report,
  });
  const finalistRecords = useFinalistRecords(room);

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
    (
      packId: PackId,
      count: number,
      level: Level,
      durationSecs: number,
      wagerEnabled: boolean,
      stealEnabled: boolean,
      jigsawEnabled: boolean,
      standoffEnabled: boolean,
      chaserEnabled: boolean,
      history: HistoryGroup,
    ) => {
      setBusy(true);
      setActionError(null);
      // Dealing, and remembering what was dealt, is `src/host/prepare.ts`.
      dealRound({ packId, count, level, jigsawEnabled, chaserEnabled, history }, PACK_PORTS)
        .then(async ({ questions, ladderNotices, remember }) => {
          const pack = packs.find((entry) => entry.id === packId);

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
          const records = await loadForm(roster).catch(() => []);
          const facts = formFor(records);
          // Kept on the room for the Commentator: "first win" on every screen alike.
          const history = Object.fromEntries(
            records.map((record) => [record.uid, { played: record.played, wins: record.wins, best: record.best }]),
          );

          /*
            The titles go up and the round waits there. Starting it is a second,
            deliberate press — see `handleBeginRound`.

            The window is parked inside the digest rather than kept on this
            device, so the round can still open on the window that was chosen if
            the quizmaster's chair changes hands while the titles are up. It
            cannot go on the room's own `durationSecs`, which the rules pin until
            a question actually opens.

            A room the season knows nothing about has no titles to show. A round
            against Mr Fries still shows his card first; the host opens the
            question from there. Any other round starts on the one press it was
            given.
          */
          await dispatch([
            {
              type: 'selectPack',
              packId,
              packTitle: pack?.title ?? packId,
              questions,
              wagerEnabled,
              stealEnabled,
              jigsawEnabled,
              standoffEnabled,
              chaserEnabled,
              history,
              ladderNotices,
            },
            ...(facts.length > 0
              ? [{ type: 'titles' as const, at: Date.now(), facts, durationSecs }]
              : chaserEnabled
                ? [{ type: 'chaserIntro' as const, at: Date.now(), durationSecs }]
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
          await remember();
        })
        .catch(report)
        .finally(() => setBusy(false));
    },
    [dispatch, packs, report, room?.players],
  );

  const handleAnswer = useCallback(
    (optionIndex: number, wager?: number) => {
      // Cued on the tap rather than on the write landing: the point of the
      // sound is to confirm the press, and a round-trip to Firestore is long
      // enough for the delay to read as a missed input.
      play('lock');
      buzz(BUZZ_LOCK);
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
      submitAnswer(optionIndex, joinedMidQuestion ? durationMs : clock.elapsedMs, wager).catch(report);
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
   * The room cannot get stuck behind a quizmaster who wandered off. A host who
   * presses Leave hands the chair over in the same write; one who vanishes is
   * replaced once they have been gone from presence for 50 seconds and their beat
   * has been silent for 75 (`planClaim` and `CLAIM_AFTER_SILENT_MS`, host.ts).
   */
  const handleBeginRound = useCallback(() => {
    if (!form) return;
    setActionError(null);
    // The field card first, then Mr Fries, then the question. The titles wait
    // for a tap. His card does not: the host opens question one a few seconds
    // later, and the answering clock starts at that open.
    if (room?.chaserEnabled) {
      void dispatch({ type: 'chaserIntro', at: Date.now(), durationSecs: form.durationSecs }).catch(report);
      return;
    }
    void dispatch({
      type: 'start',
      at: Date.now(),
      gameId: crypto.randomUUID(),
      durationSecs: form.durationSecs,
    }).catch(report);
  }, [form, room?.chaserEnabled, dispatch, report]);

  const { openQuestion } = host;
  const handleStartQuestion = useCallback(() => {
    if (!room?.chaserIntro) return;
    setActionError(null);
    // The same open the timer sends, so a tap on the same tick cannot start
    // the question twice. `dispatch` would be a second writer.
    void openQuestion().catch(report);
  }, [room?.chaserIntro, openQuestion, report]);

  const handleCancelTitles = useCallback(() => {
    setActionError(null);
    void dispatch({ type: 'clearTitles' }).catch(report);
  }, [dispatch, report]);


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
    // Still on the room at `finished`. `reset` is what clears it. Absent for
    // anyone who was not one of the two, so their tallies are carried, not bumped.
    const countedFinal = finalFor(room.standoff, uid);

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
      ...(countedFinal ? { final: countedFinal } : {}),
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

  const problem =
    (actionError?.step === roomStep ? actionError.message : null)
    ?? packsError
    // A closed listener does not reopen on its own; a reload resubscribes.
    ?? (answersError ? `Answers stopped reaching this device (${answersError}). Reload the page to reconnect.` : null);

  if (showSeason) {
    return (
      <Stage>
        <Suspense fallback={<Loading what="the season" />}>
          <Season youUid={uid} onBack={() => setShowSeason(false)} />
        </Suspense>
      </Stage>
    );
  }

  /*
    Same page from the landing and from the lobby. This return does not clear
    the room, and the listener above keeps running while the page is open, so
    Back lands a join-link player in the room they were waiting in.
  */
  if (showUpdates) {
    return (
      <Stage>
        <Suspense fallback={<Loading what="what's new" />}>
          <Updates onBack={() => setShowUpdates(false)} />
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
          onUpdates={() => setShowUpdates(true)}
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
        (room.phase === 'lobby' && room.chaserIntro && (
          <ChaserIntro isQuizmaster={isQuizmaster} onStart={handleStartQuestion} />
        )) ||
        (room.phase === 'lobby' && (
        <>
        <Lobby
          room={room}
          youUid={uid}
          isQuizmaster={isQuizmaster}
          packs={packs}
          busy={busy}
          autoJoined={autoJoined}
          squad={rememberedSquad()}
          onPickSquad={(next) => {
            rememberSquad(next);
            void writeOwnSquad(next).catch(report);
          }}
          onVote={(packId) => void writeOwnVote(packId).catch(report)}
          onBrowse={(packId) => void writeBrowsing(packId).catch(report)}
          onStart={handleStart}
          onLeave={handleLeave}
          onUpdates={() => setShowUpdates(true)}
        />
        {uid ? <RigCheck code={room.code} uid={uid} isHost={isQuizmaster} /> : null}
        </>
      )) ||
        ((room.phase === 'question' || room.phase === 'reveal') && (
          <QuestionScreen
            room={room}
            youUid={uid}
            isQuizmaster={isQuizmaster}
            clock={clock}
            joinedMidQuestion={joinedMidQuestion}
            revealed={room.phase === 'reveal'}
            lamps={lamps}
            // Derived rather than held: an automatic reveal is outstanding from
            // the moment the clock expires until the attempts are used up,
            // whether it is currently waiting for the gate or waiting for a
            // refusal to come back. Holding it as state would mean a setState
            // inside the expiry effect, which is the thing that effect is
            // deliberately built to avoid.
            revealing={host.revealing}
            onAnswer={handleAnswer}
            onReveal={() => void host.reveal().catch(report)}
            onNext={() => void dispatch({ type: 'next', at: Date.now() }).catch(report)}
            onVote={handleVote}
            streak={uid ? streakOf(gameLog, uid, skippedIndices(room)) : 0}
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
        (room.phase === 'standoff' && (
          <ShareOrShaft
            room={room}
            youUid={uid}
            isQuizmaster={isQuizmaster}
            view={standoffView}
            records={finalistRecords}
            onOpenPicks={() => void dispatch({ type: 'openPicks' }).catch(report)}
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
