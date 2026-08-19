import { useState } from 'react';
import { SQUADS } from '../engine/squad';
import { rememberSquad } from '../lib/rememberedSquad';
import { setSquad } from '../lib/season';

interface SquadPanelProps {
  playerId: string;
  /** What the board currently says, which may be a name from the free-text era. */
  current: string;
  /** Re-reads the table, so the row updates under the panel that changed it. */
  onChanged: () => void;
}

type State = { state: 'idle' } | { state: 'saving' } | { state: 'error'; message: string };

/**
 * Changing the squad on your own season record.
 *
 * **This is the control the code has claimed existed since squads shipped.**
 * `src/lib/season.ts` said taking a squad off a record "is done by editing it
 * on the season screen"; the screen had a filter and nothing else, and banking
 * treats an empty squad as "keep what is there" — so a squad, once written,
 * could not be changed or removed by any means short of the Firebase console.
 * A three-item picker on the landing screen makes a wrong choice one click
 * away, which is what finally made the gap worth closing.
 *
 * Shown only once a round has been banked, because there is no document to
 * amend before that and the rules would refuse an invented one.
 *
 * It writes the browser's remembered squad too. Without that, correcting a
 * record here and then playing again from the same browser would put the old
 * squad straight back on it, and the fix would look like it had not saved.
 */
export function SquadPanel({ playerId, current, onChanged }: SquadPanelProps) {
  const [chosen, setChosen] = useState(current);
  const [save, setSave] = useState<State>({ state: 'idle' });

  const change = (next: string) => {
    setChosen(next);
    setSave({ state: 'saving' });

    setSquad(playerId, next)
      .then(() => {
        rememberSquad(next);
        setSave({ state: 'idle' });
        onChanged();
      })
      .catch((cause: unknown) => {
        // Put the picker back where the board still says it is, so it never
        // shows a squad the record does not have.
        setChosen(current);
        setSave({
          state: 'error',
          message: cause instanceof Error ? cause.message : 'Could not change your squad',
        });
      });
  };

  return (
    /* Same furniture as the recovery panel below it — the two are siblings on
       this screen and should not read as different kinds of thing. */
    <section className="recovery">
      <p className="eyebrow">Your squad</p>

      <label className="field">
        <span className="field__label">Shown against your name on the board</span>
        <select
          className="input"
          value={chosen}
          disabled={save.state === 'saving'}
          onChange={(event) => change(event.target.value)}
        >
          <option value="">No squad</option>
          {SQUADS.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
          {/* A record from before the list existed keeps its own name as an
              option, so opening this panel cannot silently reassign somebody
              by rendering a value none of the options match. */}
          {current && !SQUADS.some((name) => name === current) ? (
            <option value={current}>{current}</option>
          ) : null}
        </select>
      </label>

      {save.state === 'error' ? <p className="notice">{save.message}</p> : null}

      <p className="muted" style={{ fontSize: '0.85rem' }}>
        Changing this fixes every week from here on. A week already played keeps the squad it was
        played under.
      </p>
    </section>
  );
}
