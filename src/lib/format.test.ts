import { describe, expect, it } from 'vitest';
import { durationSince, firstName, initials, relativeTime } from './format';

describe('relativeTime', () => {
  const now = Date.parse('2026-09-15T12:00:00Z');
  it('handles missing and very recent dates', () => {
    expect(relativeTime(null, now)).toBe('без дата');
    expect(relativeTime('2026-09-15T11:59:40Z', now)).toBe('току-що');
  });
  it('uses minutes, hours and days, then a date', () => {
    expect(relativeTime('2026-09-15T11:55:00Z', now)).toMatch(/5 минути/);
    expect(relativeTime('2026-09-15T09:00:00Z', now)).toMatch(/3 часа/);
    expect(relativeTime('2026-09-13T12:00:00Z', now)).toMatch(/2 дни|онзи ден/);
    expect(relativeTime('2026-08-01T12:00:00Z', now)).toMatch(/2026/);
  });
});

describe('names', () => {
  it('extracts first name and initials', () => {
    expect(firstName('  Мария Иванова ')).toBe('Мария');
    expect(initials('Мария Иванова')).toBe('МИ');
    expect(initials('Petar')).toBe('PE');
  });
});

describe('durationSince', () => {
  const now = Date.parse('2026-09-15T12:00:00Z');
  it('picks the right unit and plural', () => {
    expect(durationSince(null, now)).toBeNull();
    expect(durationSince('2026-09-15T12:00:00Z', now)).toBe('1 минута');
    expect(durationSince('2026-09-15T11:15:00Z', now)).toBe('45 минути');
    expect(durationSince('2026-09-15T11:00:00Z', now)).toBe('1 час');
    expect(durationSince('2026-09-15T07:00:00Z', now)).toBe('5 часа');
    expect(durationSince('2026-09-14T11:00:00Z', now)).toBe('1 ден');
    expect(durationSince('2026-09-01T12:00:00Z', now)).toBe('14 дни');
  });
  it('never goes negative for clock skew', () => {
    expect(durationSince('2026-09-15T12:05:00Z', now)).toBe('1 минута');
  });
});
