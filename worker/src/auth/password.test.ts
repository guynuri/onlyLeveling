import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password hashing (PBKDF2-SHA256, Web Crypto)', () => {
  it('a correct password verifies, a wrong one does not', async () => {
    const stored = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('correct horse battery staple', stored)).toBe(true);
    expect(await verifyPassword('correct horse battery stapl', stored)).toBe(false);
  });

  it('the same password hashes differently each time (per-user salt)', async () => {
    const a = await hashPassword('same password');
    const b = await hashPassword('same password');
    expect(a).not.toBe(b);
    expect(a.salt).not.toBe(b.salt);
  });

  it('stores the iteration count with the hash, so it can be raised later', async () => {
    const stored = await hashPassword('x'.repeat(12));
    expect(stored.iterations).toBeGreaterThanOrEqual(100_000);
    expect(stored.hash).not.toContain('x'.repeat(12));
  });

  it('refuses a password shorter than 10 characters', async () => {
    await expect(hashPassword('short')).rejects.toThrow(/at least 10/);
  });
});
