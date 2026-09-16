import { describe, expect, it, vi } from 'vitest';
import type { Activity } from '@/lib/leads/types';
import type { LeadStore } from '@/lib/store/types';
import { handleCallEnded } from './handle-call-ended';
import type { CallEnded } from './types';
import * as analyzeModule from './analyze';

const env = { ANTHROPIC_API_KEY: 'sk-test', ANALYSIS_MODEL: 'claude-opus-5', AGENT_NAME: 'AI агент' };

const ended = (extra: Partial<CallEnded> = {}): CallEnded => ({
  provider: 'vapi',
  callId: 'call_1',
  leadId: 'l_1',
  leadName: 'Мария',
  phone: '+359888111222',
  reached: true,
  endedReason: 'customer-ended-call',
  durationSec: 95,
  transcript: [
    { role: 'agent', text: 'Добър ден!', at: 0 },
    { role: 'lead', text: 'Здравейте, интересувам се.', at: 4 },
  ],
  providerFacts: [],
  ...extra,
});

function store(overrides: Partial<LeadStore> = {}) {
  return {
    readActivity: vi.fn(async () => [] as Activity[]),
    readLeadRows: vi.fn(async () => [] as string[][]),
    appendLeadRow: vi.fn(async () => {}),
    appendActivity: vi.fn(async (a) => ({ ...a, id: 'a_1', at: '2026-09-16T12:00:00.000Z' })),
    ...overrides,
  } as unknown as LeadStore;
}

const analysis = {
  summary: 'Иска оферта до края на седмицата.',
  outcome: 'interested' as const,
  qualification: 'hot' as const,
  nextSteps: ['Изпрати оферта по имейл'],
  callbackAt: '2026-09-18T14:00:00.000Z',
  facts: [{ label: 'Срок', value: 'до петък' }],
};

describe('handleCallEnded', () => {
  it('records the conversation with what was understood from it', async () => {
    const spy = vi.spyOn(analyzeModule, 'analyzeCall').mockResolvedValue(analysis);
    const db = store();

    const result = await handleCallEnded({ env, store: db, call: ended() });

    expect(result.status).toBe('recorded');
    expect(spy).toHaveBeenCalledOnce();
    expect(db.appendActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId: 'l_1',
        leadName: 'Мария',
        author: 'AI агент',
        type: 'call',
        status: 'interested',
        text: 'Иска оферта до края на седмицата.',
        call: expect.objectContaining({
          provider: 'vapi',
          state: 'ended',
          reached: true,
          qualification: 'hot',
          nextSteps: ['Изпрати оферта по имейл'],
          callbackAt: '2026-09-18T14:00:00.000Z',
          durationSec: 95,
        }),
      }),
    );
    spy.mockRestore();
  });

  it('keeps the fields the calling platform was configured to extract, and adds the rest', async () => {
    const spy = vi.spyOn(analyzeModule, 'analyzeCall').mockResolvedValue({
      ...analysis,
      facts: [
        { label: 'Срок', value: 'някога' },
        { label: 'Град', value: 'Пловдив' },
      ],
    });
    const db = store();

    await handleCallEnded({
      env,
      store: db,
      call: ended({ providerFacts: [{ label: 'Срок', value: 'до петък' }] }),
    });

    const written = vi.mocked(db.appendActivity).mock.calls[0][0];
    expect(written.call?.facts).toEqual([
      { label: 'Срок', value: 'до петък' },
      { label: 'Град', value: 'Пловдив' },
    ]);
    spy.mockRestore();
  });

  it('marks an unanswered call without spending anything on reading it', async () => {
    const spy = vi.spyOn(analyzeModule, 'analyzeCall');
    const db = store();

    await handleCallEnded({
      env,
      store: db,
      call: ended({ reached: false, endedReason: 'voicemail', endedExplanation: 'Включи се гласова поща', transcript: [] }),
    });

    expect(spy).not.toHaveBeenCalled();
    expect(db.appendActivity).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'no_answer', text: 'Включи се гласова поща' }),
    );
    spy.mockRestore();
  });

  it('still saves the conversation when it cannot be read', async () => {
    const spy = vi.spyOn(analyzeModule, 'analyzeCall').mockRejectedValue(new Error('rate limited'));
    const db = store();

    const result = await handleCallEnded({ env, store: db, call: ended({ providerSummary: 'Има интерес.' }) });

    expect(result.status).toBe('recorded');
    const written = vi.mocked(db.appendActivity).mock.calls[0][0];
    expect(written.status).toBe('in_progress');
    expect(written.text).toContain('Има интерес.');
    expect(written.text).toContain('rate limited');
    expect(written.call?.transcript).toHaveLength(2);
    spy.mockRestore();
  });

  it('falls back to the platform summary when no analysis key is configured', async () => {
    const spy = vi.spyOn(analyzeModule, 'analyzeCall');
    const db = store();

    await handleCallEnded({
      env: { ...env, ANTHROPIC_API_KEY: undefined },
      store: db,
      call: ended({ providerSummary: 'Иска да го потърсят утре.' }),
    });

    expect(spy).not.toHaveBeenCalled();
    expect(vi.mocked(db.appendActivity).mock.calls[0][0].text).toBe('Иска да го потърсят утре.');
    spy.mockRestore();
  });

  it('writes a call only once, however many times the webhook arrives', async () => {
    const db = store({
      readActivity: vi.fn(async () => [
        { id: 'a_0', leadId: 'l_1', at: '2026-09-16T11:00:00Z', author: 'AI агент', type: 'call', text: '', call: { provider: 'vapi', state: 'ended', callId: 'call_1' } },
      ] as Activity[]),
    });

    expect(await handleCallEnded({ env, store: db, call: ended() })).toEqual({ status: 'duplicate', callId: 'call_1' });
    expect(db.appendActivity).not.toHaveBeenCalled();
  });

  it('does not treat a call still ringing as already recorded', async () => {
    const spy = vi.spyOn(analyzeModule, 'analyzeCall').mockResolvedValue(analysis);
    const db = store({
      readActivity: vi.fn(async () => [
        { id: 'a_0', leadId: 'l_1', at: '2026-09-16T11:00:00Z', author: 'AI агент', type: 'call', text: '', call: { provider: 'vapi', state: 'queued', callId: 'call_1' } },
      ] as Activity[]),
    });

    expect((await handleCallEnded({ env, store: db, call: ended() })).status).toBe('recorded');
    spy.mockRestore();
  });

  it('finds the lead by phone when the call came back without one', async () => {
    const spy = vi.spyOn(analyzeModule, 'analyzeCall').mockResolvedValue(analysis);
    const db = store({
      readLeadRows: vi.fn(async () => [
        ['Date', 'Name', 'Phone Number', 'E-Mail'],
        ['2026-09-16T10:00:00Z', 'Мария Тестова', 'p:+359888111222', 'maria@example.com'],
      ]),
    });

    const result = await handleCallEnded({ env, store: db, call: ended({ leadId: null, leadName: undefined }) });

    expect(result.status).toBe('recorded');
    expect(vi.mocked(db.appendActivity).mock.calls[0][0].leadName).toBe('Мария Тестова');
    spy.mockRestore();
  });

  it('gives up rather than guess when no lead matches', async () => {
    const db = store();
    const result = await handleCallEnded({ env, store: db, call: ended({ leadId: null, phone: '+359888999999' }) });
    expect(result).toEqual({ status: 'unknown-lead', phone: '+359888999999' });
    expect(db.appendActivity).not.toHaveBeenCalled();
  });
});
