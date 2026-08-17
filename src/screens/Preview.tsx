import type { ReactNode } from 'react';
import { ColdOpen } from '../components/ColdOpen';
import { LeagueBoard } from '../components/LeagueBoard';
import { RecoveryPanel } from '../components/RecoveryPanel';
import type { QuestionRecord } from '../engine/awards';
import { createRoom, type QuizQuestion, type RoomState } from '../engine/state';
import type { SeasonRow } from '../lib/season';
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

/**
 * A full round in a full office, which is the shape the screens are actually
 * used at and the one the four-player fixtures above quietly flatter. Fifteen
 * rungs and a long prompt is what pushed the desk below the fold on the
 * quizmaster's laptop.
 */
const LONG_ROUND: QuizQuestion[] = Array.from({ length: 15 }, (_, index) => ({
  id: `long-${index}`,
  prompt:
    index === 0
      ? 'Which of these four British sitcoms, all first broadcast between 1975 and 1982, ran for the greatest number of episodes across its original run?'
      : `Placeholder question ${index + 1}`,
  options: [
    'Fawlty Towers, written by John Cleese and Connie Booth',
    'The Good Life, set in suburban Surbiton',
    'Yes Minister, and its later sequel Yes, Prime Minister',
    'To the Manor Born, starring Penelope Keith',
  ],
  correctIndex: 2,
  category: 'Entertainment: Television',
  difficulty: index > 9 ? 'hard' : index > 4 ? 'medium' : 'easy',
}));

const CROWD = Object.fromEntries(
  ['Greg', 'Sam', 'Priya', 'Alex', 'Jo', 'Nadia', 'Tom', 'Rhian', 'Marcus', 'Bea'].map((name) => [
    name.toLowerCase(),
    { name, joinedAt: 100 },
  ]),
);

