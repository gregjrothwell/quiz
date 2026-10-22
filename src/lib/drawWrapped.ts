import type { RosetteId, WrappedCard } from '../engine/wrapped';
import { ordinal } from '../engine/wrapped';
import {
  AMBER,
  BODY,
  CARD_HEIGHT,
  CARD_WIDTH,
  CYAN,
  EDGE,
  FACES,
  INK,
  INK_SOFT,
  NIGHT,
  ROSETTE_TITLES,
  SHOUT,
  TECH,
  deliverCard,
  fitted,
  type Delivery,
} from './drawCard';

/**
 * Quiz Wrapped's cards, drawn on the final card's canvas (docs/decisions/
 * quiz-wrapped.md, W3): the same size, palette and faces, so a Wrapped card
 * and a round's card look like one show. Loaded on the press, like `drawCard`.
 * The words live here; the facts are `engine/wrapped.ts`'s.
 */

const ROSETTE_OF: Record<RosetteId, keyof typeof ROSETTE_TITLES> = {
  fastest: 'fastest',
  comeback: 'comeback',
  loneWolf: 'lone-wolf',
  contrarian: 'contrarian',
};

const n = (value: number): string => value.toLocaleString('en-GB');
const plural = (count: number, one: string, many: string): string => `${n(count)} ${count === 1 ? one : many}`;

/** The three lines of a card: what it is, the big thing, and the detail. */
export function wordsFor(card: WrappedCard): { eyebrow: string; big: string; detail: string } {
  switch (card.kind) {
    case 'numbers':
      return {
        eyebrow: 'Your season',
        big: plural(card.played, 'round', 'rounds'),
        detail: `${plural(card.wins, 'win', 'wins')} · ${n(card.points)} points · best round ${n(card.best)}`,
      };
    case 'rosette':
      return {
        eyebrow: 'Your thing',
        big: ROSETTE_TITLES[ROSETTE_OF[card.id]],
        detail: `${plural(card.count, 'time', 'times')} this season`,
      };
    case 'finals':
      return {
        eyebrow: 'Share or Shaft',
        big: plural(card.finals, 'final', 'finals'),
        detail: `Shared ${n(card.shared)} · shafted ${n(card.shafted)} · got shafted ${n(card.gotShafted)}`,
      };
    case 'squad':
      return {
        eyebrow: 'Your squad',
        big: card.squad,
        detail: `${ordinal(card.position)} of ${plural(card.of, 'squad', 'squads')} on average points`,
      };
    case 'place':
      return {
        eyebrow: 'Where you finished',
        big: ordinal(card.position),
        detail: `of ${n(card.of)} on the season board · top three ${card.top.join(', ')}`,
      };
  }
}

export async function drawWrapped(card: WrappedCard, name: string, page: { at: number; of: number }): Promise<Blob> {
  await Promise.all(FACES.map((face) => document.fonts.load(face)));

  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser would not give the card a canvas to draw on.');

  ctx.fillStyle = NIGHT;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  const wash = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  wash.addColorStop(0, 'rgba(255, 178, 38, 0.12)');
  wash.addColorStop(0.6, 'rgba(41, 214, 255, 0.03)');
  wash.addColorStop(1, 'rgba(41, 214, 255, 0.10)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  ctx.strokeStyle = EDGE;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, CARD_WIDTH - 2, CARD_HEIGHT - 2);

  const words = wordsFor(card);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = CYAN;
  ctx.font = `600 22px ${TECH}, monospace`;
  ctx.fillText(`QUIZ WRAPPED · ${words.eyebrow.toUpperCase()}`, 56, 74);

  ctx.fillStyle = AMBER;
  fitted(ctx, words.big, (size) => `400 ${String(size)}px ${SHOUT}, Impact, sans-serif`, CARD_WIDTH - 112, 160, 60);
  ctx.fillText(words.big, 56, 330);

  ctx.fillStyle = INK;
  fitted(ctx, words.detail, (size) => `400 ${String(size)}px ${BODY}, sans-serif`, CARD_WIDTH - 112, 34, 18);
  ctx.fillText(words.detail, 56, 410);

  ctx.fillStyle = INK_SOFT;
  ctx.font = `600 22px ${TECH}, monospace`;
  ctx.fillText(name.toUpperCase(), 56, CARD_HEIGHT - 56);
  ctx.textAlign = 'right';
  ctx.fillText(`${String(page.at)} / ${String(page.of)}`, CARD_WIDTH - 56, CARD_HEIGHT - 56);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The card could not be drawn.'))), 'image/png');
  });
}

/** Draws a card and hands it over by whichever route the browser supports. */
export async function shareWrapped(card: WrappedCard, name: string, page: { at: number; of: number }): Promise<Delivery> {
  const drawing = drawWrapped(card, name, page);
  drawing.catch(() => undefined);
  return await deliverCard(drawing, `quiz-wrapped-${String(page.at)}.png`);
}
