import type { IntakeLead } from '@/lib/intake/schema';

export type LeadCreatedEvent = {
  event: 'lead.created';
  lead: IntakeLead & { id: string; createdAt: string };
  /** Where the agent posts the call result back. See README, "AI агент". */
  callbackUrl: string;
};

/** Hands a fresh lead to the AI calling agent. Resolves once the agent accepted it. */
export async function notifyAgent(
  config: { url: string; secret?: string },
  event: LeadCreatedEvent,
  fetchImpl: typeof fetch = fetch,
) {
  const response = await fetchImpl(config.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.secret ? { Authorization: `Bearer ${config.secret}` } : {}),
    },
    body: JSON.stringify(event),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`AI агентът върна ${response.status}${body ? `: ${body.slice(0, 200)}` : ''}`);
  }
}
