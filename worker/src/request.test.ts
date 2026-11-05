import { describe, it, expect } from 'vitest';
import { readLimitedText, TooLargeError, MAX_BODY_BYTES } from './request';

describe('request body limit (measured in bytes, refused before it is read when declared)', () => {
  it('reads a small body', async () => {
    expect(await readLimitedText(new Request('https://x.example', { method: 'POST', body: '{"a":1}' }))).toBe('{"a":1}');
  });

  it('refuses a body over the limit, measured in bytes not characters', async () => {
    // 340,000 three-byte characters is about 1.02 MB: under a character count, over the byte limit.
    const body = '€'.repeat(340_000);
    await expect(readLimitedText(new Request('https://x.example', { method: 'POST', body }))).rejects.toBeInstanceOf(
      TooLargeError,
    );
  });

  it('refuses by the declared Content-Length before reading', async () => {
    const req = new Request('https://x.example', {
      method: 'POST',
      headers: { 'Content-Length': String(MAX_BODY_BYTES + 1) },
      body: 'x',
    });
    await expect(readLimitedText(req)).rejects.toBeInstanceOf(TooLargeError);
  });
});
