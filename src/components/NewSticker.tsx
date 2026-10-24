/** Amber pill on a round or lobby mode that is still inside its window. */
export function NewSticker({ className }: { className?: string }) {
  return <span className={className ? `new-sticker ${className}` : 'new-sticker'}>New</span>;
}
