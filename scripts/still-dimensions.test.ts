import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import {
  dimensionsOf,
  jpegDimensions,
  pngDimensions,
  sizeQuestions,
  type SizedQuestion,
} from './still-dimensions';

/**
 * The header reader that gives every published still its box.
 *
 * Offline and static, like `seal.test.ts` — it reads the files already in the
 * repo. A build-time script that only ever runs on a Mac would have been three
 * lines of `sips`; this is here instead so it can be checked in CI, and so a
 * malformed image fails the run that wrote it.
 *
 * **Checked against `sips` on 21 September 2026 before any of it was believed**:
 * all 179 hashed stills, zero disagreements. A new measuring tool that has only
 * ever been compared with itself is not evidence — see
 * `~/clawd/context/workflow/EVIDENCE.md`.
 */

const IMAGES = resolve(import.meta.dirname, '../public/packs/images');
const PACKS = resolve(import.meta.dirname, '../public/packs');

describe('still dimensions', () => {
  test('reads every hashed still in the repo', () => {
    // #given every image a pack can point at
    const files = readdirSync(IMAGES);

    // #when each one's header is read
    const unreadable = files.filter((file) => dimensionsOf(readFileSync(join(IMAGES, file))) === null);

    // #then none of them defeats the parser. A still it cannot measure is a
    // still that publishes with no box, which is the bug this exists to stop.
    expect(unreadable).toEqual([]);
    expect(files.length).toBeGreaterThan(100);
  });

  test('every size is positive and plausible', () => {
    // #given the same files
    // #when measured
    const sizes = readdirSync(IMAGES).map((file) => ({
      file,
      ...dimensionsOf(readFileSync(join(IMAGES, file))),
    }));

    // #then nothing came back as zero or negative — a parser that reads the
    // wrong two bytes tends to return something, not nothing, so "it parsed"
    // is not the check that matters
    for (const size of sizes) {
      expect(size.width, size.file).toBeGreaterThan(0);
      expect(size.height, size.file).toBeGreaterThan(0);
      expect(size.width, size.file).toBeLessThan(20000);
      expect(size.height, size.file).toBeLessThan(20000);
    }
  });

  test('a PNG is read from IHDR, not from wherever the bytes land', () => {
    // #given a minimal PNG header declaring 258×129
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from([0, 0, 0, 13]),
      Buffer.from('IHDR', 'latin1'),
      Buffer.from([0, 0, 1, 2]),
      Buffer.from([0, 0, 0, 129]),
    ]);

    // #when read
    // #then the numbers come back as declared
    expect(pngDimensions(png)).toEqual({ width: 258, height: 129 });
  });

  test('a JPEG Huffman table is not mistaken for a frame', () => {
    // #given a JPEG whose DHT segment (0xC4) sits before the real SOF0, with
    // bytes inside it that would read as a 4×4 image
    const jpeg = Buffer.concat([
      Buffer.from([0xff, 0xd8]),
      // DHT: marker, length 10, then eight bytes of payload
      Buffer.from([0xff, 0xc4, 0x00, 0x0a, 0, 0, 0, 4, 0, 4, 0, 0]),
      // SOF0: marker, length 11, precision, height 200, width 300, …
      Buffer.from([0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0xc8, 0x01, 0x2c, 0x01, 0x11, 0x00]),
    ]);

    // #when read
    // #then it is the frame that answered, not the table. 0xC4 is in the same
    // numeric range as the SOF markers and carries a length word just like
    // them, so a range check alone returns a confident wrong size.
    expect(jpegDimensions(jpeg)).toEqual({ width: 300, height: 200 });
  });

  test('something that is neither is refused rather than guessed at', () => {
    // #given bytes that are not an image
    // #when read
    // #then null, so `sizeQuestions` reports it as missing instead of writing
    // a made-up box into a pack
    expect(dimensionsOf(Buffer.from('not an image at all', 'utf8'))).toBeNull();
    expect(dimensionsOf(Buffer.alloc(0))).toBeNull();
  });

  test('sizeQuestions leaves a question that already has the right numbers alone', () => {
    // #given the published screens pack, which was sized on 21 September 2026
    const pack = JSON.parse(readFileSync(join(PACKS, 'screens.json'), 'utf8')) as {
      questions: SizedQuestion[];
    };

    // #when it is sized again
    const { sized, missing } = sizeQuestions(pack.questions, IMAGES);

    // #then nothing changed, so a rebuild does not churn the file
    expect(missing).toEqual([]);
    expect(sized).toBe(0);
  });

  test('sizeQuestions reports an image it cannot find instead of throwing', () => {
    // #given a question pointing at a file that is not there
    const questions: SizedQuestion[] = [{ image: 'nothing-by-this-name.jpg' }];

    // #when sized
    const { sized, missing } = sizeQuestions(questions, IMAGES);

    // #then it comes back named, for the caller to fail on with a useful
    // message — the builders turn this into a thrown error at write time
    expect(sized).toBe(0);
    expect(missing).toEqual(['nothing-by-this-name.jpg']);
  });
});
