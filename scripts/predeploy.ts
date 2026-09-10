/**
 * Refuses a deploy that would ship the wrong tree. Runs first in
 * `npm run deploy`, before `build`.
 *
 * **Why it exists.** `npm run deploy` builds locally and pushes `dist/` to the
 * `gh-pages` branch. It is a hand-run command and it ships *whatever is checked
 * out*. Twice that is how the App Check debug token reached production — the
 * `import.meta.env.DEV` gate that keeps the token out of the bundle lived on a
 * branch that was not the one being deployed (15 August: no gate anywhere;
 * 10 September: gate on an unmerged branch, deploy came off `master`). See
 * [`docs/decisions/debug-token-leak.md`](../docs/decisions/debug-token-leak.md).
 *
 * So this makes the deploy ref explicit: **on `master`, tree clean, and level
 * with `origin/master`.** That is the only ref that has been reviewed.
 *
 * `DEPLOY_FROM_BRANCH=1 npm run deploy` relaxes the branch and level checks for
 * a genuine hotfix. The tree-clean check always stands — a dirty tree is how
 * uncommitted debugging ships — and `check-bundle` still runs regardless, so a
 * forced branch deploy is loud, not silent.
 *
 * This is the local guard. The durable answer is to deploy from CI, where the
 * debug token is not on the build machine at all —
 * [`docs/decisions/ci-deploy.md`](../docs/decisions/ci-deploy.md).
 */

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** The parts of git state the decision depends on, so the decision is testable. */
export interface GitState {
  branch: string;
  treeClean: boolean;
  headSha: string;
  /** `null` when `origin/master` could not be resolved — e.g. the fetch failed. */
  originMasterSha: string | null;
}

export type Verdict =
  | { ok: true; note: string }
  | { ok: false; reason: string };

const REQUIRED_BRANCH = 'master';

/**
 * Pure: given git state and whether the branch override is set, decide whether
 * the deploy may proceed. `main()` gathers the state; the tests drive this
 * directly, both directions.
 */
export function evaluateDeployRef(state: GitState, allowBranch: boolean): Verdict {
  if (!state.treeClean) {
    return {
      ok: false,
      reason:
        'the working tree has uncommitted changes. A deploy ships the build, not\n'
        + '  the commit, so a dirty tree is how debugging code reaches production.\n'
        + '  Commit or stash, then deploy. (This check is not overridable.)',
    };
  }

  if (allowBranch) {
    return { ok: true, note: `DEPLOY_FROM_BRANCH override — branch and level checks skipped, tree is clean (${short(state.headSha)})` };
  }

  if (state.branch !== REQUIRED_BRANCH) {
    return {
      ok: false,
      reason:
        `you are on \`${state.branch}\`, not \`${REQUIRED_BRANCH}\`.\n`
        + '  `npm run deploy` ships whatever is checked out. The App Check debug\n'
        + '  token shipped twice exactly this way. Merge to master and deploy from\n'
        + '  there.\n\n'
        + '  Genuine hotfix that cannot wait for a merge?\n'
        + '    DEPLOY_FROM_BRANCH=1 npm run deploy',
    };
  }

  if (state.originMasterSha === null) {
    return {
      ok: false,
      reason:
        'could not resolve `origin/master` to check this checkout is current.\n'
        + '  Run `git fetch origin master` and try again, or if you are offline and\n'
        + '  sure master has not moved: DEPLOY_FROM_BRANCH=1 npm run deploy',
    };
  }

  if (state.headSha !== state.originMasterSha) {
    return {
      ok: false,
      reason:
        `local master (${short(state.headSha)}) is not level with origin/master `
        + `(${short(state.originMasterSha)}).\n`
        + '  Pull (or push) so the deploy matches what was reviewed on the remote.',
    };
  }

  return { ok: true, note: `on master, tree clean, level with origin/master (${short(state.headSha)})` };
}

function short(sha: string): string {
  return sha.slice(0, 7);
}

function git(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

/** Best effort: a flaky network should read as "could not verify", not a crash. */
function resolveOriginMaster(): string | null {
  try {
    execFileSync('git', ['fetch', 'origin', REQUIRED_BRANCH, '--quiet'], { stdio: 'ignore' });
  } catch {
    // offline — a stale local ref may still resolve below
  }
  try {
    return git(['rev-parse', `origin/${REQUIRED_BRANCH}`]);
  } catch {
    return null;
  }
}

function gatherState(): GitState {
  return {
    branch: git(['branch', '--show-current']),
    treeClean: git(['status', '--porcelain']) === '',
    headSha: git(['rev-parse', 'HEAD']),
    originMasterSha: resolveOriginMaster(),
  };
}

function main(): void {
  const allowBranch = (process.env.DEPLOY_FROM_BRANCH ?? '') !== '';
  const verdict = evaluateDeployRef(gatherState(), allowBranch);

  if (!verdict.ok) {
    console.error(`\npredeploy: refusing — ${verdict.reason}\n`);
    process.exit(1);
  }

  console.log(`\npredeploy: ${verdict.note}. OK.\n`);
}

// Pure exports above are imported by the test; the IO only runs as a script.
if (process.argv[1] === fileURLToPath(import.meta.url)) main();
