// Invite codes and session tokens: random, and stored only as hashes (PLAN Phase 4b).
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// 20 random bytes = 160 bits, base32 without padding = 32 characters.
export function generateCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function hashCode(code: string): Promise<string> {
  return sha256Hex(code);
}

// Session tokens: 32 random bytes, hex. Only the hash is stored.
export function generateToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('');
}

const USERNAME = /^[a-z0-9_]{3,32}$/;
export function isValidUsername(u: string): boolean {
  return USERNAME.test(u);
}
