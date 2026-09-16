import { describe, expect, it } from 'vitest';
import { parseVapiWebhook, toFacts, toTranscript, verifyVapiSecret } from './vapi';

const report = (message: Record<string, unknown>) => ({
  message: { type: 'end-of-call-report', ...message },
});

const full = report({
  endedReason: 'customer-ended-call',
  startedAt: '2026-09-16T12:00:00.000Z',
  endedAt: '2026-09-16T12:01:35.000Z',
  call: {
    id: 'call_1',
    assistantOverrides: { metadata: { leadId: 'l_8gu0og', leadName: 'Мария Тестова', app: 'createx-leads' } },
  },
  customer: { number: '+359888111222' },
  artifact: {
    recordingUrl: 'https://rec.example/1.mp3',
    messages: [
      { role: 'system', message: 'Ти си асистент.', secondsFromStart: 0 },
      { role: 'bot', message: 'Добър ден!', secondsFromStart: 0.4 },
      { role: 'user', message: 'Здравейте.', secondsFromStart: 3.6 },
      { role: 'tool_calls', message: '', secondsFromStart: 5 },
      { role: 'bot', message: '   ', secondsFromStart: 6 },
    ],
  },
  analysis: {
    summary: 'Клиентът иска оферта.',
    structuredData: { budgetRange: 'до 5000 лв', readyToBuy: true, preferredTimes: ['четвъртък', 'петък'], empty: '' },
  },
});

describe('parseVapiWebhook', () => {
  it('reads a finished call end to end', () => {
    const parsed = parseVapiWebhook(full);
    expect(parsed.kind).toBe('call-ended');
    if (parsed.kind !== 'call-ended') return;
    expect(parsed.call).toMatchObject({
      provider: 'vapi',
      callId: 'call_1',
      leadId: 'l_8gu0og',
      leadName: 'Мария Тестова',
      phone: '+359888111222',
      reached: true,
      endedReason: 'customer-ended-call',
      endedExplanation: 'Клиентът затвори',
      durationSec: 95,
      recordingUrl: 'https://rec.example/1.mp3',
      providerSummary: 'Клиентът иска оферта.',
    });
  });

  it('keeps only what was actually spoken, in order', () => {
    const parsed = parseVapiWebhook(full);
    if (parsed.kind !== 'call-ended') throw new Error('expected a call');
    expect(parsed.call.transcript).toEqual([
      { role: 'agent', text: 'Добър ден!', at: 0 },
      { role: 'lead', text: 'Здравейте.', at: 4 },
    ]);
  });

  it('turns whatever the assistant was configured to extract into readable facts', () => {
    const parsed = parseVapiWebhook(full);
    if (parsed.kind !== 'call-ended') throw new Error('expected a call');
    expect(parsed.call.providerFacts).toEqual([
      { label: 'Budget range', value: 'до 5000 лв' },
      { label: 'Ready to buy', value: 'да' },
      { label: 'Preferred times', value: 'четвъртък, петък' },
    ]);
  });

  it('says nobody was reached when the phone rang out, even with a greeting on the tape', () => {
    const parsed = parseVapiWebhook(
      report({
        endedReason: 'voicemail',
        call: { id: 'c2', assistantOverrides: { metadata: { leadId: 'l_1' } } },
        artifact: { messages: [{ role: 'bot', message: 'Добър ден!' }, { role: 'user', message: 'Оставете съобщение' }] },
        analysis: {},
      }),
    );
    if (parsed.kind !== 'call-ended') throw new Error('expected a call');
    expect(parsed.call).toMatchObject({ reached: false, endedExplanation: 'Включи се гласова поща' });
  });

  it('says nobody was reached when only the agent spoke', () => {
    const parsed = parseVapiWebhook(
      report({ endedReason: 'silence-timed-out', artifact: { messages: [{ role: 'bot', message: 'Ало?' }] }, analysis: {} }),
    );
    if (parsed.kind !== 'call-ended') throw new Error('expected a call');
    expect(parsed.call.reached).toBe(false);
  });

  it('ignores the other events Vapi sends', () => {
    expect(parseVapiWebhook({ message: { type: 'status-update', status: 'ringing' } })).toEqual({
      kind: 'ignored',
      reason: 'status-update',
    });
    expect(parseVapiWebhook({})).toMatchObject({ kind: 'ignored' });
    expect(parseVapiWebhook(null)).toMatchObject({ kind: 'ignored' });
  });

  it('survives a report with nothing in it but the type', () => {
    const parsed = parseVapiWebhook(report({}));
    if (parsed.kind !== 'call-ended') throw new Error('expected a call');
    expect(parsed.call).toMatchObject({ provider: 'vapi', leadId: null, reached: false, transcript: [], providerFacts: [] });
    expect(parsed.call.durationSec).toBeUndefined();
  });

  it('trims a call too long to keep, saving the end of it', () => {
    const messages = Array.from({ length: 300 }, (_, i) => ({
      role: i % 2 === 0 ? 'bot' : 'user',
      message: `дълга реплика номер ${i} `.repeat(20),
      secondsFromStart: i,
    }));
    const parsed = parseVapiWebhook(report({ artifact: { messages }, analysis: {}, endedReason: 'customer-ended-call' }));
    if (parsed.kind !== 'call-ended') throw new Error('expected a call');
    expect(parsed.call.transcriptTrimmed).toBe(true);
    expect(parsed.call.transcript.at(-1)?.at).toBe(299);
    expect(parsed.call.transcript.reduce((n, t) => n + t.text.length, 0)).toBeLessThanOrEqual(20_000);
  });
});

describe('helpers', () => {
  it('ignore transcript entries that are not speech', () => {
    expect(toTranscript(undefined)).toEqual([]);
    expect(toTranscript('nope')).toEqual([]);
    expect(toTranscript([{ role: 'tool_call_result', message: 'x' }])).toEqual([]);
  });

  it('ignore structured data that is not an object', () => {
    expect(toFacts(null)).toEqual([]);
    expect(toFacts(['a'])).toEqual([]);
    expect(toFacts({ note: { nested: 1 } })).toEqual([{ label: 'Note', value: '{"nested":1}' }]);
  });

  it('accept only the exact webhook secret', () => {
    expect(verifyVapiSecret('s3cret', 's3cret')).toBe(true);
    expect(verifyVapiSecret('s3cre7', 's3cret')).toBe(false);
    expect(verifyVapiSecret('s3cret-longer', 's3cret')).toBe(false);
    expect(verifyVapiSecret(null, 's3cret')).toBe(false);
  });
});
