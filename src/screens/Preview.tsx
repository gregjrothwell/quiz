import type { ReactNode } from 'react';
import { createRoom, type QuizQuestion, type RoomState } from '../engine/state';
import type { PackSummary } from '../lib/usePacks';
import { Final } from './Final';
import { Landing } from './Landing';
import { Lobby } from './Lobby';
import { QuestionScreen } from './QuestionScreen';
import { Scoreboard } from './Scoreboard';

/**
 * A design gallery of every screen with fixed data.
 *
 * `#/preview` shows them all; `#/preview/4` shows one on its own. Isolating by
 * re-render rather than by hiding siblings matters: a `display:none` ancestor
 * stops motion's entry animations, leaving anything that fades in stuck at zero
 * opacity and looking like a rendering bug.
 *
 * Exists so the studio look can be reviewed without a Firebase project, a room,
 * or four other people.
 */

const QUESTIONS: QuizQuestion[] = [
  {
    id: 'q1',
    prompt: 'Which London Underground line was the first to be built?',
    options: ['Metropolitan Line', 'Circle Line', 'Bakerloo Line', 'Northern Line'],
    correctIndex: 0,
    category: 'Geography',
    difficulty: 'medium',
  },
  {
    id: 'q2',
    prompt: 'In which British seaside town was the BBC sitcom Fawlty Towers set?',
    options: ['Torquay', 'Brighton', 'Margate', 'Weston-super-Mare'],
    correctIndex: 0,
    category: 'Entertainment: Television',
    difficulty: 'easy',
  },
];

const PLAYERS = {
  greg: { name: 'Greg', joinedAt: 100 },
  sam: { name: 'Sam', joinedAt: 200 },
  priya: { name: 'Priya', joinedAt: 300 },
  alex: { name: 'Alex', joinedAt: 400 },
};

const PACKS: PackSummary[] = [
  {
    id: 'uk-leaning',
    title: 'Best of British',
    blurb: 'Questions that land better here.',
    count: 133,
  },
  {
    id: 'general-knowledge',
    title: 'General Knowledge',
    blurb: 'A bit of everything.',
    count: 1393,
  },
  { id: 'music', title: 'Music', blurb: 'Chart history and one-hit wonders.', count: 350 },
  { id: 'sport', title: 'Sport', blurb: 'Pitches, tracks and podiums.', count: 81 },
];

function mockRoom(overrides: Partial<RoomState> = {}): RoomState {
  return {
    ...createRoom('HKQ7'),
    players: PLAYERS,
    packId: 'uk-leaning',
    packTitle: 'Best of British',
    questions: QUESTIONS,
    scores: { greg: 2450, sam: 3100, priya: 1800, alex: 3100 },
    ...overrides,
  };
}

const CLOCK = { elapsedMs: 6_000, remainingMs: 14_000, secondsLeft: 14, expired: false };
const noop = (): void => undefined;

function selectedIndex(): number | null {
  const match = /^#\/preview\/(\d+)$/.exec(window.location.hash);
  const raw = match?.[1];
  return raw === undefined ? null : Number(raw);
}

export function Preview() {
  const only = selectedIndex();

  const screens: { title: string; node: ReactNode }[] = [
    {
      title: 'Landing',
      node: <Landing busy={false} error={null} onCreate={noop} onJoin={noop} />,
    },
    {
      title: 'Lobby · quizmaster',
      node: (
        <Lobby
          room={mockRoom({ phase: 'lobby' })}
          youUid="greg"
          isQuizmaster
          packs={PACKS}
          busy={false}
          onStart={noop}
          onLeave={noop}
        />
      ),
    },
    {
      title: 'Question · unanswered',
      node: (
        <QuestionScreen
          room={mockRoom({ phase: 'question', questionOpenedAt: 1_000 })}
          youUid="greg"
          isQuizmaster
          clock={CLOCK}
          revealed={false}
          onAnswer={noop}
          onReveal={noop}
          onNext={noop}
        />
      ),
    },
    {
      title: 'Question · answered',
      node: (
        <QuestionScreen
          room={mockRoom({
            phase: 'question',
            questionOpenedAt: 1_000,
            answers: {
              greg: { optionIndex: 2, elapsedMs: 4_100 },
              sam: { optionIndex: 0, elapsedMs: 2_300 },
            },
          })}
          youUid="greg"
          isQuizmaster
          clock={CLOCK}
          revealed={false}
          onAnswer={noop}
          onReveal={noop}
          onNext={noop}
        />
      ),
    },
    {
      title: 'Reveal · wrong answer',
      node: (
        <QuestionScreen
          room={mockRoom({
            phase: 'reveal',
            answers: { greg: { optionIndex: 2, elapsedMs: 4_100 } },
            lastDeltas: { sam: 880 },
          })}
          youUid="greg"
          isQuizmaster
          clock={CLOCK}
          revealed
          onAnswer={noop}
          onReveal={noop}
          onNext={noop}
        />
      ),
    },
    {
      title: 'Standings',
      node: (
        <Scoreboard
          room={mockRoom({ phase: 'scoreboard', lastDeltas: { sam: 880, greg: 0, priya: 640 } })}
          youUid="greg"
          isQuizmaster
          onNext={noop}
        />
      ),
    },
    {
      title: 'Final · tie for first',
      node: (
        <Final
          room={mockRoom({ phase: 'finished', index: 1 })}
          youUid="greg"
          isQuizmaster
          onPlayAgain={noop}
          onLeave={noop}
        />
      ),
    },
  ];

  const shown = only === null ? screens : screens.filter((_, index) => index === only);

  return (
    <>
      {shown.map(({ title, node }) => (
        <section
          key={title}
          style={{
            borderTop: '1px solid var(--edge)',
            paddingTop: '2rem',
            marginTop: '2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: 'clamp(1rem, 3vh, 2rem)',
          }}
        >
          <p className="eyebrow" style={{ color: 'var(--ink-dim)' }}>
            {title}
          </p>
          {node}
        </section>
      ))}
    </>
  );
}
