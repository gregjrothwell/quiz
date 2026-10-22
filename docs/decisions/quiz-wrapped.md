# Quiz Wrapped — story and acceptance criteria

> **Owner: Greg Rothwell. Last updated: 22 October 2026. Budget: 250 lines.**

**Status: DRAFT for Greg's approval. Nothing built.** Wow item 5 of
[`direction-oct-2026.md`](direction-oct-2026.md#5-wow--all-five-accepted).
**Due by about 5 December 2026.**

## The story

> **As a regular**, I want a few cards about my season — how I played, what I
> was best at, where I finished — that I can keep and share, **so that** the
> season ends with something, and people want the next one.

## What a Wrapped is

Five cards, swiped through, built on the final-card pipeline
([`final-card.md`](final-card.md): a 1200 × 630 canvas PNG, shared by the
browser's own routes):

1. **Your season in numbers** — rounds played, wins, points, best round.
2. **Your thing** — the rosette you won most (fastest finger, comeback, lone
   wolf, contrarian).
3. **Your finals** — Share or Shaft record, if you were ever in one.
4. **Your squad** — where your squad finished on the board.
5. **Where you finished** — your place on the season board.

Every number is already on the season row or the season board, which the app
can read today. **No new data, no new reads beyond loading the board once.**

## Acceptance criteria

- **W1.** `src/engine/wrapped.ts` is pure: from one season row and the board it
  returns the five cards' facts. Unit-tested, including a player with one round
  and no wins, and one who never reached a final (that card is skipped).
- **W2.** Opened from the season board ("Your Wrapped"), for the player on this
  device only. Nobody can open someone else's.
- **W3.** Each card downloads or shares as a PNG, via the final card's three
  routes.
- **W4.** Only on or after a date Greg sets (`WRAPPED_FROM`), so it cannot leak
  early; before then the button is not there.
- **W5.** Names on a card are the player's own and, on card 5, the top three
  of the board — the same names the board already shows.
- **W6.** Screenshots at 1280 and 375 wide; e2e opens it for a seeded row.

## Not in this story — needs Greg first

**"A Christmas finale."** The idea says Wrapped comes with one; what it is was
never written down. Three readings:

- (a) a special last round of the year with a Christmas pack;
- (b) the season's top players in a Share or Shaft for the title;
- (c) Wrapped shown to the room on the big screen at the last quiz.

## Open — Greg to decide

| Decision | Recommendation |
|---|---|
| Approve the five cards from data the app already has | Yes |
| The date it opens (`WRAPPED_FROM`) | Friday 5 December 2026 |
| What the Christmas finale is | Your call — (a), (b), (c), or none for now |
