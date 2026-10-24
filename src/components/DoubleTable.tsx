import { morningTotals } from '../engine/double';
import { roomStandings } from '../engine/scoring';
import type { FirstHalf, Player } from '../engine/state';

interface DoubleTableProps {
  players: Record<string, Player>;
  /** Round two's own scores, as the room banked them. */
  scores: Record<string, number>;
  double: FirstHalf;
  youUid: string | null;
}

const n = (value: number): string => value.toLocaleString('en-GB');

/**
 * Both rounds of The Double and the morning, per player, at the end of round
 * two (docs/decisions/morning-double.md, AC12). The standings above rank the
 * morning; this is where anybody can see how it was made.
 */
export function DoubleTable({ players, scores, double, youUid }: DoubleTableProps) {
  const rows = roomStandings(players, morningTotals({ double, scores }));
  if (rows.length === 0) return null;

  return (
    <section className="stack">
      <p className="eyebrow">The Double</p>
      <table className="double-table">
        <thead>
          <tr>
            <th scope="col">Player</th>
            <th scope="col">Round one</th>
            <th scope="col">Round two</th>
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.uid} className={row.uid === youUid ? 'double-table__you' : undefined}>
              <th scope="row">{players[row.uid]?.name ?? 'Somebody'}</th>
              <td>{n(double.scores[row.uid] ?? 0)}</td>
              <td>{n(scores[row.uid] ?? 0)}</td>
              <td>{n(row.score)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
