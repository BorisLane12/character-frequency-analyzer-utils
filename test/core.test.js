import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyze,
  normalize,
  countChars,
  frequencies,
  topN,
  entropy,
} from '../src/index.js';

test('countChars counts code units, not code points', () => {
  // '\u{1F600}' is a single code point but two UTF-16 code units.
  const counts = countChars('a\u{1F600}b');
  assert.equal(counts.get('a'), 1);
  assert.equal(counts.get('b'), 1);
  assert.equal(counts.size, 4);
  assert.equal(counts.get('\uD83D'), 1);
  assert.equal(counts.get('\uDE00'), 1);
});

test('countChars handles the empty string', () => {
  const counts = countChars('');
  assert.equal(counts.size, 0);
});

test('countChars rejects non-strings', () => {
  assert.throws(() => countChars(42), TypeError);
  assert.throws(() => countChars(null), TypeError);
});

test('normalize splits into code points', () => {
  assert.deepEqual(normalize('a\u{1F600}b'), ['a', '\u{1F600}', 'b']);
  assert.deepEqual(normalize(''), []);
});

test('normalize rejects non-strings', () => {
  assert.throws(() => normalize(undefined), TypeError);
});

test('frequencies builds a null-prototype object', () => {
  const counts = countChars('aab');
  const freq = frequencies(counts);
  assert.equal(Object.getPrototypeOf(freq), null);
  assert.equal(freq.a, 2);
  assert.equal(freq.b, 1);
  assert.equal(freq.hasOwnProperty, undefined);
});

test('frequencies rejects non-Map input', () => {
  assert.throws(() => frequencies({ a: 1 }), TypeError);
});

test('topN sorts by descending count and breaks ties by code unit', () => {
  const counts = countChars('bbaacc');
  // a:2, b:2, c:2 -> all tied, so ascending code unit: a, b, c
  assert.deepEqual(topN(counts, 3), [
    ['a', 2],
    ['b', 2],
    ['c', 2],
  ]);
});

test('topN honours the requested length', () => {
  const counts = countChars('aaabbc');
  assert.deepEqual(topN(counts, 1), [['a', 3]]);
  assert.deepEqual(topN(counts, 0), []);
});

test('topN rejects bad n', () => {
  const counts = countChars('abc');
  assert.throws(() => topN(counts, -1), RangeError);
  assert.throws(() => topN(counts, 1.5), RangeError);
});

test('entropy is zero for empty and single-character distributions', () => {
  assert.equal(entropy(countChars('')), 0);
  assert.equal(entropy(countChars('aaaa')), 0);
});

test('entropy is one bit for a fair coin', () => {
  const h = entropy(countChars('ab'));
  assert.ok(Math.abs(h - 1) < 1e-12, `expected ~1, got ${h}`);
});

test('analyze returns a frozen, self-consistent summary', () => {
  const result = analyze('abracadabra', { top: 2 });
  assert.equal(result.length, 11);
  assert.equal(result.unique, 5);
  assert.equal(result.counts.get('a'), 5);
  assert.equal(result.frequencies.a, 5);
  assert.deepEqual(result.top, [
    ['a', 5],
    ['b', 2],
  ]);
  assert.ok(Math.abs(result.entropy - entropy(result.counts)) < 1e-12);
  assert.ok(Object.isFrozen(result));
});

test('analyze defaults top to 10', () => {
  const result = analyze('abcdefghijklm');
  assert.equal(result.top.length, 10);
});

test('analyze rejects bad options', () => {
  assert.throws(() => analyze('abc', { top: -1 }), RangeError);
  assert.throws(() => analyze('abc', { top: 2.5 }), RangeError);
});
