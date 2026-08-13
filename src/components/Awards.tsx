import type { Award } from '../engine/awards';
import type { Player } from '../engine/state';

interface AwardsProps {
  awards: Award[];
  players: Record<string, Player>;
  youUid: string | null;
}

const ORDINALS = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];

function ordinal(position: number): string {
  return ORDINALS[position] ?? `${position}th`;
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/**
 * The title and the line under it. Kept here rather than in the engine so that
 * rewording an award is a change to a screen, not to a tested rule — the same
 * split as the lobby and its level names.
 */
function describe(award: Award): { title: string; detail: string } {
  switch (award.id) {
    case 'fastest':
      return {
        title: 'Fastest finger',
        detail: `In on the buzzer at ${(award.elapsedMs / 1000).toFixed(1)} seconds.`,
      };
    case 'comeback':
      return {
        title: 'Comeback of the night',
        detail: `Was ${ordinal(award.from)}. Finished ${ordinal(award.to)}.`,
      };
    case 'lone-wolf':
      return {
        title: 'The only one who knew',
        detail: `${award.count} ${plural(award.count, 'question', 'questions')} nobody else got.`,
      };
    case 'contrarian':
      return {
        title: 'Boldly wrong',
        detail: `${award.count} wrong ${plural(award.count, 'answer', 'answers')} nobody else went near.`,
      };
  }
}

export function Awards({ awards, players, youUid }: AwardsProps) {
  if (awards.length === 0) return null;

  return (
    <section className="stack">
      <p className="eyebrow">Also worth noting</p>
      <ul className="awards">
        {awards.map((award) => {
          const { title, detail } = describe(award);
          const named = award.uids
            .map((uid) => players[uid]?.name)
            .filter((name): name is string => Boolean(name));

          // A winner who has since left the room takes their award with them,
          // rather than leaving a rosette pinned to nobody.
          if (named.length === 0) return null;

          const mine = youUid !== null && award.uids.includes(youUid);

          return (
            <li className={mine ? 'award award--yours' : 'award'} key={award.id}>
              <p className="award__title">{title}</p>
              <p className="award__who">{named.join(' & ')}</p>
              <p className="award__detail">{detail}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
