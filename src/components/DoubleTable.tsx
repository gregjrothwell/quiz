import { morningTotals } from '../engine/double';
import { roomStandings } from '../engine/scoring';
import type { FirstHalf, Player } from '../engine/state';

interface DoubleTableProps {
  players: Record<string, Player>;
  /** Round two's own scores, as the room banked them. */
  scores: Record<string, number>;
  double: FirstHalf;
  /** A final moved the points, and the second column is what it left: it can go negative. */
  afterFinal?: boolean;
  youUid: string | null;
}

const n = (value: number): string => value.toLocaleString('en-GB');

/**
 * Both halves of The Double and the total, per player, at the end of the second
 * half (docs/decisions/morning-double.md, AC12). The one table under the podium
 * on a double: ranked on the total, and it shows how the total was made.
 */
export function DoubleTable({ players, scores, double, afterFinal = false, youUid }: DoubleTableProps) {
  const rows = roomStandings(players, morningTotals({ double, scores }));
  if (rows.length === 0) return null;

  return (
    <section className="stack">
      <p className="eyebrow">The Double</p>
      <table className="double-table">
        <thead>
          <tr>
            <th scope="col">Player</th>
            <th scope="col">First half</th>
            <th scope="col">{afterFinal ? 'Second half + final' : 'Second half'}</th>
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
