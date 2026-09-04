# Known limits

> **Owner: Greg Rothwell. Last updated: 4 September 2026. Budget: 250 lines.**

Split out of [`state-of-play.md`](state-of-play.md) on 28 August 2026, when that
file reached 252 lines against a 250 budget. The text is unchanged apart from one
correction, marked in place below; only where it lives has changed.

That file answers *what has been verified*. This one answers *what is known not to
work*, which is a different question and the one worth reading before assuming a
behaviour is a bug.

## Known limits

- **Any room member can write scores, and anyone holding the code can become a
  member.** Deliberate — see the quizmaster row above. Fine among colleagues, not
  fine for strangers. The room code is the only thing standing between a room and
  the internet, which is why `list` is no longer granted.
- **Cheating now takes a script rather than a console.** The answers left the
  packs and the room document — see [the vault](vault.md#turning-the-vault-on) for what
  that does and does not buy. `elapsedMs` is still self-reported, so a
  fast-but-wrong answer is honest and a slow-but-claimed-instant one is not.
- **~262 kB gzipped across two chunks** — 114 kB of app and 148 kB of Firebase —
  plus 67 kB of fonts. **The split is about the deploy, not the download.** As
  one file, every deploy changed the bundle's hash, so a returning player
  re-fetched all of it including the Firebase half that had not changed, and saw
  nothing at all until it landed because `index.html` is a 0.7 kB shell. That was
  the delay after each deploy, and only after each deploy — every visit afterwards
  was cached. Split, an ordinary change leaves the Firebase chunk's hash alone.
  **Verified by building twice across a real code change**, not assumed: the app
  hash moved and the Firebase hash did not. `font-display: swap` was already set,
  so the fonts were never part of it. The review, the recovery panel, the identity
  modules and the opening titles added about 5 kB between them; the lobby QR code
  added about 10 kB (`qrcode-generator`, MIT, no dependencies), more than it
  looked like it would; and the clock added 0.9 kB, being oscillators rather than
  audio. Code-splitting is the fix if it matters.
- **Devices in the same room will phase against each other, and it costs
  answers.** Each one schedules its own clock from when *it* saw the question
  open, and those moments differ by the spread of the Firestore snapshot. This
  was already true of the tick and nobody remarked on it; nine seconds of music
  makes it far more noticeable. **It was filed here as an audio nuisance and
  that was wrong** — on 17 August a player's window started about five seconds
  late, so the reveal killed his lecterns while his own timer still read five
  seconds and he could not answer at all. It cannot be fixed by syncing to
  `questionOpenedAt`, which is a client wall clock and would fold the
  quizmaster's offset into every device — but `openedAt` is a
  `serverTimestamp()` and there is a route through it. See [the clock, and what
  it actually costs](clock.md#the-clock-and-what-it-actually-costs).

  > **Correction, 28 August 2026.** The route was taken and **this limit is
  > gone.** Every device now counts the window from `openedAt` translated onto
  > its own clock, using the minimum of `arrival − openedAt` across a round as
  > its skew. Live since 28 August, and played the same day: `CORRECT · +1,000`
  > at 10.6s in the browser against `scored: ClockTest +1000` at 10.79s in the
  > terminal. The bullet above is left standing rather than deleted, because it
  > is the clearest statement of what the bug actually cost somebody.
  > [`shared-clock.md`](shared-clock.md).
- **A non-member can still write an answer document.** Nothing checks
  membership on the way in — the room code is the capability, as everywhere
  else. It no longer *scores*, and no longer inflates the answered count, but
  the write itself is still possible and the rules still permit it. What that
  costs now is a stray document, not somebody's game.
- **Season standings follow the browser until somebody saves a recovery code.**
  Anonymous auth gives a durable uid with no sign-up, which is the whole appeal
  and was the whole limitation — **iOS Safari evicts site storage after about a
  week without a visit**, so a weekly quiz survived and a fortnight off did not.
  [Durable identity](identity.md#durable-identity) is the answer to that, and it is opt-in
  by design: a player who never saves a code is exactly where they always were,
  and eviction still costs them everything. The remembered name has the same
  lifetime and for the same reason: it is stored beside the uid rather than
  fetched from the season row, so the two can never disagree about who this
  browser is.
- **Honours are counted per device, so a device that missed a reveal banks
  none.** `useGameLog` is assembled from reveals this client saw, and
  `sawWholeGame` refuses to bank from a short log — which is the safe direction,
  but it means a player can silently lose a night's rosettes rather than merely
  see a screen say nothing. Session storage made this much rarer, since a reload
  no longer loses the log; a coalesced snapshot could still do it. Not fixable
  without letting one device write everybody's row, which is the thing the rules
  deliberately prevent — the same trade-off as somebody closing the tab before
  the final screen.
- **The `recovery` collection only grows.** Same shape as rooms never being
  deleted: each minted code is a permanent document. It is deletable by its
  owner, which is how a leaked code is revoked, but nothing tidies up
  automatically. One document per person who ever asks for a code, so it is a
  much slower leak than rooms.
- **The season board is the one read that scales with curiosity rather than with
  play** — 50 rows every time somebody opens it, and the final screen now points
  them there. Counted properly under [what it all
  costs](cost.md#what-it-all-costs-and-how-much-room-is-left).
- **The answer lamps have no cap, so a very large room makes a tall desk.** Ten
  names wrap to two rows on a phone, which is about 20% of the screen and was
  judged worth it. Twenty names would be four rows and would start to crowd the
  lecterns. It degrades rather than breaks — the strip grows and the question
  scrolls under it — but if the office ever fields that many, the fix is to name
  only who is *outstanding* and collapse the rest to a count.
- **Season numbers are self-reported.** The rules stop you writing someone else's
  row but not your own. Same trust model as the rest of the game.
- **The source corpora file their own questions unreliably.** OpenTriviaQA's
  `sports` file opens with a question about Aristotle and metaphysics. The
  positive sport filter catches that particular class; nothing checks the other
  packs, so a stray is possible anywhere. This is the same failure the project
  already hit once, when a `general-knowledge` fallback made that pack 68% video
  games.
- **The Trivia API is licence-incompatible.** 14,400 questions with real
  difficulty ratings, which would solve the levelling problem — but it is CC
  BY-**NC**, and NonCommercial cannot be folded into a ShareAlike work. Ruled out
  rather than overlooked.
- **Three OpenTDB categories are genuinely empty**: Musicals & Theatres,
  Celebrities and Gadgets have no *verified* questions, only pending ones. Note
  that `api_count.php` counts pending questions too, so its totals overstate what
  the API will actually serve — don't size a harvest from them.
- **The melody and picture answers are in the public repo, and the vault does not
  cover them.** Every other pack's answers exist only in the Firestore vault and a
  gitignored cache, which is the whole point of the vault. The two hand-built packs
  cannot work that way: a pack builder has to read its specs from somewhere, so they
  are committed — 70 in `src/questions/melody-voices.ts` and 49 in
  `scripts/hand-picture-data.ts`. The id is `sha1('hand:' + slug).slice(0, 12)` and
  the slug sits on the line above `correct:` in the same file, so a complete
  id-to-answer map is a few lines of script against a public URL. **Checked, not
  assumed:** `sha1('hand:hay-wain')[:12]` is `e26ff5781961`, which is the live id
  for The Hay Wain in `picture.json`.
- **What that limit is *not*.** The answers do not reach players.
  `melody-voices.ts` is imported only by its own tests and by `write-hand-packs`,
  never by app code, and the built bundle carries no `MELODY_SPECS`, no
  `incorrect`, and no answer strings — grepped against a known sentinel rather
  than trusted. `public/packs/` stays sealed and `seal.test.ts` still enforces it
  in both directions. The exposure is the repo, not the site.
- **Accepted rather than fixed, 4 September 2026.** Moving the specs out of the
  repo makes the packs unregenerable, and losing 119 hand-built questions to a
  cleared `.cache/` is a worse failure than a colleague who goes looking for the
  source of a quiz they are playing. What would change the answer: the repo
  becoming the obvious place to look, or a night where the result matters enough
  to be worth cheating for.

---
