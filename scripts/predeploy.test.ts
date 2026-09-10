import { describe, expect, it } from 'vitest';

import { evaluateDeployRef, type GitState } from './predeploy';

/**
 * The deploy-ref guard, both directions.
 *
 * The allow case is the one that carries the proof: two new deny cases pass the
 * moment the function exists, because everything is denied until it decides
 * otherwise. Reading `master + clean + level → ok` is what says the guard is
 * discriminating rather than just saying no.
 */

const LEVEL: GitState = {
  branch: 'master',
  treeClean: true,
  headSha: 'a'.repeat(40),
  originMasterSha: 'a'.repeat(40),
};

describe('evaluateDeployRef', () => {
  it('allows master, clean, level with origin/master', () => {
    const v = evaluateDeployRef(LEVEL, false);
    expect(v.ok).toBe(true);
  });

  it('refuses a feature branch without the override', () => {
    const v = evaluateDeployRef({ ...LEVEL, branch: 'seal-token-again' }, false);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toContain('not `master`');
  });

  it('allows a feature branch when DEPLOY_FROM_BRANCH is set, if the tree is clean', () => {
    const v = evaluateDeployRef({ ...LEVEL, branch: 'hotfix' }, true);
    expect(v.ok).toBe(true);
  });

  it('refuses a dirty tree even with the override — that check is not skippable', () => {
    const v = evaluateDeployRef({ ...LEVEL, branch: 'hotfix', treeClean: false }, true);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toContain('uncommitted');
  });

  it('refuses a dirty tree on master', () => {
    const v = evaluateDeployRef({ ...LEVEL, treeClean: false }, false);
    expect(v.ok).toBe(false);
  });

  it('refuses when local master is behind origin/master', () => {
    const v = evaluateDeployRef({ ...LEVEL, headSha: 'b'.repeat(40) }, false);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toContain('not level');
  });

  it('refuses when origin/master could not be resolved', () => {
    const v = evaluateDeployRef({ ...LEVEL, originMasterSha: null }, false);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toContain('origin/master');
  });

  it('the override does not rescue a deploy that is otherwise fine — it is only about the ref', () => {
    // sanity: override on a clean master is still fine, just via the other branch
    const v = evaluateDeployRef(LEVEL, true);
    expect(v.ok).toBe(true);
  });
});
