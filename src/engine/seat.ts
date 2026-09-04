/**
 * Who is in the chair, and where they sit on it.
 *
 * The chair is drawn twice — once as SVG in `Chair.tsx` and once onto a canvas
 * in `drawCard.ts` — and `drawCard`'s own note explains why that duplication is
 * deliberate: `Path2D` takes the component's path data verbatim, so the two are
 * the same numbers copied on purpose rather than a rasterised screenshot.
 *
 * **The pile-on offsets live here instead**, in one place both renderers import,
 * because they are the part that will actually be tuned. A chair whose occupants
 * sat differently on the screen and on the shared PNG would be the card and the
 * screen disagreeing about who lost, which `card.ts` exists to prevent.
 */

/**
 * How many figures get drawn before the label has to carry the rest.
 *
 * Three is what the drawing can hold at the size it renders — about 88px wide on
 * a phone. A fourth is not a smaller figure, it is a smudge, so past this the
 * count goes in the label where it is legible.
 */
export const SEAT_DRAWN_MAX = 3;

/**
 * Where the second and third occupants sit, in the chair's own coordinates —
 * the `viewBox="6 2 50 72"` the component and the card both work in.
 *
 * **Both are offsets from the existing sitter, not new drawings.** That is what
 * keeps a single last place — much the commonest case — byte-identical to what
 * has been shipping, and it is why the viewBox does not have to grow. A wider
 * box would render the chair *shorter* at the same `max-width`, and the height
 * is the entire joke: `.finale` aligns to the floor so three people stand on
 * risers and these ones are sat down at ground level.
 *
 * The first clambers up the backrest, the second is perched on the front edge
 * of the seat with the sitter's arm round them. Ordered, so two occupants always
 * get the same pair as the first two of three.
 */
export const PILE_ONS = [
  { dx: 11, dy: -9 },
  { dx: -14, dy: 10 },
] as const;

/** The offsets for a given number of occupants, the sitter excluded. */
export function pileOns(occupants: number): readonly { dx: number; dy: number }[] {
  return PILE_ONS.slice(0, Math.max(0, Math.min(occupants, SEAT_DRAWN_MAX) - 1));
}

/**
 * The names under the chair.
 *
 * Up to three read as a list. Past that the tail becomes a count: `.seat__name`
 * is capped at 7rem over a column barely wider than the chair, so a fourth name
 * does not fail to fit — it wraps the whole label into a paragraph and pushes the
 * chair down the podium, which is the one thing the layout cannot take.
 */
export function seatLabel(names: readonly string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0] ?? '';

  if (names.length > SEAT_DRAWN_MAX) {
    return `${names.slice(0, 2).join(', ')} & ${names.length - 2} more`;
  }

  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1] ?? ''}`;
}

/**
 * How far back the extra occupants sit, as an alpha.
 *
 * **Duplicated in `.seat__sitter--behind` in `global.css`**, which cannot import
 * this. That is the same hand-kept pairing as the chair's own path data, for the
 * same reason: changing one means changing both on purpose.
 */
export const SEAT_BEHIND_ALPHA = 0.55;
