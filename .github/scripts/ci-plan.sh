#!/usr/bin/env bash
# What this CI run has to do. Prints two lines for $GITHUB_OUTPUT:
#
#   code=true|false   false when every changed path is documentation, so the
#                     run builds, tests and deploys nothing
#   reuse_run=<id>|   on a push to master, the pull-request run whose tested
#                     `dist` can be published as it is
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

echo "code=$code"
echo "reuse_run=$reuse"
