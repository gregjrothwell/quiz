import { describe, expect, test } from 'vitest';
import { MAX_TEAM_LENGTH, cleanTeam, teamKey, teamsOf } from './team';

describe('cleanTeam', () => {
  test('trims what somebody typed', () => {
    // #given a team name with space around it
    // #when it is cleaned
    // #then it is stored without
    expect(cleanTeam('  Engineering  ')).toBe('Engineering');
  });

  test('caps at the length the rules will accept', () => {
    // #given a name longer than the security rules allow
    const long = 'E'.repeat(MAX_TEAM_LENGTH + 20);

    // #when it is cleaned
    const team = cleanTeam(long);

    // #then it is short enough to be written, rather than being refused on the
    // way to the board
    expect(team).toHaveLength(MAX_TEAM_LENGTH);
  });

  test('reads anything that is not a string as no team', () => {
    // #given whatever an earlier build or a bored player left in storage
    // #when it is cleaned
    // #then it is simply no team
    expect(cleanTeam(42)).toBe('');
    expect(cleanTeam(null)).toBe('');
  });
});

describe('teamKey', () => {
  test('matches two spellings of the same team', () => {
    // #given the same team typed three ways
    // #when they are keyed
    // #then they group together on the board
    expect(teamKey(' Engineering ')).toBe(teamKey('engineering'));
    expect(teamKey('ENGINEERING')).toBe(teamKey('Engineering'));
  });

  test('keeps genuinely different teams apart', () => {
    // #given two teams with a similar name
    // #when they are keyed
    // #then nothing merges them — collapsing "Eng" into "Engineering" would need
    // a dictionary, and merging two teams somebody meant to keep apart is worse
    // than showing both
    expect(teamKey('Eng')).not.toBe(teamKey('Engineering'));
  });
});

describe('teamsOf', () => {
  test('lists each team once, however it was spelled', () => {
    // #given a board where the same team was typed two ways
    const rows = [{ team: 'Engineering' }, { team: 'engineering' }, { team: 'Marketing' }];

    // #when the teams are collected
    const teams = teamsOf(rows);

    // #then the filter offers two, not three
    expect(teams).toEqual(['Engineering', 'Marketing']);
  });

  test('ignores rows with no team', () => {
    // #given a board where most people never set one
    const rows = [{ team: 'Support' }, {}, { team: '' }, { team: '   ' }];

    // #when the teams are collected
    const teams = teamsOf(rows);

    // #then only the real one is offered
    expect(teams).toEqual(['Support']);
  });

  test('sorts them, so the filter does not reorder itself', () => {
    // #given teams arriving in points order
    const rows = [{ team: 'Support' }, { team: 'Engineering' }, { team: 'Marketing' }];

    // #when the teams are collected
    const teams = teamsOf(rows);

    // #then they read alphabetically rather than following the leaderboard,
    // which would move the control under somebody's finger between rounds
    expect(teams).toEqual(['Engineering', 'Marketing', 'Support']);
  });
});
