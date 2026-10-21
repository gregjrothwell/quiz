import { AnimatePresence, motion } from 'motion/react';
import { boardMoves, NO_MOVES } from '../engine/movement';
import { roomStandings } from '../engine/scoring';
import type { Player } from '../engine/state';
import { ScoreTicker } from './ScoreTicker';

interface StandingsProps {
  players: Record<string, Player>;
  scores: Record<string, number>;
  deltas?: Record<string, number>;
  youUid: string | null;
}

/**
 * The running order. Rows animate between positions via a layout transition, so
 * overtaking is something you watch happen rather than something you infer.
 */
export function Standings({ players, scores, deltas, youUid }: StandingsProps) {
  const rows = roomStandings(players, scores);
  const leadScore = rows[0]?.score ?? 0;
  // Only with a question behind the board: the final screen's table has no
  // deltas, and a final table that announced moves would be announcing nothing.
  const { moves, newLeader } = deltas ? boardMoves(players, scores, deltas) : NO_MOVES;

  if (rows.length === 0) {
    return <p className="muted">No scores on the board yet.</p>;
  }

  return (
    <ol className="standings">
      <AnimatePresence initial={false}>
        {rows.map((entry, order) => {
          const player = players[entry.uid];
          if (!player) return null;

          const delta = deltas?.[entry.uid] ?? 0;
          const move = moves[entry.uid] ?? 0;
          const width = leadScore > 0 ? `${(entry.score / leadScore) * 100}%` : '0%';
          const classes = [
            'standing',
            entry.uid === youUid ? 'standing--you' : '',
            entry.position === 1 ? 'standing--leader' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <motion.li
              key={entry.uid}
              layout
              className={classes}
              // Opacity only, and no transform: the entrance is a CSS animation
              // while `layout` drives transforms from JS, and two owners of the
              // same property is how a row ends up stranded mid-flight.
              style={{ animationDelay: `${order * 60}ms` }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            >
              <span className="standing__bar" style={{ width }} aria-hidden="true" />
              <span className="standing__pos">{entry.position}</span>
              <span className="standing__name">
                {move !== 0 ? (
                  <span className="standing__move" data-dir={move > 0 ? 'up' : 'down'}>
                    <span aria-hidden="true">
                      {move > 0 ? '▲' : '▼'}
                      {Math.abs(move)}
                    </span>
                    <span className="sr-only">
                      {move > 0 ? 'up' : 'down'} {Math.abs(move)}
                    </span>
                  </span>
                ) : null}
                <span className="standing__who">
                  {player.name}
                  {entry.uid === youUid ? <span className="plate__role"> you</span> : null}
                </span>
                {entry.uid === newLeader ? <span className="standing__tag">New leader</span> : null}
              </span>
              <span className="standing__score">
                {/*
                  Counting from the score before this question means the number
                  climbs by exactly what was just won, at the same moment the
                  row slides past the people it overtook.
                */}
                <ScoreTicker value={entry.score} from={entry.score - delta} />
                {delta > 0 ? <span className="standing__delta">+{delta}</span> : null}
              </span>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ol>
  );
}
