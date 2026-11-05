import { describe, it, expect } from 'vitest';
import { parseRoute } from './route';

describe('parseRoute', () => {
  it('defaults to today for an empty or unknown hash', () => {
    expect(parseRoute('')).toEqual({ screen: 'today' });
    expect(parseRoute('#')).toEqual({ screen: 'today' });
    expect(parseRoute('#/nope')).toEqual({ screen: 'today' });
  });

  it('maps tab hashes, with or without the leading slash', () => {
    expect(parseRoute('#/history')).toEqual({ screen: 'history' });
    expect(parseRoute('#history')).toEqual({ screen: 'history' });
  });

  it('library list and library detail', () => {
    expect(parseRoute('#/library')).toEqual({ screen: 'library' });
    expect(parseRoute('#/library/fx_Dumbbell_Curl')).toEqual({ screen: 'exercise', id: 'fx_Dumbbell_Curl' });
  });

  it('credits screen', () => {
    expect(parseRoute('#/credits')).toEqual({ screen: 'credits' });
  });

  it('decodes an encoded exercise id', () => {
    expect(parseRoute('#/library/fx_a%20b')).toEqual({ screen: 'exercise', id: 'fx_a b' });
  });
});
