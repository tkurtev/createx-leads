import { describe, expect, it } from 'vitest';
import { markSeen, parseSeen, seedSeen, unseenIds } from './seen';

describe('seen tracking', () => {
  it('treats everything on the first visit as already known', () => {
    const state = seedSeen(null, ['a', 'b']);
    expect(unseenIds(state, ['a', 'b'])).toEqual([]);
  });

  it('flags leads that arrive later', () => {
    const state = seedSeen(null, ['a']);
    expect(unseenIds(state, ['c', 'a', 'd'])).toEqual(['c', 'd']);
  });

  it('keeps an existing state instead of reseeding', () => {
    const state = seedSeen({ known: ['a'] }, ['a', 'b']);
    expect(unseenIds(state, ['a', 'b'])).toEqual(['b']);
  });

  it('marks leads as seen without duplicates and returns the same object when nothing changes', () => {
    const state = { known: ['a'] };
    const next = markSeen(state, ['b', 'a', 'b']);
    expect(next.known).toEqual(['a', 'b']);
    expect(markSeen(next, ['a'])).toBe(next);
  });

  it('survives corrupt storage', () => {
    expect(parseSeen(null)).toBeNull();
    expect(parseSeen('{oops')).toBeNull();
    expect(parseSeen('{"known":"a"}')).toBeNull();
    expect(parseSeen('{"known":["a",3]}')).toEqual({ known: ['a'] });
  });
});
