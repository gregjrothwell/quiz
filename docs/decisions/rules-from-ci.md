# Rules from CI (W2)

> **Owner: Greg Rothwell. Last updated: 15 October 2026. Budget: 250 lines.**
> **Status: built 15 October 2026 on `rules-from-ci`, not live.** Waits on
> [Greg's step](#gregs-step--before-the-merge), then "go live". Plan:
> [`public-scale.md`](public-scale.md#the-plan-15-october-2026), W2 and D5.

## What it does

`.github/workflows/ci.yml` gains a `rules` job between `e2e` and `deploy`:

```
verify → e2e → rules → deploy
               firebase deploy --only firestore:rules,database --project quiz-d686e --non-interactive
```

- **Master only**, on a push or a manual run. Pull requests never reach it.
- **After e2e**, which has just run the same two files in the emulator
  (`package.json` `e2e`). CI publishes what it exercised.
- **Before the site.** `deploy` now `needs: rules`: a client never goes live
  ahead of the rules it needs, and a failed publish holds the site back too.
- **Keyless** (D5, Greg, 15 October): `google-github-actions/auth` swaps
  GitHub's OIDC token for a short-lived token for one service account. No key
  exists for that account, in GitHub or anywhere else.

What does not change:

- **`npm run check-rules` stays local**, after the merge. It needs the App Check
  debug token, which no workflow may hold (`ci.yml` header; `check-bundle`
  refuses a workflow that names it).
- **`firestore.seed.rules` is never published by CI.** `firebase.json` names only
  `firestore.rules`. `seed-vault` normally uses the service account and bypasses
  rules; its fallback path still pastes the seed rules by hand. A master merge
  in that window would put `firestore.rules` back, which is the safe direction.
- **A hand paste still works, and no longer lasts.** The next master merge
  replaces it with the repo copy. That is the point.
- **A breaking rule is still breaking.** Tabs already open run the old bundle
  against the new rules the moment `rules` finishes. W3 still needs
  expand-then-contract.

Side effect: **a manual run from any branch other than `master` no longer
publishes the site.** It could before (`deploy`'s old `if` allowed any
`workflow_dispatch`), which contradicted [`ci-deploy.md`](ci-deploy.md)'s
"CI deploys from one ref".

## Why this shape

**Through a service account, not direct federation.** Google's table of
products that support identity federation (docs.cloud.google.com/iam/docs/
federated-identity-supported-services, **fetched 15 Oct 2026**) has no row for
Firebase Realtime Database or Firebase Security Rules; both names appear only in
its navigation. The auth action's README (fetched the same day) warns that not
every resource accepts a federated principal. Impersonation is the documented
route for those. It is still keyless.

**Three predefined roles, each for a call firebase-tools 15.30.0 makes.** Read
off `node_modules/firebase-tools/lib`, 15 October:

| Role | Needed for | Source |
|---|---|---|
| `roles/firebaserules.admin` | compile (`projects:test`), list releases, read the live ruleset, create one, update the release | Cloud IAM role reference, fetched 15 Oct |
| `roles/firebasedatabase.admin` | `firebase.projects.get` to find the default instance; `instances.get` for its europe-west1 URL; `instances.update` for the PUT to `.settings/rules.json` | Firebase predefined-roles page, fetched 15 Oct |
| `roles/serviceusage.serviceUsageConsumer` | the Firestore step first checks the API is enabled (`services.get`, sent with `x-goog-user-project`, so `services.use`) | **measured**: without it the deploy stops at *403, Permission denied to get service [firestore.googleapis.com]* |

Each holds a little more than the calls need: the RTDB role can also create and
list instances, the Rules role can delete rulesets. Not narrowed to a custom
role: a missing permission would only show as a failed first publish, and the
power to publish rules is already the power to open every path to a client.

**The pool admits one repository's `master`.** The provider's condition is
`assertion.repository_id=='1318504643' && assertion.ref=='refs/heads/master'`.
The numeric id, not the name, because Google's page warns that names can be
reused (`gh api repos/gregjrothwell/quiz --jq .id`, 15 Oct). A push and a manual
run on master both carry `refs/heads/master`; a pull request carries
`refs/pull/N/merge` and is refused by Google whatever `ci.yml` says.

**The action is pinned to a commit**, `7c6bc77` (v3.0.0), not the tag: it is the
only action from outside GitHub, in the only job that can change the rules. Its
`action.yml` at that commit declares `node24`.

**Nothing is published unless both files compile.** firebase-tools runs every
target's prepare before any release (`lib/deploy/index.js`): the RTDB file goes
to the live database as a dry-run PUT, the Firestore file to the Rules API's
compile. Releases follow, the RTDB first.

## Proved before the merge, 15 October 2026

- **Live equals repo.** The live Firestore release points at ruleset
  `7123491b…`, created 24 Sep 2026 10:13:31 UTC, byte-identical to
  `firestore.rules` (47,817 bytes). The live RTDB rules equal
  `database.rules.json` as text. So **the first CI publish changes nothing**:
  firebase-tools skips the Firestore upload when the content matches and
  re-PUTs identical RTDB rules. Read with the admin service account; read-only.
- **The command, dry-run, against the live project** (`--dry-run` runs prepares
  only), from a scratch copy, with no Firebase login so it used
  `GOOGLE_APPLICATION_CREDENTIALS` as CI will:
  - the repo's RTDB file: *rules syntax … is valid*;
  - an RTDB file with `".read": "auth.uid ==="`: *Syntax error in database
    rules: 3:27: Unexpected end of expression*, exit 1, Firestore never
    reached — **refused before anything was published**;
  - the Firestore step then stopped at the 403 above, which is how the third
    role was found. The admin service account cannot compile Firestore rules
    (`firebaserules.rulesets.test` refused), so the **server-side Firestore
    refusal is read from source, not run**.
- **A trailing comma is not a broken file.** The first "broken" RTDB copy
  ended `,}` and the live server called it valid. A probe has to be refused
  for the right reason, so the real one breaks an expression.
- **In CI, on probe branches** ([#82](https://github.com/gregjrothwell/quiz/pull/82),
  [#83](https://github.com/gregjrothwell/quiz/pull/83), this branch's workflow):
  - that same RTDB expression: e2e red at emulator start, *Failed to load
    initial Database Emulator rules: database.rules.json:3:27: Unexpected end
    of expression* — the live server's words;
  - a stray line in `firestore.rules`: **the Firestore emulator starts
    anyway.** e2e is red because every Firestore write is refused; the failed
    test's page showed *Error compiling rules: L3:1 mismatched input 'this'*.
    So this half of the gate rests on e2e making a Firestore write (two of its
    three tests do);
  - `rules` and `deploy` skipped on both. On a PR they always are, so the proof
    is e2e red, which `needs` turns into a skip on master. **The allow case:**
    this branch's own run (#84, run 38765460301), same workflow and files
    unbroken: e2e 3/3 passed. That is what makes the two reds mean something.
- `typecheck`, `lint`, `npm test` 1,503/1,503; `check-bundle` with `CI=true`
  against the new workflow: passes. (`npm test` says nothing about rules.)

## Greg's step — before the merge

**In Google Cloud Shell** (console.cloud.google.com, the `>_` button; gcloud is
installed there). Every command and flag below was checked against Google's
gcloud reference and WIF pages, fetched 15 October. Paste as one block:

```bash
PROJECT_ID=quiz-d686e
REPO_ID=1318504643   # gregjrothwell/quiz, numeric
SA="rules-publisher@${PROJECT_ID}.iam.gserviceaccount.com"
gcloud config set project "$PROJECT_ID"
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')

# The four APIs federation uses.
gcloud services enable iam.googleapis.com cloudresourcemanager.googleapis.com iamcredentials.googleapis.com sts.googleapis.com

# A pool, and a GitHub provider that admits only this repository's master.
gcloud iam workload-identity-pools create github --location=global --display-name="GitHub Actions"
gcloud iam workload-identity-pools providers create-oidc quiz-master \
  --location=global --workload-identity-pool=github --display-name="quiz master" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository_id=assertion.repository_id,attribute.ref=assertion.ref" \
  --attribute-condition="assertion.repository_id=='${REPO_ID}' && assertion.ref=='refs/heads/master'"

# The account CI acts as. Never create a key for it.
gcloud iam service-accounts create rules-publisher --display-name="Rules publisher (CI)"
for ROLE in roles/firebaserules.admin roles/firebasedatabase.admin roles/serviceusage.serviceUsageConsumer; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:${SA}" --role="$ROLE" --condition=None
done

# Let this repository's identities in the pool act as that account.
gcloud iam service-accounts add-iam-policy-binding "$SA" --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/attribute.repository_id/${REPO_ID}"

echo "GCP_WORKLOAD_IDENTITY_PROVIDER=projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/providers/quiz-master"
echo "GCP_RULES_SERVICE_ACCOUNT=${SA}"
```

Then, **on the Mac**, the two values the last lines print, as repository
variables (not secrets: they name things, they authorise nothing):

```bash
gh variable set GCP_WORKLOAD_IDENTITY_PROVIDER --body "projects/<number>/locations/global/workloadIdentityPools/github/providers/quiz-master"
gh variable set GCP_RULES_SERVICE_ACCOUNT --body "rules-publisher@quiz-d686e.iam.gserviceaccount.com"
```

Two Google sources disagree on a trailing slash in the issuer URL (the IAM page
has one, the auth action's README does not). This uses the README's, which is
the `iss` GitHub sends. If any command errors, stop and paste the error back:
nothing above is undone by stopping.

**Merging before this step** fails the `rules` job at the auth step, publishes
nothing, and holds that merge's site deploy back until it is done.

## Going live, in order

1. Greg's step above.
2. **W1 (#81) first.** This branch is stacked on `tmdb-credit`; merged alone,
   it would carry W1 with it.
3. "Go live" → merge → watch the `rules` job. Expected: *latest version of
   firestore.rules already up to date, skipping upload*, then *released rules
   firestore.rules to cloud.firestore*. Nothing changes in the console.
4. **The rules-only proof.** A PR touching `firestore.rules` alone: several of
   its comments still describe a hand paste. Merged, the console's rules history shows
   a new ruleset at the run's time, and Logs Explorer names the account:
   `protoPayload.methodName="google.firebase.rules.v1.FirebaseRulesService.UpdateRelease"`
   (Firebase Rules writes Admin Activity audit logs for `UpdateRelease`, per its
   audit-logging page, read 15 Oct).
5. `npm run check-rules`, both ways (baseline 91/91, 27 September), then
   `npm run rank-harness`: the postmortem's rule is to use what the gate guards.

## Not covered

- **WIF end to end.** The first master run is the first time a runner signs in
  this way. If it fails, nothing is published and the site waits; fix, then
  re-run CI on master by hand.
- **The server's Firestore compile refusing a file**, inside CI. The emulator
  half is proved on a branch; the server half is read from source.
- **A release split across the two products.** The RTDB release, then the
  Firestore one, are separate calls. If the second failed, the job is red and
  the two products disagree until a re-run. Not seen.
- Whether the console shows an RTDB rules history. Not checked.
