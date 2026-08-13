import { useEffect, useRef, useState } from 'react';

interface RoomLinkProps {
  link: string;
}

type Status = 'idle' | 'copied' | 'manual';

const FEEDBACK_MS = 2400;

const MESSAGES: Record<Status, string> = {
  idle: 'Paste it into the chat — one tap puts them in this room, code already filled.',
  copied: 'Copied. Paste it into the chat.',
  manual: 'Your browser wouldn’t let us copy — the link is selected, so take it from the box.',
};

/**
 * The link is the path that actually works over a call: the room code has to be
 * read aloud and typed, and the QR needs a second device pointed at a screen,
 * but a link pasted into the chat is one tap for everybody in it.
 *
 * Shown in a box rather than hidden behind the button alone, because a copy
 * button that silently does nothing — which is what a blocked clipboard looks
 * like — leaves somebody pasting the last thing they copied into the chat.
 */
export function RoomLink({ link }: RoomLinkProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>('idle');

  useEffect(() => {
    if (status === 'idle') return;

    const timer = window.setTimeout(() => setStatus('idle'), FEEDBACK_MS);
    return () => window.clearTimeout(timer);
  }, [status]);

  // The clipboard API needs a secure context and a permission the browser can
  // refuse, and on an insecure origin `navigator.clipboard` is missing outright
  // — which throws here rather than rejecting. Both land in the same fallback:
  // select the text and let the reader use their own copy shortcut.
  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(link);
      setStatus('copied');
    } catch {
      inputRef.current?.select();
      setStatus('manual');
    }
  }

  return (
    <div className="share">
      <p className="eyebrow">Send this to the room</p>

      <div className="share__row">
        <input
          ref={inputRef}
          className="input share__link"
          value={link}
          readOnly
          aria-label="Join link for this room"
          onFocus={(event) => event.target.select()}
        />
        <button type="button" className="btn share__copy" onClick={() => void copy()}>
          {status === 'copied' ? 'Copied' : 'Copy link'}
        </button>
      </div>

      <p
        className={status === 'copied' ? 'share__status share__status--copied' : 'share__status'}
        aria-live="polite"
      >
        {MESSAGES[status]}
      </p>
    </div>
  );
}
