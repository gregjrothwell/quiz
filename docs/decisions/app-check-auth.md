# App Check on authentication

> **Owner: Greg Rothwell. Last updated: 20 August 2026. Budget: 250 lines.**

Split out of [`security.md`](security.md) on 20 August 2026, when that file hit its
250-line budget. The text is moved, not rewritten — including the readings that
turned out to be premature, which stay visible because the point of this page is
how long the answer took to arrive and how easy it would have been to guess wrong.

Firestore and the Realtime Database are in [`security.md`](security.md). This file
is authentication only.

## Switched on 20 August, and enforcing by that afternoon

> **Resolved, 20 August 2026, 12:42.** `appcheck-probe` now reports
> `ENFORCED  Authentication · refused, so nothing below can be read` —
> `auth/firebase-app-check-token-is-invalid`. Everything below stands as written:
> it was genuinely unenforced through four runs across more than 20 minutes, and
> then it took effect. The delay was longer than the documented 15 minutes and
> nothing observed here explains why, so **do not read this as "the docs were
> right all along" — read it as a propagation delay that is not bounded by what
> the page says.**
>
> The consequence for tooling is nil: `check-rules`, `sync-harness`, `take-stock`
> and `reveal-probe` all ran clean afterwards on the debug token. The probe is the
> only client that deliberately carries none.

### What was observed before that


Enforcement was enabled in the console the same afternoon. **`appcheck-probe`
still signed in unattested twice afterwards, roughly 10 minutes apart.** The
documented delay is up to 15 minutes, so this is not yet a finding either way —
it is recorded as unresolved rather than rounded up to "done".

**Still unenforced at 08:54, past the window.** Four probe runs, all signing in
unattested. For comparison the Realtime Database took effect almost immediately,
so "wait longer" is a weak explanation by 20 minutes.

What the documentation says, checked rather than assumed. [Identity Platform's
App Check
page](https://docs.cloud.google.com/identity-platform/docs/admin/app-check-integration)
enumerates eight protected operations, and `SignUp` is one of them — *"Signs up a
new email and password user or anonymous user."* The Firebase JS
`signInAnonymously` calls that endpoint. **So anonymous sign-in should be
covered, and the measurement disagrees with the documentation.**

Two caveats from the same page, both worth holding: it is labelled a **Pre-GA
Offering**, and it does not state whether an Identity Platform upgrade is a
prerequisite for Auth enforcement. Another Auth feature on this project —
anonymous auto-clean-up — does require that upgrade.

**Do not resolve this by reasoning.** The next move is to look at what the
console actually shows for Authentication, because a setting that did not save
looks identical from here to one that saved and does nothing. That is the exact
failure that cost a day in August: an invented mechanism was offered instead of
one question about what was on screen.

When it does take effect, `appcheck-probe` can only answer one question: signing
in is the first thing it does, so an enforced Auth makes every product below it
unreachable. The script exits early and says so rather than reporting the rest as
fine. That is a real loss of reach and an acceptable one — if nothing can
authenticate, nothing reaches Firestore or the Realtime Database either.

**What enforcement buys, and does not.** It stops accounts being *minted* by
anything that cannot attest, which is the accumulation problem the anonymous
purge was aimed at — and it solves it without touching a single existing season
row. It adds no new user-facing failure: a browser that cannot load reCAPTCHA is
already unable to read anything, so this only moves that failure earlier.