const PACKS: PackSummary[] = [
  {
    id: 'uk-leaning',
    title: 'Best of British',
    blurb: 'Questions that land better here.',
    count: 133,
    // Deliberately thin at the top: this is the fixture that shows the level
    // picker disabling a level the pack cannot fill.
    counts: { easy: 31, medium: 86, hard: 16 },
  },
  {
    id: 'general-knowledge',
    title: 'General Knowledge',
    blurb: 'A bit of everything.',
    count: 1393,
    counts: { easy: 147, medium: 99, hard: 49 },
  },
  {
    id: 'music',
    title: 'Music',
    blurb: 'Chart history and one-hit wonders.',
    count: 350,
    counts: { easy: 100, medium: 200, hard: 50 },
  },
  {
    id: 'sport',
    title: 'Sport',
    blurb: 'Pitches, tracks and podiums.',
    count: 81,
    counts: { easy: 40, medium: 41, hard: 0 },
  },
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

/**
 * A two-question game built to earn all four rosettes: Greg in on the buzzer and
 * the only one who knew it, Sam overhauling him on the last question, and Alex
 * out on his own on a wrong answer.
 */
const AWARDED_GAME: QuestionRecord[] = [
  {
    index: 0,
    correctIndex: 0,
    answers: {
      greg: { optionIndex: 0, elapsedMs: 900 },
      sam: { optionIndex: 1, elapsedMs: 2_000 },
      priya: { optionIndex: 1, elapsedMs: 2_400 },
      alex: { optionIndex: 3, elapsedMs: 3_000 },
    },
    deltas: { greg: 955, sam: 0, priya: 0, alex: 0 },
  },
  {
    index: 1,
    correctIndex: 0,
    answers: {
      sam: { optionIndex: 0, elapsedMs: 1_500 },
      priya: { optionIndex: 0, elapsedMs: 4_000 },
      greg: { optionIndex: 2, elapsedMs: 2_000 },
      alex: { optionIndex: 2, elapsedMs: 5_000 },
    },
    deltas: { sam: 1_000, priya: 800, greg: 0, alex: 0 },
  },
];

/**
 * A two-question game built for the review panel rather than the rosettes: the
 * first question beat all four of them, and all four had the second. Both
 * highlights need a whole room to be true of, so nothing here works with fewer.
 */
const REVIEWED_GAME: QuestionRecord[] = [
  {
    index: 0,
    correctIndex: 0,
    answers: {
      greg: { optionIndex: 1, elapsedMs: 2_000 },
      sam: { optionIndex: 2, elapsedMs: 2_400 },
      priya: { optionIndex: 3, elapsedMs: 3_000 },
      alex: { optionIndex: 1, elapsedMs: 4_000 },
    },
    deltas: { greg: 0, sam: 0, priya: 0, alex: 0 },
  },
  {
    index: 1,
    correctIndex: 0,
    answers: {
      greg: { optionIndex: 0, elapsedMs: 900 },
      sam: { optionIndex: 0, elapsedMs: 1_500 },
      priya: { optionIndex: 0, elapsedMs: 2_000 },
      alex: { optionIndex: 0, elapsedMs: 2_600 },
    },
    deltas: { greg: 1_000, sam: 900, priya: 800, alex: 700 },
  },
];

/**
 * A season board with two leagues, somebody in neither, and a row from before
 * leagues existed — which is what most of the live board still looks like.
 */
const SEASON_ROWS: SeasonRow[] = [
  { playerId: 'sam', name: 'Sam', team: 'Engineering', played: 12, wins: 5, points: 41_200,
    best: 8_150, fastest: 3, comeback: 1, loneWolf: 2, contrarian: 0 },
  { playerId: 'greg', name: 'Greg', team: 'Engineering', played: 14, wins: 4, points: 38_900,
    best: 7_400, fastest: 2, comeback: 2, loneWolf: 0, contrarian: 1 },
  { playerId: 'priya', name: 'Priya', team: 'Marketing', played: 11, wins: 3, points: 33_100,
    best: 6_900, fastest: 1, comeback: 0, loneWolf: 1, contrarian: 0 },
  { playerId: 'alex', name: 'Alex', team: '', played: 9, wins: 1, points: 24_050,
    best: 5_200, fastest: 0, comeback: 1, loneWolf: 0, contrarian: 3 },
  { playerId: 'nadia', name: 'Nadia', team: 'Marketing', played: 4, wins: 0, points: 9_800,
    best: 3_100, fastest: 0, comeback: 0, loneWolf: 0, contrarian: 0 },
];

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
      node: <Landing busy={false} error={null} onCreate={noop} onJoin={noop} onSeason={noop} />,
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
      title: 'Question · walked in on it',
      node: (
        <QuestionScreen
          room={mockRoom({ phase: 'question', questionOpenedAt: 1_000 })}
          youUid="greg"
          isQuizmaster={false}
          clock={CLOCK}
          joinedMidQuestion
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
      title: 'Question · a full round, a full office',
      node: (
        <QuestionScreen
          room={mockRoom({
            phase: 'question',
            questionOpenedAt: 1_000,
            questions: LONG_ROUND,
            index: 6,
            players: CROWD,
            answers: {
              sam: { optionIndex: 0, elapsedMs: 2_300 },
              priya: { optionIndex: 2, elapsedMs: 3_100 },
              jo: { optionIndex: 2, elapsedMs: 4_800 },
              marcus: { optionIndex: 1, elapsedMs: 5_500 },
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
      /*
        The same question from the floor rather than the desk, which is the
        view the person running the quiz never sees. It is the screen above
        minus two things: the on-air lamp and the transport.
      */
      title: 'Question · what a player sees',
      node: (
        <QuestionScreen
          room={mockRoom({
            phase: 'question',
            questionOpenedAt: 1_000,
            questions: LONG_ROUND,
            index: 6,
            players: CROWD,
            answers: {
              sam: { optionIndex: 0, elapsedMs: 2_300 },
              priya: { optionIndex: 2, elapsedMs: 3_100 },
              jo: { optionIndex: 2, elapsedMs: 4_800 },
              marcus: { optionIndex: 1, elapsedMs: 5_500 },
            },
          })}
          youUid="nadia"
          isQuizmaster={false}
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
            // Spread on purpose, so the gallery shows the replay doing its job:
            // a pile-on to one lectern early, and Priya arriving alone on the
            // right answer six seconds later.
            answers: {
              sam: { optionIndex: 2, elapsedMs: 2_300 },
              greg: { optionIndex: 2, elapsedMs: 4_100 },
              alex: { optionIndex: 3, elapsedMs: 5_200 },
              priya: { optionIndex: 0, elapsedMs: 8_900 },
            },
            // Every answerer, including a zero for each of the three who got it
            // wrong. That is what `tallyQuestion` produces, and the verdict now
            // reads absence from here as "your answer never reached the room" —
            // so a fixture that names only the scorer would show the other three
            // a fault that did not happen.
            lastDeltas: { sam: 0, greg: 0, alex: 0, priya: 555 },
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
      /*
        The answer that was written inside the window and was not in the room
        when the question was scored. Greg picked the right lectern and has no
        delta, which used to render as "Correct · +0".
      */
      title: 'Reveal · answer didn’t land',
      node: (
        <QuestionScreen
          room={mockRoom({
            phase: 'reveal',
            answers: {
              sam: { optionIndex: 2, elapsedMs: 2_300 },
              priya: { optionIndex: 0, elapsedMs: 4_100 },
              greg: { optionIndex: 0, elapsedMs: 9_850 },
            },
            lastDeltas: { sam: 0, priya: 795 },
          })}
          youUid="greg"
          isQuizmaster={false}
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
          log={[]}
          onPlayAgain={noop}
          onLeave={noop}
          onSeason={noop}
        />
      ),
    },
    {
      title: 'Final · with the awards',
      node: (
        <Final
          room={mockRoom({
            phase: 'finished',
            index: 1,
            // Matched to the log below, so the podium and the rosettes are
            // telling the same story rather than two unrelated ones.
            scores: { sam: 1_000, greg: 955, priya: 800, alex: 0 },
          })}
          youUid="greg"
          isQuizmaster
          log={AWARDED_GAME}
          onPlayAgain={noop}
          onLeave={noop}
          onSeason={noop}
        />
      ),
    },
    {
      title: 'Season · the league board',
      node: <LeagueBoard rows={SEASON_ROWS} youPlayerId="greg" />,
    },
    {
      title: 'Cold open · the opening titles',
      node: (
        <ColdOpen
          facts={[
            { id: 'champion', uids: ['greg'], wins: 4 },
            { id: 'best', uids: ['sam'], points: 8_150 },
            { id: 'rosettes', uids: ['priya', 'sam'], count: 6 },
            { id: 'newcomers', uids: ['alex'] },
          ]}
          players={PLAYERS}
          isQuizmaster
          onStart={noop}
          onBack={noop}
        />
      ),
    },
    {
      title: 'Cold open · a room with no history',
      node: (
        <ColdOpen
          facts={[{ id: 'newcomers', uids: ['greg', 'sam', 'priya'] }]}
          players={PLAYERS}
          isQuizmaster={false}
          onStart={noop}
          onBack={noop}
        />
      ),
    },
    {
      title: 'Recovery · a code already saved',
      node: <RecoveryPanel uid="greg" onClaimed={noop} initialCode="ABCD3F7H" />,
    },
    {
      title: 'Recovery · nothing saved yet',
      node: <RecoveryPanel uid="greg" onClaimed={noop} initialCode={null} />,
    },
    {
      title: 'Final · the round in review',
      node: (
        <Final
          room={mockRoom({
            phase: 'finished',
            index: 1,
            scores: { greg: 1_000, sam: 900, priya: 800, alex: 700 },
          })}
          youUid="greg"
          isQuizmaster
          log={REVIEWED_GAME}
          onPlayAgain={noop}
          onLeave={noop}
          onSeason={noop}
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
