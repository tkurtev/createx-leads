import type { Env } from '@/lib/env';
import { SYSTEM_AUTHOR } from '@/lib/leads/types';
import { notifyAgent } from '@/lib/notify/agent-webhook';
import { leadUrl, newLeadEmail } from '@/lib/notify/messages';
import { sendWithResend } from '@/lib/notify/resend';
import type { LeadStore } from '@/lib/store/types';
import type { IntakeLead } from './schema';

type DispatchEnv = Pick<
  Env,
  'RESEND_API_KEY' | 'NOTIFY_EMAIL_TO' | 'NOTIFY_EMAIL_FROM' | 'AGENT_WEBHOOK_URL' | 'AGENT_WEBHOOK_SECRET'
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

/**
 * After a form lead is saved: email the team and hand the lead to the AI agent,
 * in parallel. Whatever fails is written to the lead's history, so the team sees
 * it in the app instead of it vanishing into server logs.
 */
export async function dispatchNewLead({ env, store, lead, id, createdAt, appUrl, fetchImpl = fetch }: Dispatch) {
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

  if (env.AGENT_WEBHOOK_URL) {
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
  return { sent: jobs.length - problems.length, problems };
}
