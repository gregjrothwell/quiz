import { cardModel, type CardInput, type CardModel, type CardRosette } from '../engine/card';
import { pileOns, seatLabel, SEAT_BEHIND_ALPHA } from '../engine/seat';

/**
 * Drawing the card, kept out of the main bundle.
 *
 * Nothing here is imported at the top of anything: `Final` reaches it with a
 * dynamic `import()` on the press, so a player who never shares a round never
 * downloads a line of it. That is the same reasoning that made `Preview` and
 * `Season` lazy, applied to a module almost nobody will ever run.
 */

/** Link-preview proportions, which is how a chat client will show it. */
export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

/** Straight off `src/design/global.css`. Duplicated because canvas cannot read CSS. */
const INK = '#eef6ff';
const INK_SOFT = '#9fb8cf';
const INK_DIM = '#5d7794';
const NIGHT = '#010610';
const PANEL = '#071a2e';
const EDGE = '#12405f';
const CYAN = '#29d6ff';
const AMBER = '#ffb226';

const SHOUT = 'Anton';
const TECH = '"Chakra Petch"';
const BODY = 'Archivo';

/**
 * The faces the card draws with, at a weight and size the browser will actually
 * resolve. **This is the thing that will bite.**
 *
 * A canvas asked for a font it does not yet have falls back to a system face and
 * says nothing — so a card drawn before the webfonts land is legible, ugly, and
 * indistinguishable from a design mistake. The page loads these with
 * `font-display: swap`, which means the document renders long before they are
 * ready, so "the screen looks right" is not evidence that the canvas will.
 */
const FACES = [`400 96px ${SHOUT}`, `600 32px ${TECH}`, `700 32px ${TECH}`, `400 24px ${BODY}`];

/**
 * The sentence over the podium.
 *
 * **This mirrors `Final.tsx` deliberately** — a card that called the same round
 * something different from the screen it was made on would be the one failure
 * `cardModel` exists to prevent. The engine hands over names; the wording lives
 * here and there, on the same split as the awards panel.
 */
function headline(winners: readonly string[]): string {
  if (winners.length === 0) return 'That’s a wrap';
  if (winners.length > 1) return `${winners.join(' & ')} — dead heat`;
  return `${winners[0]} takes it`;
}

/** Matches `describe()` in `Awards.tsx`, minus the sentence underneath. */
const ROSETTE_TITLES: Record<CardRosette['id'], string> = {
  fastest: 'Fastest finger',
  comeback: 'Comeback of the night',
  'lone-wolf': 'The only one who knew',
  contrarian: 'Boldly wrong',
};

