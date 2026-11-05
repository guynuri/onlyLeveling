// Password hashing with PBKDF2-SHA256 through Web Crypto (PLAN Phase 4: no auth library).
import { AUTH } from '../config';

export interface StoredPassword {
  hash: string; // hex
  salt: string; // hex, random per user
  iterations: number;
}

const enc = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<StoredPassword> {
  if (password.length < AUTH.minPasswordLength) {
    throw new Error(`Password must be at least ${AUTH.minPasswordLength} characters.`);
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iterations = AUTH.pbkdf2Iterations;
  const hash = await derive(password, salt, iterations);
  return { hash: toHex(hash), salt: toHex(salt), iterations };
}

// Constant-time comparison of the derived key with the stored one.
export async function verifyPassword(password: string, stored: StoredPassword): Promise<boolean> {
  const got = await derive(password, fromHex(stored.salt), stored.iterations);
  const want = fromHex(stored.hash);
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ want[i];
  return diff === 0;
}
