import { describe, it, expect } from 'vitest';
import { b64uEncode, b64uDecode, encryptForDevice, vapidAuthorization, type VapidConfig } from './webpush';

const enc = new TextEncoder();
const dec = new TextDecoder();

// A fresh VAPID key pair for the test, in the same shape the app's keys have.
async function vapidKeys(): Promise<VapidConfig> {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey('jwk', pair.privateKey)) as JsonWebKey;
  const raw = new Uint8Array((await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer);
  return { publicKey: b64uEncode(raw), privateJwk: jwk, subject: 'https://example.test/' };
}

// A device: its own ECDH key pair and an auth secret, as the browser makes them.
async function device() {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
  const p256dh = new Uint8Array((await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer);
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return {
    sub: { endpoint: 'https://push.example.test/abc', p256dh: b64uEncode(p256dh), auth: b64uEncode(auth) },
    privateKey: pair.privateKey,
    p256dh,
    auth,
  };
}

// What the browser does (RFC 8291), written out separately from the sender, so a mistake on either side shows up.
async function decryptAsDevice(body: Uint8Array, d: Awaited<ReturnType<typeof device>>): Promise<string> {
  const salt = body.slice(0, 16);
  const idLen = body[20];
  const asPublic = body.slice(21, 21 + idLen);
  const ciphertext = body.slice(21 + idLen);
  const asKey = await crypto.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const derive = { name: 'ECDH', public: asKey } as unknown as SubtleCryptoDeriveKeyAlgorithm;
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits(derive, d.privateKey, 256));
  const hkdf = async (ikm: Uint8Array, s: Uint8Array, info: Uint8Array, n: number) => {
    const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: s, info }, k, n * 8));
  };
  const ikm = await hkdf(ecdh, d.auth, concatBytes(enc.encode('WebPush: info\0'), d.p256dh, asPublic), 32);
  const cek = await hkdf(ikm, salt, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(ikm, salt, enc.encode('Content-Encoding: nonce\0'), 12);
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const padded = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, aes, ciphertext));
  expect(padded[padded.length - 1]).toBe(2); // the last-record delimiter
  return dec.decode(padded.slice(0, padded.length - 1));
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

describe('base64url', () => {
  it('round-trips bytes', () => {
    const bytes = Uint8Array.from([0, 1, 250, 251, 252, 253, 254, 255]);
    expect(b64uDecode(b64uEncode(bytes))).toEqual(bytes);
    expect(b64uEncode(bytes)).not.toMatch(/[+/=]/);
  });
});

describe('payload encryption (RFC 8291)', () => {
  it('the device decrypts exactly what was sent', async () => {
    const d = await device();
    const body = await encryptForDevice(enc.encode('{"kind":"rest"}'), d.sub);
    expect(await decryptAsDevice(body, d)).toBe('{"kind":"rest"}');
  });

  it('a different device cannot decrypt it', async () => {
    const d = await device();
    const other = await device();
    const body = await encryptForDevice(enc.encode('secret'), d.sub);
    await expect(decryptAsDevice(body, other)).rejects.toThrow();
  });

  it('each send uses a fresh salt and key, so equal messages do not look equal', async () => {
    const d = await device();
    const a = await encryptForDevice(enc.encode('same'), d.sub);
    const b = await encryptForDevice(enc.encode('same'), d.sub);
    expect(a.slice(0, 16)).not.toEqual(b.slice(0, 16));
  });
});

describe('VAPID authorization (RFC 8292)', () => {
  it('a signed JWT with the push origin as audience, verifiable with the public key', async () => {
    const keys = await vapidKeys();
    const header = await vapidAuthorization('https://push.example.test/abc', keys, Date.UTC(2026, 10, 5));
    const m = /^vapid t=([^,]+), k=(.+)$/.exec(header);
    expect(m).not.toBeNull();
    const [h, c, s] = m![1].split('.');
    const claims = JSON.parse(dec.decode(b64uDecode(c)));
    expect(claims.aud).toBe('https://push.example.test');
    expect(claims.sub).toBe('https://example.test/');
    expect(claims.exp).toBeGreaterThan(Date.UTC(2026, 10, 5) / 1000);
    expect(claims.exp - Date.UTC(2026, 10, 5) / 1000).toBeLessThanOrEqual(24 * 3600);
    expect(m![2]).toBe(keys.publicKey);
    // The signature checks out against the public key the header names.
    const pub = await crypto.subtle.importKey('raw', b64uDecode(m![2]), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, b64uDecode(s), enc.encode(`${h}.${c}`));
    expect(ok).toBe(true);
  });
});
