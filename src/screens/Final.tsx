import { ScoreTicker } from '../components/ScoreTicker';
import { Standings } from '../components/Standings';
import { standings } from '../engine/scoring';
import type { RoomState } from '../engine/state';
import { useCue } from '../lib/sound';

interface FinalProps {
  room: RoomState;
  youUid: string | null;
  isQuizmaster: boolean;
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
  youUid,
  isQuizmaster,
  onPlayAgain,
  onLeave,
  onSeason,
}: FinalProps) {
  const rows = standings(room.scores).filter((entry) => room.players[entry.uid]);
  const leaders = rows.filter((entry) => entry.position === 1);
  const winnerName =
    leaders.length > 1
      ? leaders.map((entry) => room.players[entry.uid]?.name).filter(Boolean).join(' & ')
      : rows[0]
        ? room.players[rows[0].uid]?.name
        : undefined;
  const podium = RISER_SLOTS.map((slot) => ({ ...slot, entry: rows[slot.row] }));
  const hasPodium = rows.length > 0;

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
        <div className="finale">
          {podium.map(({ height, entry }) => {
            const player = entry ? room.players[entry.uid] : undefined;
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
        </div>
      ) : null}

      <Standings players={room.players} scores={room.scores} youUid={youUid} />

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
    </>
  );
}
