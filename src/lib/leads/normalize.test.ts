import { describe, expect, it } from 'vitest';
import { formatPhone, humanize, normalizeEmail, normalizePhone, parseDate, viberLink, whatsappLink } from './normalize';

describe('normalizePhone', () => {
  it.each([
    ['p:+359888000111', '+359888000111'],
    ['359888000222', '+359888000222'],
    ['3590888000333', '+359888000333'],
    ['0888 123 456', '+359888123456'],
    ['888000444', '+359888000444'],
    ['+44 7700 900123', '+447700900123'],
  ])('%s -> %s', (raw, expected) => {
    expect(normalizePhone(raw)).toBe(expected);
  });

  it.each(['', ' ', '#ERROR!', '899989404x', 'здравейте', '35988', '12345'])('rejects %j', (raw) => {
    expect(normalizePhone(raw)).toBeNull();
  });
});

describe('formatPhone', () => {
  it('groups Bulgarian mobiles', () => {
    expect(formatPhone('+359888000111')).toBe('+359 88 800 0111');
  });
  it('leaves foreign numbers alone', () => {
    expect(formatPhone('+447700900123')).toBe('+447700900123');
  });
});

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  Demo.User@EXAMPLE.com ')).toBe('demo.user@example.com');
  });
  it('rejects junk', () => {
    expect(normalizeEmail('not-an-email')).toBeNull();
    expect(normalizeEmail('')).toBeNull();
  });
});

describe('parseDate', () => {
  it('parses Meta offsets with a colon', () => {
    expect(parseDate('2023-09-03T19:41:42+03:00')).toBe('2023-09-03T16:41:42.000Z');
  });
  it('strips the "cre" prefix and handles +0000', () => {
    expect(parseDate('cre2023-09-12T14:53:13+0000')).toBe('2023-09-12T14:53:13.000Z');
  });
  it('accepts a space separated timestamp', () => {
    expect(parseDate('2023-10-11 13:25:30')).not.toBeNull();
  });
  it('returns null for non dates', () => {
    expect(parseDate('')).toBeNull();
    expect(parseDate('утре')).toBeNull();
    expect(parseDate('2023-13-45T99:99:99')).toBeNull();
  });
});

describe('humanize', () => {
  it('turns form keys into sentences', () => {
    expect(humanize('от_какво_лечение_имате_нужда?')).toBe('От какво лечение имате нужда?');
  });
  it('keeps empty values empty', () => {
    expect(humanize('   ')).toBe('');
  });
});

describe('messenger links', () => {
  it('builds Viber and WhatsApp deep links', () => {
    expect(viberLink('+359888123456')).toBe('viber://chat?number=%2B359888123456');
    expect(whatsappLink('+359888123456')).toBe('https://wa.me/359888123456');
  });
});
