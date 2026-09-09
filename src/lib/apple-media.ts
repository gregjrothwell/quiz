/**
 * Apple CDN allowlists for iTunes previews and artwork.
 *
 * Pack-build bakes these URLs in. The client still refuses anything else, so a
 * poisoned pack cannot make every device fetch an arbitrary host. Hosting the
 * files ourselves is the thing Apple's terms forbid; streaming them from here
 * is the shape they document.
 */

export const ITUNES_PREVIEW_HOST = 'audio-ssl.itunes.apple.com';
export const ITUNES_ARTWORK_HOST = /^is[0-9]-ssl\.mzstatic\.com$/;
export const ITUNES_STORE_HOST = /^(music|itunes)\.apple\.com$/;

function httpsUrl(value: string): URL | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function isItunesPreviewUrl(url: string): boolean {
  const parsed = httpsUrl(url);
  return parsed !== null && parsed.hostname === ITUNES_PREVIEW_HOST;
}

export function isItunesArtworkUrl(url: string): boolean {
  const parsed = httpsUrl(url);
  return parsed !== null && ITUNES_ARTWORK_HOST.test(parsed.hostname);
}

export function isItunesStoreUrl(url: string): boolean {
  const parsed = httpsUrl(url);
  return parsed !== null && ITUNES_STORE_HOST.test(parsed.hostname);
}

/** Drop the SEO slug so a store link in a sealed pack cannot name the work. */
export function anonymiseStoreUrl(url: string): string {
  if (!isItunesStoreUrl(url)) return url;
  return url
    .replace(/\/album\/[^/]+\/(\d+)/, '/album/$1')
    .replace(/\/song\/[^/]+\/(\d+)/, '/song/$1')
    .replace(/\/tv-season\/[^/]+\/(\d+)/, '/tv-season/$1')
    .replace(/\/show\/[^/]+\/(\d+)/, '/show/$1')
    .replace(/\/movie\/[^/]+\/(\d+)/, '/movie/$1');
}

export function itunesArtworkSize(url100: string, size: number): string {
  return url100.replace(/\/100x100bb\.(jpg|png|webp)$/i, `/${size}x${size}bb.$1`);
}
