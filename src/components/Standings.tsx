import { AnimatePresence, motion } from 'motion/react';
import { standings } from '../engine/scoring';
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
  const rows = standings(scores).filter((entry) => players[entry.uid]);
  const leadScore = rows[0]?.score ?? 0;

  if (rows.length === 0) {
    return <p className="muted">No scores on the board yet.</p>;
  }

  return (
    <ol className="standings">
      <AnimatePresence initial={false}>
        {rows.map((entry) => {
          const player = players[entry.uid];
          if (!player) return null;

          const delta = deltas?.[entry.uid] ?? 0;
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
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            >
              <span className="standing__bar" style={{ width }} aria-hidden="true" />
              <span className="standing__pos">{entry.position}</span>
              <span className="standing__name">
                {player.name}
                {entry.uid === youUid ? <span className="plate__role"> you</span> : null}
              </span>
              <span className="standing__score">
                <ScoreTicker value={entry.score} />
                {delta > 0 ? <span className="standing__delta">+{delta}</span> : null}
              </span>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ol>
  );
}