function fitted(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: (size: number) => string,
  maxWidth: number,
  from: number,
  to: number,
): number {
  let size = from;
  while (size > to) {
    ctx.font = font(size);
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  ctx.font = font(size);
  return size;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

const RAD = Math.PI / 180;

/**
 * The office swivel chair, ported line for line from `Chair.tsx`.
 *
 * Ported rather than rasterised: an `<svg>` drawn through an `Image` would be
 * one more asynchronous thing that can quietly fail, and `Path2D` takes SVG path
 * data verbatim — so the arcs, the slump and the askew angle are the same
 * numbers the component uses, and changing one means changing both on purpose.
 *
 * **Why it is here at all**, from that component's own note: the joke is
 * entirely in the height. Three people stand on risers and this one is sat down
 * next to them at ground level, and no caption does that work as well as the
 * eye-line does. The card had a caption — *"Alex takes the chair"* — and this
 * replaces it.
 *
 * The source viewBox is `6 2 50 72`, so the drawing is translated by that origin
 * before anything else and everything below is in the component's coordinates.
 */
function drawChair(
  ctx: CanvasRenderingContext2D,
  middle: number,
  floor: number,
  height: number,
  /** How many finished level at the bottom. A dead heat piles them all on. */
  occupants: number,
) {
  const scale = height / 72;

  ctx.save();
  ctx.translate(middle - (50 * scale) / 2, floor - height);
  ctx.scale(scale, scale);
  ctx.translate(-6, -2);

  // Askew, as though it has been pushed back rather than tucked in.
  ctx.translate(31, 64);
  ctx.rotate(-3 * RAD);
  ctx.translate(-31, -64);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK_DIM;
  ctx.lineWidth = 2.6;

  // The backrest carries a rotation of its own, inside the chair's.
  ctx.save();
  ctx.translate(45, 40);
  ctx.rotate(10 * RAD);
  ctx.translate(-45, -40);
  roundedRect(ctx, 40, 8, 10, 32, 5);
  ctx.stroke();
  ctx.restore();

  roundedRect(ctx, 13, 40, 32, 7, 3.5);
  ctx.stroke();

  for (const d of ['M43 30H21a3 3 0 0 0-3 3v7', 'M29 47v10', 'm29 57-14 8M29 57l14 8M29 57v9']) {
    ctx.stroke(new Path2D(d));
  }

  for (const [x, y] of [[13.5, 66.5], [44.5, 66.5], [29, 68]] as const) {
    ctx.beginPath();
    ctx.arc(x, y, 2.3, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Anybody else who tied for last, behind the sitter and faded — the canvas
  // half of `.seat__sitter--behind`. The offsets come from `engine/seat.ts`
  // rather than being copied, because they are the part that gets tuned and a
  // chair that piled up differently here would be the card and the screen
  // disagreeing about who lost.
  for (const { dx, dy } of pileOns(occupants)) {
    ctx.save();
    ctx.globalAlpha = SEAT_BEHIND_ALPHA;
    ctx.translate(dx, dy);
    ctx.strokeStyle = INK_SOFT;
    ctx.fillStyle = INK_SOFT;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(34, 18, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 4.5;
    ctx.stroke(new Path2D('M35 24 33 34'));
    ctx.lineWidth = 3.5;
    ctx.stroke(new Path2D('M34 27 27 30'));
    ctx.restore();
  }

  // Head forward of the shoulders and an arm gone limp over the rest. The slump
  // is the whole characterisation.
  ctx.strokeStyle = INK_SOFT;
  ctx.fillStyle = INK_SOFT;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(34, 18, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.lineWidth = 5;
  for (const d of ['M36 25 33 38', 'M33 38H17', 'M17 38 15 57']) ctx.stroke(new Path2D(d));

  ctx.lineWidth = 4;
  for (const d of ['M35 28 25 31', 'M15 57h-4']) ctx.stroke(new Path2D(d));

  ctx.restore();
}

/** Left to right, so the winner stands in the middle as they do on screen. */
const RISER_ORDER = [1, 0, 2] as const;

/**
 * By finishing position, tallest first.
 *
 * **The floor is 152 and that is load-bearing**, not a look. The three lines
 * inside a riser — position, name, score — are laid out from its top and reach
 * 132px, so a third-place riser shorter than that drops its score out of the
 * bottom of its own box. The first draft used 104 and did exactly that, which is
 * invisible until you look at the picture: nothing throws, and the number is
 * still perfectly legible sitting in mid-air.
 */
const RISER_HEIGHTS = [200, 172, 152] as const;

const CHAIR_WIDTH = 168;
const CHAIR_HEIGHT = 138;

/**
 * The three risers and, when the round seated somebody, the chair on the floor
 * beside them — one row, one floor, exactly as `.finale--seated` lays it out.
 */
function drawPodium(ctx: CanvasRenderingContext2D, card: CardModel, floor: number): void {
  const width = 236;
  const gap = 26;
  const risers = width * 3 + gap * 2;
  const total = card.chair ? risers + gap + CHAIR_WIDTH : risers;
  const left = (CARD_WIDTH - total) / 2;

  if (card.chair) {
    const middle = left + risers + gap + CHAIR_WIDTH / 2;
    const top = floor - CHAIR_HEIGHT;

    // Above the chair, not below it: on screen the label sits on top because
    // the column is floor-aligned and anything underneath props the chair up.
    // Formatted by the same function the screen uses, so a three-way tie reads
    // "Alice, Bob & Cara" in both places rather than in one.
    const label = seatLabel(card.chair.names);

    ctx.textAlign = 'center';
    ctx.fillStyle = INK_SOFT;
    fitted(ctx, label, (s) => `400 ${s}px ${SHOUT}, Impact, sans-serif`, CHAIR_WIDTH, 30, 16);
    ctx.fillText(label, middle, top - 42);

    ctx.fillStyle = INK_DIM;
    ctx.font = `600 22px ${TECH}, monospace`;
    ctx.fillText(card.chair.score.toLocaleString('en-GB'), middle, top - 14);

    drawChair(ctx, middle, floor, CHAIR_HEIGHT, card.chair.names.length);
  }

  RISER_ORDER.forEach((rowIndex, slot) => {
    const row = card.podium[rowIndex];
    if (!row) return;

    const height = RISER_HEIGHTS[rowIndex] ?? 104;
    const x = left + slot * (width + gap);
    const y = floor - height;

    ctx.fillStyle = PANEL;
    roundedRect(ctx, x, y, width, height, 6);
    ctx.fill();
    ctx.strokeStyle = rowIndex === 0 ? CYAN : EDGE;
    ctx.lineWidth = rowIndex === 0 ? 2 : 1;
    ctx.stroke();

    ctx.textAlign = 'center';
    const middle = x + width / 2;

    ctx.fillStyle = rowIndex === 0 ? CYAN : INK_DIM;
    ctx.font = `700 28px ${TECH}, monospace`;
    ctx.fillText(`${row.position}`, middle, y + 44);

    ctx.fillStyle = INK;
    fitted(ctx, row.name, (s) => `400 ${s}px ${SHOUT}, Impact, sans-serif`, width - 28, 42, 20);
    ctx.fillText(row.name, middle, y + 94);

    ctx.fillStyle = rowIndex === 0 ? AMBER : INK_SOFT;
    ctx.font = `600 28px ${TECH}, monospace`;
    ctx.fillText(row.score.toLocaleString('en-GB'), middle, y + 132);
  });
}

/**
 * Renders the card and hands back a PNG.
 *
 * Async only because of the fonts — everything after the await is synchronous
 * drawing onto an off-screen canvas that is never attached to the document.
 */
export async function drawCard(card: CardModel): Promise<Blob> {
  await Promise.all(FACES.map((face) => document.fonts.load(face)));

  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser would not give the card a canvas to draw on.');

  ctx.fillStyle = NIGHT;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // The cyan wash the studio backdrop has, without the animation.
  const wash = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  wash.addColorStop(0, 'rgba(41, 214, 255, 0.10)');
  wash.addColorStop(0.55, 'rgba(41, 214, 255, 0.02)');
  wash.addColorStop(1, 'rgba(255, 178, 38, 0.06)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  ctx.strokeStyle = EDGE;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, CARD_WIDTH - 2, CARD_HEIGHT - 2);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = CYAN;
  ctx.font = `600 22px ${TECH}, monospace`;
  const eyebrow = card.pack ? card.pack.toUpperCase() : 'THE OFFICE QUIZ';
  ctx.fillText(eyebrow, 56, 74);

  ctx.fillStyle = INK;
  fitted(
    ctx,
    headline(card.winners),
    (s) => `400 ${s}px ${SHOUT}, Impact, sans-serif`,
    CARD_WIDTH - 112,
    82,
    36,
  );
  ctx.fillText(headline(card.winners), 56, 156);

  drawPodium(ctx, card, 494);

  // Rosettes only when this device watched the whole round. Null is not an
  // empty list here: see `CardModel`.
  if (card.rosettes && card.rosettes.length > 0) {
    ctx.textAlign = 'center';
    ctx.font = `400 20px ${BODY}, sans-serif`;
    ctx.fillStyle = INK_DIM;
    const line = card.rosettes
      .map((rosette) => `${ROSETTE_TITLES[rosette.id]}: ${rosette.names.join(' & ')}`)
      .join('   ·   ');
    fitted(ctx, line, (s) => `400 ${s}px ${BODY}, sans-serif`, CARD_WIDTH - 112, 20, 13);
    ctx.fillText(line, CARD_WIDTH / 2, CARD_HEIGHT - 62);
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = INK_DIM;
  ctx.font = `600 18px ${TECH}, monospace`;
  ctx.fillText(
    `${card.questionCount} QUESTIONS · ${new Date(card.at).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })}`,
    56,
    CARD_HEIGHT - 26,
  );

  ctx.textAlign = 'right';
  ctx.fillStyle = CYAN;
  ctx.font = `400 22px ${SHOUT}, Impact, sans-serif`;
  ctx.fillText('VIBE QUIZ', CARD_WIDTH - 56, CARD_HEIGHT - 26);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The card could not be turned into an image.'));
    }, 'image/png');
  });
}

/** Which route actually got the card to the player, so the button can say so. */
export type Delivery = 'clipboard' | 'share' | 'download';

function canWriteImages(): boolean {
  return typeof ClipboardItem !== 'undefined' && typeof navigator.clipboard?.write === 'function';
}

/**
 * Hands the card over by whichever route this browser has.
 *
 * **Clipboard first, because the job is "paste it into Teams".** A file in the
 * downloads folder is two more steps than anybody will take on the way back to a
 * chat window.
 *
 * Nothing here asserts which browsers support what. Every route is tried and the
 * next one runs if it throws, so a browser that has none of the first two still
 * ends up with a file — and the button reports which one happened rather than
 * claiming.
 *
 * **The blob arrives as a promise on purpose.** Writing to the clipboard is
 * gated on the user gesture that started it, and awaiting the drawing first can
 * outlive that gesture; `ClipboardItem` takes a promise for exactly this reason,
 * so the write is issued inside the gesture and resolves later. The other two
 * routes are fallbacks and can await normally.
 */
export async function deliverCard(drawing: Promise<Blob>, filename: string): Promise<Delivery> {
  if (canWriteImages()) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': drawing })]);
      return 'clipboard';
    } catch {
      // Denied, unsupported, or the gesture expired. Fall through to a route
      // that does not need permission.
    }
  }

  const blob = await drawing;
  const file = new File([blob], filename, { type: 'image/png' });

  if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'share';
    } catch {
      // Includes the player simply dismissing the sheet, which is why this is
      // not reported as a failure — they still get the download below.
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  // Revoked on the next turn of the loop: revoking synchronously can beat the
  // click through in some browsers and save an empty file.
  setTimeout(() => URL.revokeObjectURL(url), 0);

  return 'download';
}

/**
 * The whole job, from the round to something in the player's hands.
 *
 * `Final` calls this and nothing else, which is what keeps the date honest:
 * **`at` is stamped here rather than passed in.** Reading the clock is impure,
 * and a component may not do it during render — the React Compiler refuses the
 * call outright — so the moment lives on this side of the boundary, where it is
 * ordinary code. It is the moment the card was made, which for a screen nobody
 * lingers on is the round.
 */
export async function shareRound(
  round: Omit<CardInput, 'at'>,
  filename: string,
): Promise<Delivery> {
  const card = cardModel({ ...round, at: Date.now() });
  const drawing = drawCard(card);

  // `deliverCard` awaits the same promise and reports the failure; without this
  // a rejected drawing is also an unhandled rejection.
  drawing.catch(() => undefined);

  return await deliverCard(drawing, filename);
}
