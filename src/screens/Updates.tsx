import { useEffect } from 'react';
import { markUpdatesSeen, UPDATES } from '../lib/updates';

interface UpdatesProps {
  onBack: () => void;
}

const DAY = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

export function Updates({ onBack }: UpdatesProps) {
  // Opening the page is reading it, so the dot on the landing goes from here.
  useEffect(() => markUpdatesSeen(UPDATES), []);

  return (
    <>
      <header className="row row--between">
        <div>
          <p className="eyebrow">What&rsquo;s new</p>
          <h1 className="display display--screen">Updates</h1>
        </div>
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          Back
        </button>
      </header>

      {UPDATES.map((update) => (
        <section key={update.date} className="panel stack updates__entry">
          <h2 className="display display--panel">
            <time dateTime={update.date}>{DAY.format(new Date(`${update.date}T00:00:00Z`))}</time>
          </h2>
          <ul className="updates__lines">
            {update.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
