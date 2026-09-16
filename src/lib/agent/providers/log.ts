import type { CallEnded, CallProvider, CallTarget, PlacedCall } from '../types';

/**
 * Local development without a phone line or a Vapi account: pretends to dial,
 * then hands back a short conversation so the webhook path, the analysis and
 * the whole lead history can be exercised end to end.
 */
export function createLogProvider(): CallProvider {
  return {
    name: 'log',
    async placeCall(target: CallTarget): Promise<PlacedCall> {
      const callId = `log_${target.leadId}`;
      console.log(`[agent] test provider "calls" ${target.phone} for ${target.name}`);

      const wanted = target.interest || target.message || 'услугата, за която е попълнил формата';
      const simulated: CallEnded = {
        provider: 'log',
        callId,
        leadId: target.leadId,
        leadName: target.name,
        phone: target.phone,
        reached: true,
        endedReason: 'customer-ended-call',
        endedExplanation: 'Клиентът затвори',
        durationSec: 96,
        transcript: [
          { role: 'agent', text: `Добър ден, обаждам се от CreateX заради запитването ви. Аз съм асистент.`, at: 0 },
          { role: 'lead', text: 'Да, здравейте, попълних формата преди малко.', at: 6 },
          { role: 'agent', text: `Разбрах. Да уточня: интересува ви ${wanted}. Така ли е?`, at: 11 },
          { role: 'lead', text: 'Точно така. Имам бюджет около 5000 лева и бързам за следващия месец.', at: 18 },
          { role: 'agent', text: 'Кога ви е удобно колега да ви звънне с конкретна оферта?', at: 26 },
          { role: 'lead', text: 'В четвъртък след 17:00 е най-добре. И ми пратете нещо на имейл.', at: 33 },
          { role: 'agent', text: 'Записах. Ще получите оферта по имейл и ще ви потърсим в четвъртък след 17:00.', at: 41 },
          { role: 'lead', text: 'Супер, благодаря.', at: 48 },
        ],
        providerSummary: 'Клиентът потвърди интерес, има бюджет и иска оферта по имейл.',
        providerFacts: [],
      };
      return { provider: 'log', callId, simulated };
    },
  };
}
