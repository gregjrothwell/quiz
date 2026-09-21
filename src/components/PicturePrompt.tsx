import {
  JIGSAW_GRID,
  JIGSAW_TILES,
  placementAfterSettles,
  scrambleTiles,
  settledTileCount,
  tileColumn,
  tileRow,
} from '../engine/jigsaw';
import { isItunesArtworkUrl } from '../lib/apple-media';
import { stillSrc, useStillStatus } from '../lib/stills';

interface PicturePromptProps {
  image?: string;
  imageWidth?: number;
  imageHeight?: number;
  artworkUrl?: string;
  credit?: string;
  jigsaw: boolean;
  posterCrop?: boolean;
  questionId: string;
  gameId: string;
  elapsedMs: number;
  durationMs: number;
  revealed: boolean;
}

/**
 * The box a still gets when nothing knows how big it is.
 *
 * Only reached by a question whose pack predates `imageWidth` — every pack in
 * the repo carries real numbers and `seal.test.ts` keeps it that way, but Pages
 * caches these files independently and somebody's phone can hold an older copy.
 * It costs one reflow when the real picture lands, which is still better than
 * the zero height that was there before.
 */
const FALLBACK_RATIO = '16 / 9';

/**
 * Which ratio, if any, the frame has to hold open itself.
 *
 * `null` means the `<img>` does it: width and height attributes on an image are
 * what browsers use to work the box out before the bytes arrive, and letting
 * two mechanisms both claim it is how they end up disagreeing. The frame only
 * steps in where there is no `<img>` to carry the numbers — a jigsaw drawn with
 * background tiles, a square sleeve from Apple, a poster cropped to a square —
 * or where the pack never said.
 */
export function frameRatio(
  square: boolean,
  imageWidth: number | undefined,
  imageHeight: number | undefined,
): string | null {
  if (square) return '1 / 1';
  if (imageWidth !== undefined && imageHeight !== undefined) return null;
  return FALLBACK_RATIO;
}

/**
 * A still, or the same still as a 3×3 that settles on the shared clock.
 *
 * The scramble is seeded from ids every client already holds, so every device
 * sees the same puzzle. Tiles swap home as the window runs; there is nothing
 * to drag, because the vault can only score one option string.
 *
 * Remote artwork is Apple's CDN only. Hashed stills stay on Pages.
 *
 * **The box is reserved before the bytes arrive.** It did not used to be, and
 * that is the whole of what Bret reported on 18 September 2026: an `<img>` at
 * `width:100%; height:auto` with no intrinsic size is zero pixels tall, and
 * with `alt=""` there is nothing on screen at all. It does not read as a
 * picture that is still coming — it reads as a question that has no picture,
 * which is why nobody thought to wait. See `docs/decisions/picture-loading.md`.
 */
export function PicturePrompt({
  image,
  imageWidth,
  imageHeight,
  artworkUrl,
  credit,
  jigsaw,
  posterCrop = false,
  questionId,
  gameId,
  elapsedMs,
  durationMs,
  revealed,
}: PicturePromptProps) {
  const src = stillSrc(image, artworkUrl);
  const { status, attempt, retry } = useStillStatus(src);

  if (!src) return null;

  // Apple's artwork is fetched at 600×600 by the pack builder, so a sleeve is
  // square by construction and needs nothing in the pack to say so.
  const square = jigsaw || posterCrop || isItunesArtworkUrl(src);
  const ratio = frameRatio(square, imageWidth, imageHeight);

  const overlay =
    status === 'failed' ? (
      <div className="still__state still__state--failed" role="status">
        <p className="still__state-text">The picture didn’t load.</p>
        <button type="button" className="btn btn--ghost btn--small" onClick={retry}>
          Try again
        </button>
      </div>
    ) : status === 'slow' ? (
      <div className="still__state" role="status">
        <p className="still__state-text">Picture loading…</p>
      </div>
    ) : null;

  const settled = revealed ? JIGSAW_TILES : settledTileCount(elapsedMs, durationMs);
  const perm = jigsaw ? placementAfterSettles(scrambleTiles(questionId, gameId), settled) : [];

  return (
    // Square and landscape want different room in the side-by-side layout:
    // width binds on a 16:9 still, height binds on a sleeve. See `.qsplit`.
    <figure className={square ? 'still still--square' : 'still'}>
      <div
        className={status === 'ready' ? 'still__frame' : 'still__frame still__frame--waiting'}
        {...(ratio ? { style: { aspectRatio: ratio } } : {})}
      >
        {jigsaw ? (
          <div
            className="jigsaw"
            role="img"
            aria-label="Scrambled picture"
            style={{ gridTemplateColumns: `repeat(${JIGSAW_GRID}, 1fr)` }}
          >
            {perm.map((piece, slot) => (
              <div
                key={slot}
                className="jigsaw__tile"
                style={{
                  backgroundImage: `url(${JSON.stringify(src)})`,
                  backgroundPosition: `${tileColumn(piece) * 50}% ${tileRow(piece) * 50}%`,
                }}
              />
            ))}
          </div>
        ) : (
          <img
            key={attempt}
            className={[
              'still__img',
              posterCrop ? 'still__img--poster' : '',
              // A failed <img> draws the browser's own broken-file glyph in the
              // corner, under the message that already explains it. Two ways of
              // saying the same thing, one of which looks like a second fault.
              status === 'failed' ? 'still__img--gone' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            src={src}
            {...(imageWidth !== undefined && imageHeight !== undefined
              ? { width: imageWidth, height: imageHeight }
              : {})}
            alt=""
          />
        )}
        {overlay}
      </div>
      {credit ? <figcaption className="still__credit">{credit}</figcaption> : null}
    </figure>
  );
}
