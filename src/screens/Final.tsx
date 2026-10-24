import { chaserResult, chaserScore } from '../engine/chaser';
import { Commentary } from '../components/Commentary';
import { useEffect, useState, type CSSProperties } from 'react';
import { Awards } from '../components/Awards';
import { Confetti } from '../components/Confetti';
import { DoubleTable } from '../components/DoubleTable';
import { isHalfTime, morningTotals } from '../engine/double';
import { WeekBoard } from '../components/WeekBoard';
import { Chair } from '../components/Chair';
import { Review } from '../components/Review';
import { ScoreTicker } from '../components/ScoreTicker';
import { Standings } from '../components/Standings';
import { awardsFor, reviewFor, sawWholeGame, type QuestionRecord } from '../engine/awards';
import { podiumFor, roomStandings, seatedLast, type RiserHeight } from '../engine/scoring';
import type { RoomState } from '../engine/state';
// Type-only, so the drawing module itself stays out of this chunk.
import type * as DrawCard from '../lib/drawCard';
import type { Delivery } from '../lib/drawCard';
import type { Banked } from '../lib/season';
import type { FinalSnapshot } from '../lib/useFinalSnapshot';
import { ROLL_SECONDS, useCue } from '../lib/sound';
import { useReducedMotion } from '../lib/useReducedMotion';

interface FinalProps {
  room: RoomState;
  /**
   * The room as it stood at the whistle. Everything on this screen reads from
   * here rather than from `room`, because `leave` deletes `players.{uid}` and
   * the old derivation filtered on membership — so one person going home
   * re-indexed the risers on every other device. See `useFinalSnapshot`.
   *
   * Null only for a room with no `gameId`, which means every round played
   * before games were identified. Those fall back to the live room, which is
   * exactly where they were before this existed.
   */
  snapshot: FinalSnapshot | null;
  /**
   * What this device banked and where, or null until it has.
   *
   * The week board waits for it rather than loading on mount: every device
   * banks its own row, so reading any earlier reliably shows a table with you
   * missing from it, which reads as a bug rather than as a race.
   */
  banked: Banked | null;
  /** Which row on the week board is yours. Not the uid once a code is claimed. */
  youPlayerId: string | null;
  youUid: string | null;
  isQuizmaster: boolean;
  /**
   * This device's record of the game, which only exists in memory — see
   * `useGameLog`. Short of the full round on a client that reloaded or joined
   * late, and the awards are withheld rather than shown from a partial view.
   */
  log: QuestionRecord[];
  onPlayAgain: () => void;
  onLeave: () => void;
  onSeason: () => void;
}

/**
 * The drawing module, fetched at most once per page rather than once per screen.
 *
 * At module scope deliberately. A `useRef` would hold the same promise per
 * component instance, which is both more state than the problem has — there is
 * exactly one such module — and a mutation the React Compiler cannot follow, so
 * it refuses to optimise the whole component around it.
 */
let drawer: Promise<typeof DrawCard> | null = null;

function loadDrawer(): Promise<typeof DrawCard> {
  drawer ??= import('../lib/drawCard');
  return drawer;
}

/**
 * The podium, held the way a show holds it: third, a beat, second, a drum roll,
 * and only then the winner — with the fanfare and the confetti on the landing.
 * It used to stand all three up 200ms apart, which put the biggest moment of
 * the round over in half a second.
 *
 * The winner's name in the heading waits for the riser too, and so does
 * everything under the podium: a table with the winner at the top of it,
 * visible while the drum is still rolling, would be the spoiler.
 */
const RISER_AT: Record<RiserHeight, number> = {
  third: 300,
  second: 1_500,
  first: 2_300 + Math.round(ROLL_SECONDS * 1000),
};
const ROLL_AT = 2_300;
/** The winner's riser has finished arriving (`rise` is 520ms). */
const LANDED_AT = RISER_AT.first + 520;

/**
 * Games whose podium this page has already built, so coming back from the
 * season table shows the result rather than staging it all again. Module scope
 * for the reason `drawer` is: one per page, and nothing for a render to own.
 */
const builtPodiums = new Set<string>();

/** A start time for a CSS entrance, as the `--at` its rule reads. */
const at = (ms: number): CSSProperties => ({ '--at': `${ms}ms` }) as CSSProperties;

/** What the share button is doing, so it can say so rather than sit there. */
type CardState = 'idle' | 'working' | 'failed' | Delivery;

const CARD_LABELS: Record<CardState, string> = {
  idle: 'Share the result',
  working: 'Drawing…',
  clipboard: 'Copied — paste it in',
  share: 'Shared',
  download: 'Saved as an image',
  failed: 'Couldn’t make the image',
};

