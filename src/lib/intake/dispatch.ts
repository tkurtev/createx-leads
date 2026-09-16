import { startAgentCall } from '@/lib/agent/dial';
import { callMode, getCallProvider } from '@/lib/agent/provider';
import type { CallEnded } from '@/lib/agent/types';
import type { Env } from '@/lib/env';
import { SYSTEM_AUTHOR } from '@/lib/leads/types';
import { notifyAgent } from '@/lib/notify/agent-webhook';
import { leadUrl, newLeadEmail } from '@/lib/notify/messages';
import { sendWithResend } from '@/lib/notify/resend';
import type { LeadStore } from '@/lib/store/types';
import type { IntakeLead } from './schema';

type DispatchEnv = Pick<
  Env,
  | 'RESEND_API_KEY'
  | 'NOTIFY_EMAIL_TO'
  | 'NOTIFY_EMAIL_FROM'
  | 'AGENT_WEBHOOK_URL'
  | 'AGENT_WEBHOOK_SECRET'
  | 'AGENT_NAME'
  | 'CALL_PROVIDER'
  | 'VAPI_API_KEY'
  | 'VAPI_ASSISTANT_ID'
  | 'VAPI_PHONE_NUMBER_ID'
>;

type Dispatch = {
  env: DispatchEnv;
  store: LeadStore;
  lead: IntakeLead;
  id: string;
  createdAt: string;
  appUrl: string;
  fetchImpl?: typeof fetch;
};

export type DispatchResult = { sent: number; problems: string[]; simulated?: CallEnded };

/**
 * After a form lead is saved: email the team and get someone calling, in
 * parallel. Whatever fails is written to the lead's history, so the team sees
 * it in the app instead of it vanishing into server logs.
 */
export async function dispatchNewLead({
  env,
  store,
  lead,
  id,
  createdAt,
  appUrl,
  fetchImpl = fetch,
}: Dispatch): Promise<DispatchResult> {
  const url = leadUrl(appUrl, id);
  const jobs: { label: string; run: () => Promise<unknown> }[] = [];

  if (env.RESEND_API_KEY && env.NOTIFY_EMAIL_TO.length > 0) {
    jobs.push({
      label: 'Имейлът за нов лийд не беше изпратен',
      run: () =>
        sendWithResend(
          { apiKey: env.RESEND_API_KEY!, from: env.NOTIFY_EMAIL_FROM },
          { to: env.NOTIFY_EMAIL_TO, ...newLeadEmail(lead, url) },
          fetchImpl,
        ),
    });
  }

  const provider = getCallProvider(env, fetchImpl);
  let simulated: CallEnded | undefined;

  if (provider) {
    jobs.push({
      label: 'AI агентът не успя да звънне',
      run: async () => {
        const result = await startAgentCall({
          store,
          provider,
          agentName: env.AGENT_NAME,
          target: {
            leadId: id,
            name: lead.name,
            phone: lead.phone,
            email: lead.email,
            interest: lead.interest,
            message: lead.message,
            source: lead.source,
          },
        });
        simulated = result.simulated;
      },
    });
  } else if (callMode(env) === 'webhook' && env.AGENT_WEBHOOK_URL) {
    jobs.push({
      label: 'AI агентът не получи лийда и няма да звънне',
      run: () =>
        notifyAgent(
          { url: env.AGENT_WEBHOOK_URL!, secret: env.AGENT_WEBHOOK_SECRET },
          {
            event: 'lead.created',
            lead: { ...lead, id, createdAt },
            callbackUrl: `${appUrl.replace(/\/$/, '')}/api/agent/calls`,
          },
          fetchImpl,
        ),
    });
  }

  const results = await Promise.allSettled(jobs.map((job) => job.run()));
  const problems = results.flatMap((result, i) =>
    result.status === 'rejected'
      ? [`${jobs[i].label}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`]
      : [],
  );

  for (const text of problems) {
    console.error('[intake]', text);
    await store
      .appendActivity({ leadId: id, leadName: lead.name, author: SYSTEM_AUTHOR, type: 'comment', text })
      .catch((error) => console.error('[intake] could not record the problem', error));
  }
  return { sent: jobs.length - problems.length, problems, ...(simulated ? { simulated } : {}) };
}
