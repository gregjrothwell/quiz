#!/usr/bin/env bash
# After a merge to master goes live, move the merged PR's Jira tickets to Done
# and say where they went live (PROJ-72).
#
# Why: PROJ-60 and PROJ-61 went live in #140 on 23 October 2026 and sat at To
# Do for five days, because moving them was a rule an agent had to remember.
# PROJ-66 made every PR name its ticket; this closes the loop without anyone
# remembering anything.
#
# Which tickets: keys in the PR title or branch, plus any key on a line that
# starts "Closes", "Done" or "Fixes" in the description. Not every key in the
# description: #163's mentions its epic, and an epic must not close because one
# child shipped. Epics are skipped even when named, and so is anything already
# Done. A "Ticket: none" waiver names no key, so it moves nothing.
#
# Env: SHA, GITHUB_REPOSITORY, GH_TOKEN, RUN_URL; JIRA_EMAIL + JIRA_API_TOKEN
# from the `jira` environment (master only). PR_NUMBER or PR_JSON override the
# lookup.
# DRY_RUN=1 makes no Jira call and prints what it would do. Run locally:
#   DRY_RUN=1 SHA=<merge sha> GITHUB_REPOSITORY=gregjrothwell/quiz .github/scripts/jira-done.sh

set -euo pipefail
: "${GITHUB_REPOSITORY:?}"

if [ -n "${PR_JSON:-}" ]; then
  pr=$PR_JSON  # a test seam: a PR shaped like the API's, no GitHub call
elif [ -n "${PR_NUMBER:-}" ]; then
  pr=$(gh api "repos/$GITHUB_REPOSITORY/pulls/$PR_NUMBER")
else
  : "${SHA:?}"
  # The PR whose merge produced this commit. A direct push has none.
  pr=$(gh api "repos/$GITHUB_REPOSITORY/commits/$SHA/pulls" \
    --jq "[.[] | select(.merge_commit_sha == \"$SHA\")][0] // empty")
fi
if [ -z "$pr" ]; then
  echo "No merged PR for ${SHA:-?}: nothing to move."
  exit 0
fi

PR_JSON="$pr" python3 -I - <<'PY'
import base64, json, os, re, sys, urllib.request

pr = json.loads(os.environ["PR_JSON"])
num, title, head = pr["number"], pr.get("title") or "", pr["head"]["ref"]
body = pr.get("body") or ""
keys = re.findall(r"PROJ-\d+", f"{title}\n{head}")
for line in body.splitlines():
    if re.match(r"\s*[-*]?\s*(closes|done|fixes)\b", line, re.I):
        keys += re.findall(r"PROJ-\d+", line)
keys = list(dict.fromkeys(keys))
sha = os.environ.get("SHA") or pr.get("merge_commit_sha") or "?"
where = f"#{num} merged as {sha[:7]}"
if os.environ.get("RUN_URL"): where += f", deployed by {os.environ['RUN_URL']}"
print(f"#{num} {title!r}: {', '.join(keys) or 'no ticket keys'}")
if not keys:
    sys.exit(0)

if os.environ.get("DRY_RUN"):
    for k in keys: print(f"DRY RUN: would move {k} to Done ({where})")
    sys.exit(0)

email, token = os.environ.get("JIRA_EMAIL"), os.environ.get("JIRA_API_TOKEN")
if not email or not token:
    print("::warning title=Jira::JIRA_EMAIL / JIRA_API_TOKEN not set in the `jira` environment, so no ticket was moved (PROJ-72).")
    sys.exit(0)

base = "https://gmancodwarrior.atlassian.net/rest/api/2"
auth = "Basic " + base64.b64encode(f"{email}:{token}".encode()).decode()
def call(method, path, data=None):
    req = urllib.request.Request(base + path, method=method,
        data=json.dumps(data).encode() if data is not None else None,
        headers={"Authorization": auth, "Accept": "application/json", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=15) as r:
        raw = r.read()
        return json.loads(raw) if raw else None

failed = 0
for k in keys:
    try:
        f = call("GET", f"/issue/{k}?fields=issuetype,status")["fields"]
        if f["issuetype"]["name"] == "Epic":
            print(f"{k}: an epic, left alone"); continue
        if f["status"]["statusCategory"]["key"] == "done":
            print(f"{k}: already Done"); continue
        ts = call("GET", f"/issue/{k}/transitions")["transitions"]
        t = next((t for t in ts if t["to"]["statusCategory"]["key"] == "done"), None)
        if t is None:
            raise RuntimeError("no transition to a Done status")
        call("POST", f"/issue/{k}/transitions", {"transition": {"id": t["id"]}})
        call("POST", f"/issue/{k}/comment", {"body": f"Live: {where}. Moved to Done by CI (PROJ-72)."})
        print(f"{k}: moved to Done")
    except Exception as e:
        failed += 1
        # Jira answers a refused token with 404, not 401: it hides the ticket.
        hint = " (token refused, or the ticket is not visible to it)" if "404" in str(e) or "401" in str(e) else ""
        print(f"::error title=Jira {k}::{type(e).__name__}: {e}{hint}")
sys.exit(1 if failed else 0)
PY
