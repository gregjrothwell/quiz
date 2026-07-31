const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

export type TileState = 'idle' | 'picked' | 'correct' | 'wrong' | 'dim';

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
};

/** One lit answer podium. The lamp strip along its base carries the verdict. */
export function PodiumTile({ index, text, state, disabled, onPick, order }: PodiumTileProps) {
  const letter = LETTERS[index] ?? '?';

  return (
    <button
      type="button"
      className={`tile ${CLASS_FOR_STATE[state]}`.trim()}
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
