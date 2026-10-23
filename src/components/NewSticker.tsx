/** Amber pill on a round that is still inside its `newUntil` window. */
export function NewSticker({ className }: { className?: string }) {
  return <span className={className ? `new-sticker ${className}` : 'new-sticker'}>New</span>;
}
