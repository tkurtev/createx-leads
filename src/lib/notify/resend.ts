export type ResendConfig = { apiKey: string; from: string };
export type OutgoingEmail = { to: string[]; subject: string; text: string; html: string };

/** Sends through the Resend HTTP API. Throws with Resend's own explanation when it refuses. */
export async function sendWithResend(config: ResendConfig, email: OutgoingEmail, fetchImpl: typeof fetch = fetch) {
  const response = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: config.from, ...email }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!response.ok) {
    throw new Error(`Resend отказа имейла (${response.status}): ${body.message ?? 'без обяснение'}`);
  }
  return body.id ?? null;
}
