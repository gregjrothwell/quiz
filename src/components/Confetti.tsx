import { useEffect, useRef } from 'react';

/** The house colours, and the green of a share. */
const COLOURS = ['#ffb226', '#ffd479', '#29d6ff', '#eef6ff', '#1fdd8a'];

const PIECES = 150;
/** Long enough for the slowest piece to clear the bottom of a laptop screen. */
const LIFETIME_MS = 3_600;

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  spin: number;
  turn: number;
  colour: string;
}

const between = (low: number, high: number): number => low + Math.random() * (high - low);

/** A single small burst from one point, up and to the right: the Slop Cannon (F4). */
const BURST_PIECES = 60;
const BURST_LIFETIME_MS = 2_500;

/**
 * Two confetti cannons from the bottom corners of the screen, fired once when
 * `fire` turns true. Given `from`, one small cannon at that point instead —
 * the Slop Cannon's paper burst over the Keep / Bin panel (docs/decisions/slop-cannon.md, F4).
 *
 * A canvas rather than a hundred and fifty elements: one layer, painted for
 * three and a half seconds and then cleared, so nothing about it lingers in the
 * page or in the layout. Fixed over the stage and `pointer-events: none`, so it
 * can never be in the way of a button.
 *
 * The caller decides whether it fires at all — reduced motion must not, and the
 * screens that use it already know.
 */
export function Confetti({ fire, from }: { fire: boolean; from?: { x: number; y: number } }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!fire) return;
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const scale = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * scale;
    canvas.height = height * scale;
    ctx.scale(scale, scale);

    const lifetime = from ? BURST_LIFETIME_MS : LIFETIME_MS;
    const pieces: Piece[] = Array.from({ length: from ? BURST_PIECES : PIECES }, (_, index) => {
      if (from) {
        return {
          x: from.x,
          y: from.y,
          vx: between(2, 10),
          vy: -between(6, 14),
          size: between(5, 9),
          spin: between(0, Math.PI * 2),
          turn: between(-0.25, 0.25),
          colour: COLOURS[index % COLOURS.length] ?? '#ffb226',
        };
      }
      const fromLeft = index % 2 === 0;
      return {
        x: fromLeft ? 0 : width,
        y: height,
        vx: (fromLeft ? 1 : -1) * between(3, 11),
        vy: -between(13, 23),
        size: between(6, 11),
        spin: between(0, Math.PI * 2),
        turn: between(-0.25, 0.25),
        colour: COLOURS[index % COLOURS.length] ?? '#ffb226',
      };
    });

    const startedAt = performance.now();
    let last = startedAt;
    let frame = 0;

    const draw = (now: number): void => {
      // Normalised to 60fps, so a 120Hz screen does not fire it twice as hard.
      const step = Math.min(3, (now - last) / (1000 / 60));
      last = now;
      ctx.clearRect(0, 0, width, height);

      const fade = Math.max(0, 1 - Math.max(0, now - startedAt - lifetime * 0.7) / (lifetime * 0.3));
      ctx.globalAlpha = fade;

      for (const piece of pieces) {
        piece.vy += 0.36 * step;
        piece.vx *= 0.99 ** step;
        piece.vy *= 0.99 ** step;
        piece.x += piece.vx * step;
        piece.y += piece.vy * step;
        piece.spin += piece.turn * step;

        ctx.save();
        ctx.translate(piece.x, piece.y);
        ctx.rotate(piece.spin);
        // Squashing the width by the spin is what makes a flat rectangle tumble.
        ctx.scale(Math.cos(piece.spin * 1.7), 1);
        ctx.fillStyle = piece.colour;
        ctx.fillRect(-piece.size / 2, -piece.size / 4, piece.size, piece.size / 2);
        ctx.restore();
      }

      if (now - startedAt < lifetime) {
        frame = requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, width, height);
      }
    };

    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      ctx.clearRect(0, 0, width, height);
    };
  }, [fire, from]);

  return <canvas ref={ref} className="confetti" aria-hidden="true" />;
}
