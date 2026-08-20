# Durable identity

> **Owner: Greg Rothwell. Last updated: 20 August 2026. Budget: 250 lines.**

Moved verbatim out of `docs/HANDOVER.md` on 20 August 2026, when that file reached
2,422 lines. The text is unchanged; only where it lives is.

## Durable identity

**Shipped, rules published and verified on 15 August 2026.** `npm run
check-rules` reports 33 of 33, and `npm run sync-harness 10` had ten clients
joined and seeing the round start within 83 ms with none dropped — which was the
real risk, since `playerOk` gates every room write.

A season row used to be keyed on the anonymous auth uid. That uid is durable per
browser and dies with site storage: iOS Safari evicts after about a week without
a visit, and a work machine has never had it. While the row held points that cost
a total. Now it holds rosettes, and an eviction would erase a season of earned
reputation silently — the feature meant to make the league feel continuous
becoming the one that makes it feel arbitrary.

**You cannot move a Firebase Auth uid between browsers.** A custom token needs a
server, which means leaving the free tier; linking a real provider means an
account, which is the one thing anonymous auth is here to avoid. So the uid stops
being the identity.

### The shape

A **`playerId`**, which *defaults to the uid*. That default is what makes the
whole thing free: every row written before this is keyed by a uid, which is now
simply a playerId nobody has claimed. **There is no migration**, and a player who
never touches any of it is on exactly the path they were on.

A second browser takes on an identity by presenting a **recovery code** —
permanent, regenerable, and revocable. It is stored beside the remembered name
and shown on the season screen.

| Collection | What it holds |
|---|---|
| `recovery/{CODE}` | `{ playerId }`. Readable by id, never listable, never updatable, deletable by its owner. |
| `claims/{uid}` | `{ playerId, code }`. This browser's identity, readable only by it. |

### This is the room code's pattern, not the vault's

Worth being precise, because the first sketch of this design got it wrong. The
vault is `allow read: if false` because **its document ids are public** — they
ship inside the packs — so an answer had to be unreadable and merely checkable
by a rule.

A recovery code is the opposite: **the id itself is the secret.** So knowing it
is the whole proof, and the code is simply read. What that needs instead is
`list: if false`, exactly as `/rooms` has, because a capability you can
enumerate is not one. 29⁸ is about 5×10¹¹.

### Three things that will bite

- **`exists()` must come before `get()`.** A `get()` on a missing document
  returns null, and reading `.data` off null errors the rule, which denies. Drop
  the `exists()` and every browser that has never claimed anything is locked out
  of *its own row* — the common case, broken by a guard meant for the rare one.
  Both calls read the same document inside one evaluation and Firestore caches
  that, so the pair still costs one read.
- **The `||` must put the uid case first.** Rules short-circuit, so an unclaimed
  player pays no extra read at all and only somebody who has claimed pays one,
  once per game. Reversed, every player in every game pays a document read for a
  branch almost none of them need.
- **Minting is restricted to an identity the writer already holds.** Without
  that, anybody could read a playerId off the season table — they are the
  document ids of a readable collection — mint a code pointing at it, claim it,
  and write that person's row. `ownsPlayer` on `recovery` create is the whole of
  what stops it.

### Claiming folds in the record the browser already had

Without this, claiming leaves the row the claiming browser had built up sitting
on the board forever under the same person's name — nothing writes to it again
and nothing removes it. **Two rows, one human, on a table the office looks at**,
and it would have hit the two-machine case that motivated the whole feature.

`foldRecords` in `src/engine/records.ts` is the arithmetic and is pure and
tested; `mergeRecords` in `src/lib/season.ts` does nothing but read two
documents, call it, and write one back. Four things about it are load-bearing:

- **It runs *after* the claim, never before.** Writing the target row needs
  `ownsPlayer` to pass, which needs the claim already in place. Deleting the
  source works either way, because a browser always satisfies the uid branch for
  its own uid — which is also why a claimed browser can still tidy up after
  itself later.
- **Only ever the browser's own uid row.** Never a previously claimed identity:
  somebody moving between two identities is not asking for the first one's record
  to be poured into the second, and doing it would quietly move another person's
  history.
- **It is idempotent**, because the source is deleted in the same transaction
  that folds it in. A failure leaves a visible duplicate rather than a corrupt
  total, and typing the code again retries it.
- **`best` is a maximum, everything else a sum.** A personal best is not improved
  by having been set on two devices. There is a test asserting the merged row
  still satisfies every bound the rules impose, so a merge can never write a row
  the rules would then reject.

### What it does not do

- **Anyone holding a code can write that row.** Same trust model as the room
  code, deliberately. The blast radius is a leaderboard entry, and a leaked code
  can be revoked by deleting it.
- **Revoking strands nobody.** A browser that has already claimed carries its own
  `claims` document, and the season rules read *that*; the recovery document is
  consulted only when a claim is made. So deleting it stops the code being used
  again and leaves everyone who already used it exactly where they are.
- **Two devices of one person in one room are two players.** They share a
  playerId, so the second banks nothing — `lastGame` is the same game id. That is
  the right answer, and it is worth knowing before somebody reports it as a bug.

### The publish order, kept because it will matter again

