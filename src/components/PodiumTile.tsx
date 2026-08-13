const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

/**
 * `hushed` is the drum roll — every lectern but your own pick, blacked out
 * while the verdict is held back. `gone` is what the also-rans become once it
 * lands: dropped away rather than merely dimmed, so the two survivors carry the
 * whole screen.
 */
export type TileState = 'idle' | 'picked' | 'correct' | 'wrong' | 'dim' | 'hushed' | 'gone';

/** One player shown landing on this lectern during the reveal replay. */
export interface TileArrival {
  uid: string;
  name: string;
  elapsedMs: number;
  isYou: boolean;
}

interface PodiumTileProps {
  index: number;
  text: string;
  state: TileState;
  disabled: boolean;
  onPick: (index: number) => void;
  /** Position in the stagger, so the podiums light up in sequence. */
  order: number;
  /**
   * Who picked this lectern, in the order they got there. Empty until the
   * reveal — which lectern anybody chose is the one thing that must not leak
   * while the clock is running.
   */
  arrivals?: TileArrival[];
}

const NAME_LIST = new Intl.ListFormat('en-GB', { style: 'long', type: 'conjunction' });

/**
 * One decimal place. The speed bonus decays continuously, so the tenth is the
 * smallest difference worth showing — and a chip reading `1.24s` is a number to
 * read rather than a time to glance at.
 */
function seconds(elapsedMs: number): string {
  return `${(elapsedMs / 1000).toFixed(1)}s`;
}

const CLASS_FOR_STATE: Record<TileState, string> = {
  idle: '',
  picked: 'tile--picked',
  correct: 'tile--correct',
  wrong: 'tile--wrong',
  dim: 'tile--dim',
  hushed: 'tile--hushed',
  gone: 'tile--gone',
};

/**
 * Not exported. It was, along with a `TILE_LETTERS` alias, so the floor
 * reflection could build inert copies of the lecterns with the same lighting.
 * That reflection is gone, and a tile's class name is nobody else's business.
 */
function tileClassName(state: TileState): string {
  return `tile ${CLASS_FOR_STATE[state]}`.trim();
}

/** One lit answer podium. The lamp strip along its base carries the verdict. */
export function PodiumTile({
  index,
  text,
  state,
  disabled,
  onPick,
  order,
  arrivals = [],
}: PodiumTileProps) {
  const letter = LETTERS[index] ?? '?';

  return (
    <button
      type="button"
      className={tileClassName(state)}
      style={{ animationDelay: `${order * 70}ms` }}
      disabled={disabled}
      aria-pressed={state === 'picked'}
      onClick={() => onPick(index)}
    >
      <span className="tile__letter" aria-hidden="true">
        {letter}
      </span>
      <span className="tile__text">{text}</span>

      {arrivals.length > 0 ? (
        <span className="tile__crowd">
          {/*
            The chips are a race being watched, not a list being read. Announced
            once as a sentence instead, so a screen reader gets the outcome
            rather than a name arriving every few hundred milliseconds.
          */}
          <span className="sr-only">
            Picked by {NAME_LIST.format(arrivals.map((arrival) => arrival.name))}
          </span>
          {arrivals.map((arrival) => (
            <span
              key={arrival.uid}
              className={arrival.isYou ? 'tile__pick tile__pick--you' : 'tile__pick'}
              aria-hidden="true"
            >
              {arrival.name}
              <i>{seconds(arrival.elapsedMs)}</i>
            </span>
          ))}
        </span>
      ) : null}

      {disabled ? null : (
        <span className="tile__key" aria-hidden="true">
          {letter} / {index + 1}
        </span>
      )}
    </button>
  );
}
