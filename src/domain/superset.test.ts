import { describe, it, expect } from 'vitest';
import { afterSet, groupOf, linkNext, supersetLabel, supersetsOf, unlink } from './superset';

const day = (supersets?: string[][]) => ({ exerciseIds: ['a', 'b', 'c', 'd', 'e'], supersets });

describe('supersetsOf', () => {
  it('keeps adjacent groups of 2–3 in day order and drops stale ones', () => {
    expect(supersetsOf(day([['d', 'e'], ['a', 'b']]))).toEqual([['a', 'b'], ['d', 'e']]);
    expect(supersetsOf(day([['a', 'c']]))).toEqual([]); // not adjacent
    expect(supersetsOf(day([['b', 'a']]))).toEqual([]); // out of order
    expect(supersetsOf(day([['a']]))).toEqual([]); // too small
    expect(supersetsOf(day([['a', 'b', 'c', 'd']]))).toEqual([]); // too big
    expect(supersetsOf(day([['a', 'x']]))).toEqual([]); // removed exercise
    expect(supersetsOf(day([['a', 'b'], ['b', 'c']]))).toEqual([['a', 'b']]); // overlap
  });
  it('labels A1, A2, B1 in day order', () => {
    const d = day([['d', 'e'], ['a', 'b']]);
    expect(supersetLabel(d, 'b')).toBe('A2');
    expect(supersetLabel(d, 'd')).toBe('B1');
    expect(supersetLabel(d, 'c')).toBeNull();
    expect(groupOf(d, 'e')).toEqual(['d', 'e']);
  });
});

describe('linkNext and unlink', () => {
  it('links into pairs and triples, never past 3', () => {
    expect(linkNext(day(), 'a')).toEqual([['a', 'b']]);
    expect(linkNext(day([['a', 'b']]), 'a')).toEqual([['a', 'b', 'c']]);
    expect(linkNext(day([['a', 'b', 'c']]), 'b')).toEqual([['a', 'b', 'c']]);
    expect(linkNext(day([['a', 'b'], ['c', 'd']]), 'a')).toEqual([['a', 'b'], ['c', 'd']]); // 4 would be too big
    expect(linkNext(day(), 'e')).toEqual([]); // nothing after the last
  });
  it('unlinking dissolves a pair and splits a triple', () => {
    expect(unlink(day([['a', 'b']]), 'a')).toEqual([]);
    expect(unlink(day([['a', 'b', 'c']]), 'c')).toEqual([['a', 'b']]);
    expect(unlink(day([['a', 'b', 'c']]), 'b')).toEqual([]);
  });
});

describe('afterSet', () => {
  const d = day([['a', 'b', 'c']]);
  it('moves through the round without rest, rests at the end and starts over', () => {
    const left = (m: Record<string, number>) => (id: string) => m[id] ?? 0;
    expect(afterSet(d, 'a', left({ a: 2, b: 3, c: 3 }))).toEqual({ rest: false, next: 'b' });
    expect(afterSet(d, 'b', left({ a: 2, b: 2, c: 0 }))).toEqual({ rest: true, next: 'a' }); // c is done
    expect(afterSet(d, 'c', left({ a: 2, b: 2, c: 2 }))).toEqual({ rest: true, next: 'a' });
    expect(afterSet(d, 'c', left({}))).toEqual({ rest: true, next: null }); // superset finished
    expect(afterSet(d, 'd', left({ d: 2 }))).toEqual({ rest: true, next: null }); // not in a group
  });
});
