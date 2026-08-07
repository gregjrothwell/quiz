const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

/**
 * `hushed` is the drum roll — every lectern but your own pick, blacked out
 * while the verdict is held back. `gone` is what the also-rans become once it
 * lands: dropped away rather than merely dimmed, so the two survivors carry the
 * whole screen.
 */
export type TileState = 'idle' | 'picked' | 'correct' | 'wrong' | 'dim' | 'hushed' | 'gone';

interface PodiumTileProps {
  index: number;
  text: string;
  state: TileState;
  disabled: boolean;
  onPick: (index: number) => void;
  /** Position in the stagger, so the podiums light up in sequence. */
  order: number;
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
export function PodiumTile({ index, text, state, disabled, onPick, order }: PodiumTileProps) {
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
      {disabled ? null : (
        <span className="tile__key" aria-hidden="true">
          {letter} / {index + 1}
        </span>
      )}
    </button>
  );
}
