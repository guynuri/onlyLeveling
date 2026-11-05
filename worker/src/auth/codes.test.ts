import { describe, it, expect } from 'vitest';
import { generateCode, hashCode, sha256Hex, isValidUsername } from './codes';

describe('invite codes and tokens', () => {
  it('a code carries at least 128 bits of randomness (20 bytes, base32 → 32 chars)', () => {
    const c = generateCode();
    expect(c).toMatch(/^[A-Z2-7]{32}$/);
    expect(c.length * 5).toBeGreaterThanOrEqual(128);
  });

  it('codes are unique', () => {
    const set = new Set(Array.from({ length: 200 }, () => generateCode()));
    expect(set.size).toBe(200);
  });

  it('a stored code is a hash, never the code itself', async () => {
    const c = generateCode();
    const h = await hashCode(c);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain(c);
    expect(await hashCode(c)).toBe(h);
  });

  it('sha256Hex matches a known vector', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('usernames', () => {
  it.each(['guy', 'guy_2', 'a'.repeat(3), 'a'.repeat(32)])('accepts %s', (u) => {
    expect(isValidUsername(u)).toBe(true);
  });

  it.each(['', 'ab', 'a'.repeat(33), 'Has Space', 'emoji😀', 'semi;colon', '../x'])('rejects %s', (u) => {
    expect(isValidUsername(u)).toBe(false);
  });
});
