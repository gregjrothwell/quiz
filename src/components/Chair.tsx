import { ScoreTicker } from './ScoreTicker';

interface ChairProps {
  /** Joined names when a dead heat puts more than one person in it. */
  name: string;
  score: number;
}

/**
 * The fourth seat at the podium, for whoever finished bottom.
 *
 * The joke is entirely in the height. `.finale` aligns its columns to the floor,
 * so three people stand on risers of increasing height and this one is sat down
 * next to them at ground level — no caption has to explain it, and none does the
 * work as well as the eye-line does.
 *
 * Drawn rather than set as an emoji. There is not a single emoji anywhere in
 * this app, and a full-colour glyph would sit badly against the Anton and neon
 * of everything around it, size differently on every operating system, and take
 * neither the cyan glow nor the roll-in below. It is an office swivel chair
 * because the eyebrow on the landing screen says "the office quiz", and a
 * five-star base on castors is the one piece of furniture that says so back.
 *
 * Drawn from the side, and that is the second attempt. Head-on, the base was
 * four legs splaying symmetrically off a central column with a round castor on
 * the end of each, under a rounded back with a horizontal bar across it — which
 * is also a fair description of an octopus with a face. In profile there is a
 * backrest, an armrest and a seat before the eye ever reaches the wheels, so the
 * legs are read as the bottom of a chair rather than as limbs of something.
 */
export function Chair({ name, score }: ChairProps) {
  return (
    <div className="seat">
      {/*
        Label above the chair, which is not just tidiness: `.finale` aligns its
        columns to the floor, so anything stacked on top pushes the chair further
        down the podium. Below it, the label was propping the chair up.
      */}
      <span className="seat__name">{name}</span>
      <span className="seat__score">
        <ScoreTicker value={score} from={0} />
      </span>

      <svg className="seat__chair" viewBox="6 2 50 72" aria-hidden="true" focusable="false">
        {/* Askew, as though it has been pushed back rather than tucked in. */}
        <g transform="rotate(-3 31 64)">
          <g
            className="seat__frame"
            fill="none"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="40" y="8" width="10" height="32" rx="5" transform="rotate(10 45 40)" />
            <rect x="13" y="40" width="32" height="7" rx="3.5" />
            <path d="M43 30H21a3 3 0 0 0-3 3v7" />
            <path d="M29 47v10" />
            <path d="m29 57-14 8M29 57l14 8M29 57v9" />
            <circle cx="13.5" cy="66.5" r="2.3" />
            <circle cx="44.5" cy="66.5" r="2.3" />
            <circle cx="29" cy="68" r="2.3" />
          </g>

          {/*
            Head forward of the shoulders and an arm gone limp over the rest.
            The slump is the whole characterisation, and it is doing the job the
            sad emoji would have done — in the same ink as everything else.
          */}
          <g className="seat__sitter" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="34" cy="18" r="5" />
            <g fill="none" strokeWidth="5">
              <path d="M36 25 33 38" />
              <path d="M33 38H17" />
              <path d="M17 38 15 57" />
            </g>
            <g fill="none" strokeWidth="4">
              <path d="M35 28 25 31" />
              <path d="M15 57h-4" />
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
