# character-frequency-analyzer-utils

Count the occurrences of each character in a text body and derive the usual
statistics (unique count, frequencies, top-N, Shannon entropy) from a single
pass.

```js
import { analyze } from './src/index.js';

const result = analyze('abracadabra', { top: 2 });

result.length;        // 11
result.unique;        // 5
result.counts.get('a'); // 5
result.frequencies.a;   // 5
result.top;           // [['a', 5], ['b', 2]]
result.entropy;       // ~1.823
```

Lower-level helpers are exported as well, if you already have counts and only
want one derived value:

```js
import { countChars, frequencies, topN, entropy, normalize } from './src/index.js';

const counts = countChars('hello');
frequencies(counts);     // { h: 1, e: 1, l: 2, o: 1 }
topN(counts, 1);         // [['l', 2]]
entropy(counts);         // ~1.922
normalize('a\u{1F600}b'); // ['a', '\u{1F600}', 'b']
```

## Why this exists

Statistical and cryptographic analysis of text almost always needs the same
three things from a corpus: a count per character, a ranking of the most
frequent characters, and an entropy figure. Writing that inline is easy to get
subtly wrong — the sort order of tied counts is a classic source of flaky
snapshots, and an empty corpus quietly turns entropy into `NaN`. This library
pins down one behaviour per function and returns it consistently.

The main trade-off is the unit of analysis. By default the library counts
UTF-16 code units, matching what `text.length` reports and what byte-oriented
analysis pipelines expect. Code-point iteration is available through
`normalize`, but it is opt-in: a caller who wants whole-codepoint counts must
say so, and the two modes are never mixed inside a single call.

## The awkward edge

A surrogate pair is one character to a reader and two entries to `countChars`.
`analyze('\u{1F600}')` therefore reports `length === 2` and `unique === 2`, not
`1` and `1`. If you need code-point semantics, run the text through `normalize`
first and count the resulting array yourself; the library will not silently do
it for you, because silently switching units would make the counts
non-additive across concatenated fragments.

## Performance

The window keeps a bounded buffer, so `push` is constant time and memory does not
grow with the length of the stream. `peak` and `trough` are linear in the window
size, which is the trade that keeps `push` cheap.

