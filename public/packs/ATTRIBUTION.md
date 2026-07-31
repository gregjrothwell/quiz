# Question data attribution

Questions in this directory are derived from the
[Open Trivia Database](https://opentdb.com), which publishes its data under the
[Creative Commons Attribution-ShareAlike 4.0 International Licence](https://creativecommons.org/licenses/by-sa/4.0/).

## What we changed

- Fetched only the verified question pool, via the public API
- Decoded the base64 transport encoding to plain UTF-8
- Removed structurally unusable questions: duplicate answer options, unresolved
  HTML entities, order-dependent options such as "all of the above", and
  questions whose answer decays over time
- Removed questions specific to the United States, which land poorly with a UK
  audience
- Tagged questions carrying British reference points into a separate
  `uk-leaning` pack
- Grouped the remainder into themed packs by source category

## Licence of this derived work

Because the source is ShareAlike, these derived packs are also released under
**CC BY-SA 4.0**. If you reuse them, credit the Open Trivia Database and keep
the same licence.
