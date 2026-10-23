interface WhatsNewButtonProps {
  unseen: boolean;
  onClick: () => void;
  /** The lobby header. The landing page keeps the full-size ghost button. */
  small?: boolean;
}

/** The landing's What's new control, dot included, so the lobby can use the same one. */
export function WhatsNewButton({ unseen, onClick, small = false }: WhatsNewButtonProps) {
  return (
    <button
      type="button"
      className={small ? 'btn btn--ghost btn--small' : 'btn btn--ghost'}
      onClick={onClick}
    >
      What&rsquo;s new
      {unseen ? (
        <>
          {' '}
          <span className="new-dot" aria-hidden="true" />
          <span className="sr-only">(new)</span>
        </>
      ) : null}
    </button>
  );
}
