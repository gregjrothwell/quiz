import { Awards } from '../components/Awards';
import { Chair } from '../components/Chair';
import { Review } from '../components/Review';
import { ScoreTicker } from '../components/ScoreTicker';
import { Standings } from '../components/Standings';
import { awardsFor, reviewFor, sawWholeGame, type QuestionRecord } from '../engine/awards';
import { seatedLast, standings } from '../engine/scoring';
import type { RoomState } from '../engine/state';
import type { FinalSnapshot } from '../lib/useFinalSnapshot';
import { useCue } from '../lib/sound';

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
 * Which of the top three rows stands on each riser, left to right, so the winner
 * is in the middle. Indexes into the ranked rows rather than matching on position
 * number — with a tie for first there is no position 2, and looking up by
 * position left a hole on the podium and dropped the joint winner entirely.
 */
const RISER_SLOTS = [
  { row: 1, height: 'second' },
  { row: 0, height: 'first' },
  { row: 2, height: 'third' },
] as const;

export function Final({
  room,
  snapshot,
  youUid,
  isQuizmaster,
  log,
  onPlayAgain,
  onLeave,
  onSeason,
}: FinalProps) {
  const players = snapshot?.players ?? room.players;
  const scores = snapshot?.scores ?? room.scores;

  /*
    Still filtered on membership, but on the *frozen* membership — so it keeps
    doing the job it was written for (a score can never exist for somebody the
    room never listed) without letting anyone leaving after the whistle change
    what the room is looking at.
  */
  const rows = standings(scores).filter((entry) => players[entry.uid]);

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
  const podium = RISER_SLOTS.map((slot) => ({ ...slot, entry: rows[slot.row] }));
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
  const seatedName = seated
    .map((uid) => players[uid]?.name)
    .filter(Boolean)
    .join(' & ');
  const seatedScore = seated[0] ? (scores[seated[0]] ?? 0) : 0;

  // Keyed on the game so a second round in the same room gets its own fanfare,
  // and a re-render on the final screen does not.
  useCue('fanfare', room.gameId ?? 'no-game', hasPodium);

  return (
    <>
      <header>
        <p className="eyebrow">{room.packTitle ?? 'That’s the round'}</p>
        <h1 className="display" style={{ fontSize: 'clamp(2.4rem, 11vw, 5rem)' }}>
          {winnerName
            ? leaders.length > 1
              ? `${winnerName} — dead heat`
              : `${winnerName} takes it`
            : 'That’s a wrap'}
        </h1>
      </header>

      {hasPodium ? (
        <div className={seatedName ? 'finale finale--seated' : 'finale'}>
          {podium.map(({ height, entry }) => {
            const player = entry ? players[entry.uid] : undefined;
            if (!entry || !player) return <div key={height} />;

            return (
              <div key={height} className={`riser riser--${height}`}>
                <span className="riser__pos">{entry.position}</span>
                <span className="riser__name">{player.name}</span>
                <span className="riser__score">
                  <ScoreTicker value={entry.score} from={0} />
                </span>
              </div>
            );
          })}

          {seatedName ? <Chair name={seatedName} score={seatedScore} /> : null}
        </div>
      ) : null}

      <Standings players={players} scores={scores} youUid={youUid} />

      <Awards awards={awards} players={players} youUid={youUid} />

      <Review review={review} questions={room.questions} />

      <div className="btn-row">
        {isQuizmaster ? (
          <button type="button" className="btn btn--primary" onClick={onPlayAgain}>
            Another round
          </button>
        ) : (
          <p className="muted">Waiting to see if the quizmaster starts another…</p>
        )}
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
      <p className="muted" style={{ fontSize: '0.85rem' }}>
        That’s gone onto the season table, which is tied to this browser. Grab a recovery code
        there if you ever play from anywhere else.
      </p>
    </>
  );
}
