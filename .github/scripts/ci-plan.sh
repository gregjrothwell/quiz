#!/usr/bin/env bash
# What this CI run has to do. Prints two lines for $GITHUB_OUTPUT:
#
#   code=true|false   false when every changed path is documentation, so the
#                     run builds, tests and deploys nothing
#   reuse_run=<id>|   on a push to master, the pull-request run whose tested
#                     `dist` can be published as it is
#   whats_new=ok|waived|missing|n/a
#                     on a pull request that changes what players see, whether
#                     it carries its line on the What's new page
#   ticket=ok|waived|missing|n/a
#                     on a pull request that builds, whether it names its Jira
#                     ticket (PROJ-<n>)
#
# Why: go-live took ~16 minutes on 22 October 2026, and about 8 of them were
# CI re-running verify and e2e on a tree byte-identical to the one the PR had
# just passed, plus a full build-and-deploy for a docs-only record PR. Greg
# chose to reuse the PR's build (docs/decisions/ci-deploy.md, "Lead time").
#
# A failure here fails the Plan job, and ci.yml then runs the full verify and
# e2e: a skipped job counts as passed for a required check, so the safe answer
# to "the plan broke" is "test everything", never "skip".
#
# Run locally against real history:
#   EVENT=push SHA=<merge sha> GITHUB_REPOSITORY=gregjrothwell/quiz .github/scripts/ci-plan.sh

set -euo pipefail
: "${EVENT:?}" "${GITHUB_REPOSITORY:?}"
SHA="${SHA:-$(git rev-parse HEAD)}"

# Documentation: anything under docs/, and Markdown anywhere except public/,
# which Vite copies into dist (public/packs/ATTRIBUTION.md ships).
docs_only() {
  local any=0 path
  while IFS= read -r path; do
    [ -n "$path" ] || continue
    any=1
    case "$path" in
      public/*) return 1 ;;
      docs/* | *.md) ;;
      *) return 1 ;;
    esac
  done
  [ "$any" = 1 ]
}

# What players see: the app and the packs. Not tests, not the design gallery.
player_facing() {
  local path
  while IFS= read -r path; do
    case "$path" in
      *.test.ts | *.test.tsx | src/test/* | src/screens/Preview.tsx) ;;
      src/* | public/*) return 0 ;;
    esac
  done
  return 1
}

case "$EVENT" in
  pull_request)
    : "${PR_NUMBER:?}"
    changed=$(gh api "repos/$GITHUB_REPOSITORY/pulls/$PR_NUMBER/files" --paginate --jq '.[].filename')
    ;;
  push)
    # The merge's first parent is master before it, so this is exactly what
    # the push changed.
    changed=$(git diff --name-only "$SHA^1" "$SHA")
    ;;
  *)
    # A manual run always does everything.
    changed='(manual run)'
    ;;
esac

code=true
if docs_only <<<"$changed"; then code=false; fi

reuse=''
if [ "$EVENT" = push ] && [ "$code" = true ]; then
  # Every pull-request run's verify job uploads a marker named after the exact
  # tree it built (`tree-<hash>`, ci.yml). If one of them built the tree master
  # has now, its `dist` is this commit's build, byte for byte. That holds for
  # a merge commit and a squash alike, and fails safe when master moved on
  # between the PR's run and the merge: the trees differ, nothing matches, and
  # everything runs.
  tree=$(git rev-parse "$SHA^{tree}")
  runs=$(gh api "repos/$GITHUB_REPOSITORY/actions/artifacts?name=tree-$tree&per_page=20" \
    --jq '.artifacts[] | select(.expired == false) | .workflow_run.id')
  for run in $runs; do
    # Passed, from this workflow, and from a branch of this repository. A fork
    # can name an artefact anything; it cannot push a branch here.
    ok=$(gh api "repos/$GITHUB_REPOSITORY/actions/runs/$run" --jq "
      .event == \"pull_request\" and .conclusion == \"success\"
      and .path == \".github/workflows/ci.yml\"
      and .head_repository.full_name == \"$GITHUB_REPOSITORY\"")
    [ "$ok" = true ] || continue
    live=$(gh api "repos/$GITHUB_REPOSITORY/actions/runs/$run/artifacts?name=dist" \
      --jq '[.artifacts[] | select(.expired == false)] | length')
    if [ "$live" -ge 1 ]; then reuse=$run; break; fi
  done
fi

# A change players can see goes live with its What's new line. #110 shipped
# without one on 22 October 2026, though updates-page.md said the release PR
# adds it; Greg caught it, and a rule nobody runs is a rule that gets missed.
# The waiver is for changes players cannot notice: "What's new: none — why" in
# the PR description or any commit message. ci.yml's verify job fails on
# `missing`, and verify is a required check.
whats_new=n/a
if [ "$EVENT" = pull_request ] && [ "$code" = true ]; then
  if grep -qx 'src/lib/updates.ts' <<<"$changed"; then
    whats_new=ok
  elif player_facing <<<"$changed"; then
    said=$(gh api "repos/$GITHUB_REPOSITORY/pulls/$PR_NUMBER" --jq '.body // ""'
      gh api "repos/$GITHUB_REPOSITORY/pulls/$PR_NUMBER/commits" --paginate --jq '.[].commit.message')
    if grep -qiE "^what(’|')?s new: none" <<<"$said"; then whats_new=waived; else whats_new=missing; fi
  fi
fi

# A pull request names its Jira ticket, so the ticket can follow it to Done.
# PROJ-60 and PROJ-61 went live in #140 on 23 October 2026 and sat at To Do
# for five days: 2 of the 40 PRs before 28 October named a ticket, and the
# rule saying they should was in a file cloud agents never read (PROJ-66).
# Title, branch, description or any commit message will do. Docs-only PRs
# never reach here (code=false), and nor does Dependabot. The waiver is
# "Ticket: none — why", for work that genuinely has no ticket.
ticket=n/a
if [ "$EVENT" = pull_request ] && [ "$code" = true ]; then
  pr=$(gh api "repos/$GITHUB_REPOSITORY/pulls/$PR_NUMBER" --jq '.user.login, .head.ref, .title, (.body // "")')
  if [ "$(head -n1 <<<"$pr")" = 'dependabot[bot]' ]; then
    ticket=n/a
  else
    said=$(printf '%s\n' "$pr"
      gh api "repos/$GITHUB_REPOSITORY/pulls/$PR_NUMBER/commits" --paginate --jq '.[].commit.message')
    if grep -qE 'PROJ-[0-9]+' <<<"$said"; then ticket=ok
    elif grep -qiE '^ticket: none' <<<"$said"; then ticket=waived
    else ticket=missing; fi
  fi
fi

echo "code=$code"
echo "reuse_run=$reuse"
echo "whats_new=$whats_new"
echo "ticket=$ticket"
