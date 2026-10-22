import { useEffect, useMemo, useState } from 'react';
import { EMPTY_FINALS, type FinalsTally } from '../engine/finals';
import { wrappedFor, type WrappedRow } from '../engine/wrapped';
import { loadFinalistRecords } from '../lib/season';

/**
 * Quiz Wrapped (docs/decisions/quiz-wrapped.md): this device's own season as
 * five cards, opened from the season board. Each card is shown as the very
 * PNG that saving it hands over, so what you see is what you share.
 */
export function Wrapped({ row, board, onClose }: { row: WrappedRow; board: readonly WrappedRow[]; onClose: () => void }) {
  // One read of this player's own row for the finals tally, as the final's seats read it.
  const [finals, setFinals] = useState<FinalsTally | null>(null);
  useEffect(() => {
    let live = true;
    loadFinalistRecords([{ uid: row.playerId, playerId: row.playerId }])
      .then((records) => records[row.playerId] ?? EMPTY_FINALS)
      .catch(() => EMPTY_FINALS)
      .then((tally) => {
        if (live) setFinals(tally);
      });
    return () => {
      live = false;
    };
  }, [row.playerId]);

  const cards = useMemo(() => (finals ? wrappedFor(row, board, finals) : []), [row, board, finals]);
  const [at, setAt] = useState(0);
  const card = cards[Math.min(at, cards.length - 1)];
  const page = { at: Math.min(at, cards.length - 1) + 1, of: cards.length };

  const [picture, setPicture] = useState<{ url: string; alt: string } | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (!card) return;
    let url: string | null = null;
    let live = true;
    const shown = { at: Math.min(at, cards.length - 1) + 1, of: cards.length };
    void import('../lib/drawWrapped').then(async ({ drawWrapped, wordsFor }) => {
      const blob = await drawWrapped(card, row.name, shown);
      if (!live) return;
      url = URL.createObjectURL(blob);
      const words = wordsFor(card);
      setPicture({ url, alt: `${words.eyebrow}: ${words.big}. ${words.detail}` });
    });
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [card, row.name, at, cards.length]);

  const save = (): void => {
    if (!card) return;
    setSaved(null);
    void import('../lib/drawWrapped')
      .then(({ shareWrapped }) => shareWrapped(card, row.name, page))
      .then(
        (delivery) => setSaved(delivery === 'download' ? 'Saved.' : delivery === 'clipboard' ? 'Copied — paste it anywhere.' : 'Shared.'),
        () => setSaved('That card would not save. Try again.'),
      );
  };

  return (
    <section className="panel stack wrapped" aria-label="Quiz Wrapped">
      <div className="row row--between">
        <p className="eyebrow">Quiz Wrapped · {row.name}</p>
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          Close
        </button>
      </div>
      {!card ? (
        <p className="lede">Wrapping your season…</p>
      ) : (
        <>
          {picture ? <img className="wrapped__card" src={picture.url} alt={picture.alt} width={1200} height={630} /> : null}
          <div className="row row--between">
            <button type="button" className="btn btn--ghost" disabled={page.at <= 1} onClick={() => setAt(page.at - 2)}>
              Back
            </button>
            <span className="muted" aria-live="polite">
              {page.at} of {page.of}
            </span>
            <button type="button" className="btn btn--ghost" disabled={page.at >= page.of} onClick={() => setAt(page.at)}>
              Next
            </button>
          </div>
          <button type="button" className="btn" onClick={save}>
            Save this card
          </button>
          {saved ? <p className="muted">{saved}</p> : null}
        </>
      )}
    </section>
  );
}
