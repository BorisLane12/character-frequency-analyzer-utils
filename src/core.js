/**
 * Core character-frequency routines.
 *
 * The public surface is deliberately small: a single `analyze` entry point plus
 * a handful of pure helpers that operate on plain objects. Everything works on
 * JavaScript strings interpreted as sequences of UTF-16 code units unless the
 * caller opts into whole-codepoint handling via `normalize`.
 *
 * Why code units by default? Cryptographic and statistical analysis of text is
 * overwhelmingly done over bytes or code units, and code units are what `length`
 * and `charCodeAt` already give you. Splitting on code points is offered as a
 * separate, explicit step so that the cost and the semantic change are visible
 * at the call site.
 */

/**
 * Iterate a string as an array of code points.
 *
 * `Array.from` and the spread operator already do this, but spelling it out
 * keeps the intent obvious and gives us one place to change if we ever need to
 * drop the intermediate array for very large inputs.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function normalize(text) {
  if (typeof text !== 'string') {
    throw new TypeError('normalize expects a string');
  }
  return Array.from(text);
}

/**
 * Count occurrences of every character in `text`.
 *
 * Characters are the JS string's code units, so a surrogate pair counts as two
 * entries. That matches `text.length` and keeps the counts additive when the
 * caller concatenates fragments.
 *
 * @param {string} text
 * @returns {Map<string, number>}
 */
export function countChars(text) {
  if (typeof text !== 'string') {
    throw new TypeError('countChars expects a string');
  }
  const counts = new Map();
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    counts.set(ch, (counts.get(ch) || 0) + 1);
  }
  return counts;
}

/**
 * Convert a `Map` of counts into a plain object keyed by character.
 *
 * Plain objects are easier to serialize and to compare in tests. The trade-off
 * is that a character whose name collides with an `Object.prototype` member
 * (e.g. `"constructor"` as a single-character key is impossible, but multi-unit
 * keys passed in manually could collide) would be shadowed. We build the object
 * with a null prototype to make that impossible.
 *
 * @param {Map<string, number>} counts
 * @returns {Record<string, number>}
 */
export function frequencies(counts) {
  if (!(counts instanceof Map)) {
    throw new TypeError('frequencies expects a Map');
  }
  const out = Object.create(null);
  for (const [ch, n] of counts) {
    out[ch] = n;
  }
  return out;
}

/**
 * Return the `n` most frequent entries, sorted by descending count.
 *
 * Ties are broken by ascending code unit so the result is deterministic. A
 * stable order matters because callers routinely snapshot the top of the list
 * and compare it across runs; an unstable sort would make those comparisons
 * flaky.
 *
 * @param {Map<string, number>} counts
 * @param {number} n
 * @returns {Array<[string, number]>}
 */
export function topN(counts, n) {
  if (!(counts instanceof Map)) {
    throw new TypeError('topN expects a Map');
  }
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError('topN expects a non-negative integer');
  }
  const entries = Array.from(counts.entries());
  entries.sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
  });
  return entries.slice(0, n);
}

/**
 * Shannon entropy of the distribution, in bits per character.
 *
 * Returns 0 for the empty string rather than NaN, because callers that feed
 * empty payloads into a statistical pipeline expect a number they can add.
 *
 * @param {Map<string, number>} counts
 * @returns {number}
 */
export function entropy(counts) {
  if (!(counts instanceof Map)) {
    throw new TypeError('entropy expects a Map');
  }
  let total = 0;
  for (const n of counts.values()) total += n;
  if (total === 0) return 0;
  let h = 0;
  for (const n of counts.values()) {
    const p = n / total;
    h -= p * Math.log2(p);
  }
  return h;
}

/**
 * One-shot analysis of a text body.
 *
 * This is the convenience entry point: it runs the steps above in the order
 * that avoids redundant work (count once, then derive everything else) and
 * returns a frozen result object so callers cannot accidentally mutate the
 * counts that other derived values were computed from.
 *
 * @param {string} text
 * @param {{ top?: number }} [options]
 * @returns {{ length: number, unique: number, counts: Map<string, number>, frequencies: Record<string, number>, top: Array<[string, number]>, entropy: number }}
 */
export function analyze(text, options = {}) {
  if (typeof text !== 'string') {
    throw new TypeError('analyze expects a string');
  }
  const top = options.top === undefined ? 10 : options.top;
  if (!Number.isInteger(top) || top < 0) {
    throw new RangeError('analyze option `top` must be a non-negative integer');
  }
  const counts = countChars(text);
  return Object.freeze({
    length: text.length,
    unique: counts.size,
    counts,
    frequencies: frequencies(counts),
    top: topN(counts, top),
    entropy: entropy(counts),
  });
}