Rules first, then deploy — same as [the answer
window](answer-window.md#the-configurable-answer-window) and the opposite of the vault's.

The new rules are fully backwards-compatible with any deployed bundle: every
field added is optional and defaulted, and the season rule's uid branch is what
an unclaimed client hits. **The reverse order is the broken one** — a new client
writing `fastest: 1` onto a season row against the old ruleset is refused by
`hasOnly`, and nobody's game gets banked.

That compatibility was traced field by field before publishing rather than
assumed, which is why the rules went live while the old bundle was still being
served and nothing broke in between.

---


## Next session — start here

Written 11 August 2026, revised 13 August after the join link went out, again on
14 August after the chair and the sticky desk, and again on 15 August when the
round in review shipped and the next two phases were agreed.

> ### The three-phase plan, and why identity comes before the honours
>
> **Phase 1 — the round in review. Done.** See [its section](review-replay.md#the-round-in-review).
>
> **Phase 2 — durable identity. Next, and the only one that touches the rules.**
> `seasons/{season}/players/{uid}` is keyed on the anonymous auth uid, which dies
> with site storage: iOS Safari evicts after about a week, and a second machine
> has never seen it. Today that costs a points total. Once rosettes and titles
> hang off the same key, an eviction erases a season of earned reputation
> silently — and the feature meant to make the league feel continuous becomes the
> one that makes it feel arbitrary. It is also the same root cause as item 1
> below.
>
> The shape: **a `playerId` that defaults to the uid**, so every existing
> `season-2` row keeps working with no migration, and a second browser may
> *claim* an existing `playerId` by presenting a permanent recovery code.
> Verification reuses the vault's asymmetry exactly — `recovery/{CODE}` is
> `allow read: if false`, so no client can look a code up while the rule itself
> can `get()` it. Claiming is an assertion judged server-side, like a reveal.
> `exists()` must precede `get()` or an unclaimed browser is locked out of its
> own row, and the `||` must put the uid case first so the ordinary player still
> pays zero extra reads.
>
> **You cannot do this any cheaper without accounts.** Moving a Firebase Auth uid
> between browsers needs either a custom token — a server, so Blaze — or linking
> a real provider, which is an account. Decoupling the season from the uid is the
> only route that keeps anonymous auth's no-signup appeal, which is most of why
> the app is pleasant to join.
>
> **Phase 3 — Form.** A cold open before question one built from the season rows
> of the people actually in the room, plus honours accumulating on those rows.
> Phase 2 publishes every rule it needs, including an optional `playerId` on each
> player's own entry so the digest costs no extra reads.

---

## Purging anonymous accounts — the recommendation is don't

**Reviewed 20 August 2026.** The old security list carried this as an open item:
*"There is a console setting to auto-purge unused anonymous accounts after 30
days; it is off. Turning it on would also quietly reset anybody's season row."*
Both halves need correcting.

### It may not be available on this project at all

[The anonymous auth
docs](https://firebase.google.com/docs/auth/web/anonymous-auth) state the
setting requires an upgrade: *"If you've upgraded your project to Firebase
Authentication with Identity Platform, you can enable automatic clean-up in the
Firebase console."*

**The documentation does not say whether that upgrade requires a billing
account, and neither does this file.** It is the same shape as the TTL policy,
which turned out to need billing and said so on no documentation page — it was
discovered at the button. Check in the console before planning around it.

### The benefit is nil here

The docs give the benefit as: anonymous authentication *"will no longer count
toward usage limits or billing quotas."* This is a Spark project with no billing
account and roughly one round a week. There is no bill to reduce and no quota
under pressure. **Nothing is being bought.**

### The cost is the whole season

Measured 20 August 2026 with `npm run take-stock`: **21 players in `season-2`,
0 recovery codes, 0 identity claims.** Not one person has ever used the durable
identity feature.

So the mitigation that exists on paper protects nobody. Every one of those 21
rows is keyed on a `playerId` that is still just an auth uid, and purging the
account orphans the row — the points survive in Firestore and no browser can
ever write to them again.

### A recovery code would not fully save them either

**Reasoned from the rules, not tested** — and worth testing before anyone relies
on it. `ownsPlayer` in `firestore.rules` allows a write when
`playerId == request.auth.uid`, *or* when `claims/{request.auth.uid}` points at
that playerId. A purge invalidates the browser's credential, so the next visit
mints a **new** uid. `playerIdFor` still returns the claimed playerId out of
localStorage, so the app keeps writing to the right row — but `claims/{newUid}`
does not exist and `playerId != newUid`, so **both branches fail and the write is
refused.**

The player would keep their history, see an error when a game tried to bank, and
have to re-enter their recovery code to mint `claims/{newUid}`. Nothing in the
app prompts them to. The code is still in their localStorage, so recovery is
possible — it is just neither automatic nor discoverable.

Verifying this properly means deleting a real anonymous account and watching what
the next visit does. That deletes somebody's row if the reasoning is wrong, so it
has not been done.

### If it is ever turned on

Have people claim recovery codes **first**, and only then enable it — and fix the
re-claim gap above, because otherwise every claimed player silently loses the
ability to bank a game thirty days after their last visit.
