import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { describe, expect, it, vi } from 'vitest';

const parse = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { parse };
  },
}));

const { analyzeCall, analysisSchema, buildPrompt, renderTranscript } = await import('./analyze');

const input = {
  transcript: [
    { role: 'agent' as const, text: 'Добър ден!', at: 0 },
    { role: 'lead' as const, text: 'Здравейте.', at: 4 },
  ],
  lead: { name: 'Мария', interest: 'абонамент', message: 'искам оферта', source: 'harmony' },
  now: new Date('2026-09-16T12:00:00.000Z'),
};

describe('the analysis schema', () => {
  it('converts to a JSON schema the API accepts', () => {
    const format = zodOutputFormat(analysisSchema) as { type: string; schema: Record<string, unknown> };
    expect(format.type).toBe('json_schema');
    expect(Object.keys(format.schema.properties as object)).toEqual([
      'summary',
      'outcome',
      'qualification',
      'nextSteps',
      'callbackAt',
      'facts',
    ]);
  });
});

describe('the prompt', () => {
  it('labels who said what in Bulgarian', () => {
    expect(renderTranscript(input.transcript)).toBe('Агент: Добър ден!\nКлиент: Здравейте.');
  });

  it('carries the form answers and the moment of the call', () => {
    const prompt = buildPrompt(input);
    expect(prompt).toContain('Име: Мария');
    expect(prompt).toContain('Интерес, посочен във формата: абонамент');
    expect(prompt).toContain('Съобщение във формата: искам оферта');
    expect(prompt).toContain('2026-09-16T12:00:00.000Z');
    expect(prompt).toContain('Клиент: Здравейте.');
  });

  it('leaves out what the lead did not fill in', () => {
    const prompt = buildPrompt({ ...input, lead: { name: 'Мария' } });
    expect(prompt).not.toContain('Интерес, посочен във формата');
    expect(prompt).not.toContain('Обобщение от телефонната платформа');
  });
});

describe('analyzeCall', () => {
  it('asks for a cheap, schema-bound answer and tidies what comes back', async () => {
    parse.mockResolvedValue({
      parsed_output: {
        summary: '  Иска оферта.  ',
        outcome: 'interested',
        qualification: 'warm',
        nextSteps: [' Изпрати оферта ', '   '],
        callbackAt: null,
        facts: [
          { label: ' Бюджет ', value: ' 5000 лв ' },
          { label: '', value: 'без етикет' },
        ],
      },
    });

    const result = await analyzeCall(input, { apiKey: 'sk-test', model: 'claude-opus-5' });

    expect(result).toEqual({
      summary: 'Иска оферта.',
      outcome: 'interested',
      qualification: 'warm',
      nextSteps: ['Изпрати оферта'],
      facts: [{ label: 'Бюджет', value: '5000 лв' }],
    });
    expect(parse.mock.calls[0][0]).toMatchObject({
      model: 'claude-opus-5',
      output_config: { effort: 'low' },
    });
  });

  it('keeps a callback time when the lead asked for one', async () => {
    parse.mockResolvedValue({
      parsed_output: {
        summary: 'Да го потърсим в четвъртък.',
        outcome: 'call_back',
        qualification: 'warm',
        nextSteps: [],
        callbackAt: '2026-09-17T14:00:00.000Z',
        facts: [],
      },
    });
    const result = await analyzeCall(input, { apiKey: 'sk-test', model: 'claude-opus-5' });
    expect(result.callbackAt).toBe('2026-09-17T14:00:00.000Z');
  });

  it('complains rather than invent a result when the answer is unusable', async () => {
    parse.mockResolvedValue({ parsed_output: null });
    await expect(analyzeCall(input, { apiKey: 'sk-test', model: 'claude-opus-5' })).rejects.toThrow(/неразбираем/);
  });
});
