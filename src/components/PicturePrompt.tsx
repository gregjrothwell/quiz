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
import { packImageUrl } from '../lib/usePacks';

interface PicturePromptProps {
  image?: string;
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

function srcFor(image: string | undefined, artworkUrl: string | undefined): string | null {
  if (artworkUrl && isItunesArtworkUrl(artworkUrl)) return artworkUrl;
  if (image) return packImageUrl(image);
  return null;
}

/**
 * A still, or the same still as a 3×3 that settles on the shared clock.
 *
 * The scramble is seeded from ids every client already holds, so every device
 * sees the same puzzle. Tiles swap home as the window runs; there is nothing
 * to drag, because the vault can only score one option string.
 *
 * Remote artwork is Apple's CDN only. Hashed stills stay on Pages.
 */
export function PicturePrompt({
  image,
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
  const src = srcFor(image, artworkUrl);
  if (!src) return null;

  if (!jigsaw) {
    return (
      <figure className="still">
        <img
          className={posterCrop ? 'still__img still__img--poster' : 'still__img'}
          src={src}
          alt=""
        />
        {credit ? <figcaption className="still__credit">{credit}</figcaption> : null}
      </figure>
    );
  }

  const settled = revealed ? JIGSAW_TILES : settledTileCount(elapsedMs, durationMs);
  const perm = placementAfterSettles(scrambleTiles(questionId, gameId), settled);

  return (
    <figure className="still">
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
      {credit ? <figcaption className="still__credit">{credit}</figcaption> : null}
    </figure>
  );
}
