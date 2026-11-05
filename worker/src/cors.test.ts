import { describe, it, expect } from 'vitest';
import { corsHeaders } from './cors';

describe('CORS allowlist (CLAUDE.md: exactly the Pages origin and localhost dev)', () => {
  it('echoes the GitHub Pages origin', () => {
    const h = corsHeaders('https://guynuri.github.io');
    expect(h['Access-Control-Allow-Origin']).toBe('https://guynuri.github.io');
    expect(h['Access-Control-Allow-Headers']).toContain('Authorization');
  });

  it('echoes localhost for dev', () => {
    expect(corsHeaders('http://localhost:5173')['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
  });

  it('gives no allow-origin to any other origin, including look-alikes', () => {
    for (const origin of [
      'https://evil.example',
      'https://guynuri.github.io.evil.example',
      'http://guynuri.github.io',
      'https://onlyleveling.workers.dev',
      null,
    ]) {
      expect(corsHeaders(origin)['Access-Control-Allow-Origin']).toBeUndefined();
    }
  });

  it('never allows credentials (no cookies)', () => {
    expect(corsHeaders('https://guynuri.github.io')['Access-Control-Allow-Credentials']).toBeUndefined();
  });
});
