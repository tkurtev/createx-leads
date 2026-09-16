import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import type { CallFact, CallQualification, CallTurn, LeadStatus } from '@/lib/leads/types';

/** Statuses a finished conversation can land on. "new" is not one: somebody has spoken by now. */
const OUTCOMES = ['in_progress', 'no_answer', 'call_back', 'interested', 'booked', 'lost'] as const;

export const analysisSchema = z.object({
  summary: z
    .string()
    .describe('Едно до три изречения на български: какво иска човекът и какво беше договорено.'),
  outcome: z.enum(OUTCOMES).describe('Как приключи разговорът.'),
  qualification: z
    .enum(['hot', 'warm', 'cold', 'unqualified', 'unknown'])
    .describe('Колко близо е човекът до сделка.'),
  nextSteps: z
    .array(z.string())
    .describe('Конкретни действия за екипа, всяко до десет думи, в повелително наклонение. Празен масив, ако няма.'),
  callbackAt: z
    .string()
    .nullable()
    .describe('ISO 8601 момент, ако човекът е поискал да го потърсят в конкретно време. Иначе null.'),
  facts: z
    .array(z.object({ label: z.string(), value: z.string() }))
    .describe('Каквото човекът каза за нуждата си, като етикет и стойност. Празен масив, ако не каза нищо конкретно.'),
});

export type CallAnalysis = {
  summary: string;
  outcome: LeadStatus;
  qualification: CallQualification;
  nextSteps: string[];
  callbackAt?: string;
  facts: CallFact[];
};

export type AnalyzeInput = {
  transcript: CallTurn[];
  /** What the lead typed into the form, so the agent's questions have context. */
  lead: { name: string; interest?: string; message?: string; source?: string };
  /** Whatever the calling platform concluded on its own, when it was configured to. */
  providerSummary?: string;
  /** When the call happened, so "в четвъртък след 17:00" becomes a real date. */
  now: Date;
};

const SYSTEM = `Ти четеш запис на телефонен разговор между AI асистент и човек, който току-що е попълнил форма за запитване.

Не знаеш с какво се занимава фирмата и не предполагай. Разбери го от самия разговор. Едно и също приложение обслужва зъболекари, брокери, застрахователи, автосервизи и софтуерни фирми, затова не използвай речник, специфичен за бранш, освен ако човекът сам го е използвал.

Пиши на български, кратко и делово, както би го написал колега в CRM. Без учтиви уводи, без "клиентът каза, че", без маркетингов език.

Как да избереш outcome:
- booked: уговорена е конкретна среща, час, оглед или демонстрация с време.
- interested: иска да продължи, но нищо конкретно не е насрочено.
- call_back: помоли да го потърсят пак или моментът не беше удобен.
- lost: отказа, не го интересува или не е подходящ.
- in_progress: говорили са, но нищо не се разбира от разговора.
- no_answer: разговор всъщност не се е състоял.

Как да избереш qualification:
- hot: има нужда сега, има бюджет или решава сам, иска следваща стъпка.
- warm: интересува се, но по-късно, или нещо още не е ясно.
- cold: слаб интерес, отговаря от учтивост.
- unqualified: това, което търси, не съвпада с предложеното, или не отговаря на условията.
- unknown: разговорът беше твърде кратък, за да се прецени.

В nextSteps пиши само това, което човек от екипа трябва да направи, всяко на отделен ред. Ако агентът вече е свършил всичко и няма какво да се прави, върни празен масив.

В facts слагай само неща, които човекът наистина е казал: бюджет, срок, град, брой, кога му е удобно, кой решава, какво точно търси. Етикетът е на български, с главна буква, до три думи. Не измисляй и не повтаряй обобщението.`;

export function renderTranscript(turns: CallTurn[]): string {
  return turns.map((turn) => `${turn.role === 'agent' ? 'Агент' : 'Клиент'}: ${turn.text}`).join('\n');
}

export function buildPrompt({ transcript, lead, providerSummary, now }: AnalyzeInput): string {
  const form = [
    `Име: ${lead.name}`,
    lead.interest ? `Интерес, посочен във формата: ${lead.interest}` : '',
    lead.message ? `Съобщение във формата: ${lead.message}` : '',
    lead.source ? `Източник: ${lead.source}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return [
    `Разговорът се проведе на ${now.toISOString()} (часова зона Europe/Sofia). Използвай това, за да превърнеш "в четвъртък след 17:00" в конкретна дата.`,
    '',
    'Какво е попълнил човекът във формата:',
    form,
    '',
    providerSummary ? `Обобщение от телефонната платформа (може да е неточно): ${providerSummary}\n` : '',
    'Запис на разговора:',
    renderTranscript(transcript),
  ]
    .filter((part) => part !== '')
    .join('\n');
}

/**
 * Reads the conversation and turns it into the few things a salesperson needs:
 * what happened, how warm the lead is, and what to do next. Extraction against a
 * fixed schema, so low effort is the right setting and keeps a call cheap.
 *
 * The timeout is deliberately short: this runs while the calling platform waits
 * for its webhook to be acknowledged, and a missing analysis must never cost us
 * the recording and the transcript.
 */
export async function analyzeCall(
  input: AnalyzeInput,
  config: { apiKey: string; model: string; timeoutMs?: number },
): Promise<CallAnalysis> {
  const client = new Anthropic({
    apiKey: config.apiKey,
    timeout: config.timeoutMs ?? 12_000,
    maxRetries: 0,
  });

  const response = await client.messages.parse({
    model: config.model,
    max_tokens: 8000,
    system: SYSTEM,
    messages: [{ role: 'user', content: buildPrompt(input) }],
    output_config: { effort: 'low', format: zodOutputFormat(analysisSchema) },
  });

  const parsed = response.parsed_output;
  if (!parsed) throw new Error('Анализът на разговора върна неразбираем отговор.');

  return {
    summary: parsed.summary.trim(),
    outcome: parsed.outcome,
    qualification: parsed.qualification,
    nextSteps: parsed.nextSteps.map((step) => step.trim()).filter(Boolean),
    ...(parsed.callbackAt ? { callbackAt: parsed.callbackAt } : {}),
    facts: parsed.facts
      .map((fact) => ({ label: fact.label.trim(), value: fact.value.trim() }))
      .filter((fact) => fact.label !== '' && fact.value !== ''),
  };
}
