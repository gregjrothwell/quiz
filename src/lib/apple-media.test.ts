import { describe, expect, test } from 'vitest';
import {
  anonymiseStoreUrl,
  isItunesArtworkUrl,
  isItunesPreviewUrl,
  isItunesStoreUrl,
  itunesArtworkSize,
} from './apple-media';

describe('isItunesPreviewUrl', () => {
  test('accepts Apple’s audio CDN on https', () => {
    expect(
      isItunesPreviewUrl(
        'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/ab.m4a',
      ),
    ).toBe(true);
  });

  test('refuses another host, even on https', () => {
    expect(isItunesPreviewUrl('https://example.com/clip.m4a')).toBe(false);
  });
});

describe('isItunesArtworkUrl', () => {
  test('accepts mzstatic thumbs', () => {
    expect(
      isItunesArtworkUrl(
        'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/aa/source/100x100bb.jpg',
      ),
    ).toBe(true);
  });

  test('refuses a hashed still that happens to be a URL', () => {
    expect(isItunesArtworkUrl('https://gregjrothwell.github.io/quiz/packs/images/ab.jpg')).toBe(
      false,
    );
  });
});

describe('isItunesStoreUrl', () => {
  test('accepts a GB Apple Music link', () => {
    expect(
      isItunesStoreUrl('https://music.apple.com/gb/album/mr-brightside/1440717563?i=1440717826'),
    ).toBe(true);
  });
});

describe('anonymiseStoreUrl', () => {
  test('drops the album slug so the sealed pack cannot name the track', () => {
    expect(
      anonymiseStoreUrl(
        'https://music.apple.com/gb/album/mr-brightside/1440717563?i=1440717826&uo=4',
      ),
    ).toBe('https://music.apple.com/gb/album/1440717563?i=1440717826&uo=4');
  });

  test('drops a TV season slug the same way', () => {
    expect(anonymiseStoreUrl('https://music.apple.com/gb/tv-season/breaking-bad-season-1/123')).toBe(
      'https://music.apple.com/gb/tv-season/123',
    );
  });
});

describe('itunesArtworkSize', () => {
  test('asks for a 600px square', () => {
    const small =
      'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/aa/source/100x100bb.jpg';
    expect(itunesArtworkSize(small, 600)).toBe(
      'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/aa/source/600x600bb.jpg',
    );
  });
});