export function Final({
  room,
  snapshot,
  banked,
  youPlayerId,
  youUid,
  isQuizmaster,
  log,
  onPlayAgain,
  onLeave,
  onSeason,
}: FinalProps) {
  const players = snapshot?.players ?? room.players;
  const roundScores = snapshot?.scores ?? room.scores;
  /*
    The Double (docs/decisions/morning-double.md). Round one ends at half-time
    on its own scores; round two ends on the morning, round one plus round two,
    and everything that ranks below reads it — the podium, the chair, the
    table and the card — so the champion of the morning is the one on top.
  */
  const halfTime = isHalfTime(room);
  const double = room.double;
  const scores = double ? morningTotals({ double, scores: roundScores }) : roundScores;

  /*
    Still filtered on membership, but on the *frozen* membership — so it keeps
    doing the job it was written for (a score can never exist for somebody the
    room never listed) without letting anyone leaving after the whistle change
    what the room is looking at.
  */
  const rows = roomStandings(players, scores);

  /*
    Only from a complete log. Every client works the awards out for itself from
    what it saw, so a device that missed questions would name different winners
    to the one beside it — and two screens disagreeing about who was fastest is
    worse than neither of them saying.
  */
  const sawItAll = sawWholeGame(log, room.questions.length);
  const awards = sawItAll ? awardsFor(log, Object.keys(players)) : [];
  const review = sawItAll ? reviewFor(log) : [];
  const leaders = rows.filter((entry) => entry.position === 1);
  const winnerName =
    leaders.length > 1
      ? leaders.map((entry) => players[entry.uid]?.name).filter(Boolean).join(' & ')
      : rows[0]
        ? players[rows[0].uid]?.name
        : undefined;
  /*
    Who stands and how high is `podiumFor`'s — the card draws from the same
    call. Joint places stand equally high; it used to index the top three rows,
    which put one of two joint winners on the second-place riser.
  */
  const { slots } = podiumFor(rows);
  const hasPodium = rows.length > 0;

  /*
    The chair at the end of the podium. Named the same way the dead-heat winner
    above is, because a shared last place is still last.

    **It used to empty when its occupant left**, on the stated principle that an
    award goes with its winner rather than staying pinned to nobody. That is
    deliberately reversed: the round is over, so there is no winner left to go
    anywhere — there is only a result, and a result that rearranges itself while
    the room reads it is not one. The same reversal is why every other reader on
    this screen now works from the frozen snapshot.
  */
  const seated = seatedLast(rows);
  /*
    The whole tie, not a joined string. `seatedLast` has always returned everyone
    level at the bottom — this was pre-joining them with an ampersand, so three
    people who tied for last were drawn as one figure with a long label. Live
    rooms XS4A and YS8F both finished tied at the bottom.
  */
  const seatedNames = seated
    .map((uid) => players[uid]?.name)
    .filter((name): name is string => Boolean(name));
  // Off the first, which is safe by construction: everyone seated is level.
  const seatedScore = seated[0] ? (scores[seated[0]] ?? 0) : 0;

  const podiumKey = room.gameId ?? 'no-game';
  const reducedMotion = useReducedMotion();
  const [firstSight] = useState(() => !builtPodiums.has(podiumKey));
  const staging = hasPodium && firstSight && !reducedMotion;

  useEffect(() => {
    builtPodiums.add(podiumKey);
  }, [podiumKey]);

  const [beat, setBeat] = useState<'build' | 'roll' | 'landed'>('build');
  useEffect(() => {
    if (!staging) return;
    const timers = [
      window.setTimeout(() => setBeat('roll'), ROLL_AT),
      window.setTimeout(() => setBeat('landed'), LANDED_AT),
    ];
    return () => {
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [staging]);
  /*
    A tap or Space jumps to the result. The build holds "Another round" back
    for about four seconds, which is a long time for a quizmaster who has seen
    a podium before. The cut moves every held entrance's start to now — their
    animations are already running, so a start in the past simply finishes
    them — and fires the landing straight away.

    While the build runs, everything under the podium is invisible but would
    still take a click, so it takes none (`data-held`): a tap meant to skip must
    never land on a button nobody can see.
  */
  const [cut, setCut] = useState(false);
  const landed = !staging || beat === 'landed' || cut;
  const holding = staging && !cut;

  useEffect(() => {
    if (landed) return;
    const skip = (): void => setCut(true);
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== ' ' && event.key !== 'Enter') return;
      event.preventDefault();
      skip();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', skip);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', skip);
    };
  }, [landed]);

  // Keyed on the game so a second round in the same room gets its own fanfare,
  // and a re-render on the final screen does not. Not again on coming back to
  // a podium this page has already built.
  useCue('roll', podiumKey, holding && beat === 'roll');
  useCue('fanfare', podiumKey, hasPodium && firstSight && landed);

  const [cardState, setCardState] = useState<CardState>('idle');

  /*
    Fetched when the podium appears rather than when the button is pressed, and
    that is not an optimisation — it is what makes the clipboard route work.

    Writing an image to the clipboard is gated on the transient activation of the
    press that asked for it, and a cold `import()` is a network fetch: on a slow
    connection the module lands after the activation has expired, the write is
    refused, and the card silently degrades to a download on the one press that
    mattered. Prefetching costs a couple of kB, on the last screen of the round,
    to the people who have already finished playing.

    It still does what the split was for: nothing here is in the main chunk, so
    the players who never reach a final screen never fetch it.
  */
  useEffect(() => {
    if (hasPodium) void loadDrawer();
  }, [hasPodium]);

  const handleShareCard = () => {
    setCardState('working');

    loadDrawer()
      .then((loaded) =>
        loaded.shareRound(
          {
            packTitle: room.packTitle,
            players,
            scores,
            rows,
            awards,
            sawWholeGame: sawItAll,
            chaser: room.chaserEnabled ? chaserScore(room.questions) : null,
            questionCount: room.questions.length,
          },
          `vibe-quiz-${room.code}.png`,
        ),
      )
      .then(setCardState)
      .catch(() => setCardState('failed'));
  };

  return (
    <>
      <Confetti fire={staging && landed} />

      <header>
        <p className="eyebrow">
          {halfTime ? 'Half-time · ' : ''}
          {room.packTitle ?? 'That’s the round'}
        </p>
        <h1 className="display display--hero finale__title" style={at(holding ? LANDED_AT - 200 : 0)}>
          {winnerName
            ? double
              ? leaders.length > 1
                ? `${winnerName} share The Double`
                : `${winnerName} wins The Double`
              : halfTime
                ? `${winnerName} ${leaders.length > 1 ? 'lead' : 'leads'} at half-time`
                : leaders.length > 1
                  ? `${winnerName} — dead heat`
                  : `${winnerName} takes it`
            : 'That’s a wrap'}
        </h1>
        {room.chaserEnabled ? (
          <p className="chaser-line chaser-line--result">{chaserResult(chaserScore(room.questions))} 🍟</p>
        ) : null}
        {/* The frozen table, as everything else here: the winner pressing Leave
            must not take the line with them. */}
        <Commentary room={{ ...room, players, scores }} moment="podium" show={landed} />
      </header>

      {hasPodium ? (
        <div
          className={[
            'finale',
            slots.length > 3 ? `finale--${slots.length}` : '',
            seatedNames.length > 0 ? 'finale--seated' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{ '--chair-at': `${holding ? LANDED_AT + 500 : 600}ms` } as CSSProperties}
        >
          {slots.map((riser, slot) => {
            const player = riser ? players[riser.uid] : undefined;
            if (!riser || !player) return <div key={`empty-${slot}`} />;

            return (
              <div
                key={riser.uid}
                className={`riser riser--${riser.height}`}
                style={at(holding ? RISER_AT[riser.height] : 0)}
              >
                <span className="riser__pos">{riser.position}</span>
                <span className="riser__name">{player.name}</span>
                <span className="riser__score">
                  {/* Counts as the riser arrives, not while it is still waiting
                      off stage — a number that finished before anyone could
                      see it is no count at all. */}
                  <ScoreTicker value={riser.score} from={0} delayMs={holding ? RISER_AT[riser.height] : 0} />
                </span>
                {riser.more > 0 ? <span className="riser__more">+{riser.more} level</span> : null}
              </div>
            );
          })}

          {seatedNames.length > 0 ? <Chair names={seatedNames} score={seatedScore} /> : null}
        </div>
      ) : null}

      <div
        className="finale__after"
        style={at(holding ? LANDED_AT + 300 : 0)}
        data-held={landed ? undefined : ''}
      >
        <Standings players={players} scores={scores} youUid={youUid} />

        {double ? <DoubleTable players={players} scores={roundScores} double={double} youUid={youUid} /> : null}

        <Awards awards={awards} players={players} youUid={youUid} />

        <Review review={review} questions={room.questions} />

        {/* The week the round just went into, filtered to the squad it was played
            for — a Lurker's pick where they made one, and their own squad
            otherwise. Renders nothing until this device's own row has landed. */}
        {banked ? (
          <WeekBoard
            bucket={banked.week}
            squad={banked.squad}
            ready
            youPlayerId={youPlayerId}
          />
        ) : null}

        <div className="btn-row">
          {isQuizmaster ? (
            <button type="button" className="btn btn--primary" onClick={onPlayAgain}>
              {halfTime ? 'Second half' : 'Another round'}
            </button>
          ) : (
            <p className="muted">
              {halfTime
                ? 'Half-time. Waiting for the quizmaster to start the second half…'
                : 'Waiting to see if the quizmaster starts another…'}
            </p>
          )}
          {/* Everybody, not just the quizmaster: whoever is in the Teams channel
              is the person who will paste it there. */}
          {hasPodium ? (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={handleShareCard}
              disabled={cardState === 'working'}
            >
              {CARD_LABELS[cardState]}
            </button>
          ) : null}
          <button type="button" className="btn btn--ghost" onClick={onSeason}>
            Season table
          </button>
          <button type="button" className="btn btn--ghost" onClick={onLeave}>
            Leave
          </button>
        </div>

        {/* Said once, here, because this is the moment there is a record worth
            keeping — and the season table is where the code lives. Not a prompt or
            a dialog: nobody has ever thanked a quiz for interrupting the podium. */}
        <p className="muted hint hint--apart">
          That’s gone onto the season table, which is tied to this browser. Grab a recovery code
          there if you ever play from anywhere else.
        </p>
      </div>
    </>
  );
}
