import { isItunesStoreUrl } from '../lib/apple-media';

interface StoreBadgeProps {
  href: string;
  /** Previews listen; artwork only views. Same store, different verb. */
  kind?: 'listen' | 'view';
}

/**
 * Apple's "proximate to a store badge" rule: the preview may only play as a
 * promotion of the store item. A text lockup rather than Apple's bitmap so we
 * are not shipping their mark; the words and the link are what the terms ask for.
 */
export function StoreBadge({ href, kind = 'listen' }: StoreBadgeProps) {
  if (!isItunesStoreUrl(href)) return null;
  return (
    <a className="store-badge" href={href} target="_blank" rel="noopener noreferrer">
      {kind === 'view' ? 'View in Apple Music' : 'Listen on Apple Music'}
    </a>
  );
}
