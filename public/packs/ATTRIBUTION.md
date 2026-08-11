# Question data attribution

Questions in this directory are derived from two sources, both published under
the [Creative Commons Attribution-ShareAlike 4.0 International Licence](https://creativecommons.org/licenses/by-sa/4.0/):

- The [Open Trivia Database](https://opentdb.com)
- [OpenTriviaQA](https://github.com/uberspot/OpenTriviaQA)

Sharing a licence is what makes the two poolable. A third source considered and
rejected, [The Trivia API](https://the-trivia-api.com), is CC BY-**NC** — its
NonCommercial term cannot be combined into a ShareAlike work.

## What we changed

- From Open Trivia DB: fetched only the verified question pool, via the public
  API, and decoded the base64 transport encoding to plain UTF-8
- From OpenTriviaQA: parsed the flat-file category format, decoding each file as
  UTF-8 or CP1252 as its contents require, and kept only four-option questions
- Removed questions whose text the source had already damaged — stripped
  apostrophes, double-encoded characters
- Removed structurally unusable questions: duplicate answer options, unresolved
  HTML entities, order-dependent options such as "all of the above", and
  questions whose answer decays over time
- Removed questions specific to the United States, which land poorly with a UK
  audience
- Tagged questions carrying British reference points into a separate
  `uk-leaning` pack
- Grouped the remainder into themed packs by source category, capped so no
  single pack becomes an unreasonable download
- Marked OpenTriviaQA questions as medium difficulty, the source carrying no
  difficulty rating of its own

## Licence of this derived work

Because both sources are ShareAlike, these derived packs are also released under
**CC BY-SA 4.0**. If you reuse them, credit the Open Trivia Database and
OpenTriviaQA, and keep the same licence.
