import { z } from 'zod';

const schema = z
  .object({
    // sheets = live Google Sheet; file = local demo; demo = hosted demo (fixture leads, Vercel Blob for activity)
    DATA_SOURCE: z.enum(['sheets', 'file', 'demo']).default('sheets'),
    SPREADSHEET_ID: z.string().optional(),
    LEADS_TAB: z.string().default('PowerLead'),
    ACTIVITY_TAB: z.string().default('Коментари'),
    GOOGLE_CLIENT_EMAIL: z.string().optional(),
    GOOGLE_PRIVATE_KEY: z.string().optional(),
    LOCAL_LEADS_FILE: z.string().default('fixtures/demo-leads.json'),
    LOCAL_ACTIVITY_FILE: z.string().default('.data/activity.json'),
    LOCAL_AUDIO_DIR: z.string().default('.data/audio'),
    // Google Drive folder (inside a Shared drive) for voice notes. Empty = voice notes off.
    VOICE_NOTES_FOLDER_ID: z.string().optional(),

    APP_PASSWORD: z.string().min(4, 'APP_PASSWORD трябва да е поне 4 символа'),
    SESSION_SECRET: z.string().min(32, 'SESSION_SECRET трябва да е поне 32 символа'),

    EMAIL_TRANSPORT: z.enum(['smtp', 'log', 'off']).default('off'),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().default(465),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    EMAIL_FROM: z.string().optional(),

    // Public URL of the app, used in notification links. Falls back to the request origin.
    APP_URL: z.string().url().optional(),

    // "New lead" emails to the team through Resend. Empty key = no emails.
    RESEND_API_KEY: z.string().optional(),
    NOTIFY_EMAIL_TO: z
      .string()
      .optional()
      .transform((v) => (v ?? '').split(',').map((s) => s.trim()).filter(Boolean)),
    // resend.dev works without a verified domain, but only delivers to the Resend account owner.
    NOTIFY_EMAIL_FROM: z.string().default('CreateX Leads <onboarding@resend.dev>'),

    // Who calls a fresh form lead:
    //   vapi    - this app places the call through Vapi
    //   webhook - the lead is POSTed to AGENT_WEBHOOK_URL and that agent calls
    //   log     - local testing: a fake call with a fake conversation
    //   off     - nobody calls automatically
    // Left empty it keeps whatever was configured before: webhook if there is one.
    CALL_PROVIDER: z.enum(['off', 'vapi', 'webhook', 'log']).optional(),
    VAPI_API_KEY: z.string().optional(),
    // The assistant configured in the Vapi dashboard: it owns the script and the voice.
    VAPI_ASSISTANT_ID: z.string().optional(),
    // The number Vapi calls from.
    VAPI_PHONE_NUMBER_ID: z.string().optional(),
    // Vapi sends this back as the "x-vapi-secret" header on every webhook.
    VAPI_WEBHOOK_SECRET: z.string().optional(),

    // Reading the call afterwards (summary, qualification, next steps). Empty = the
    // provider's own summary is used instead.
    ANTHROPIC_API_KEY: z.string().optional(),
    ANALYSIS_MODEL: z.string().default('claude-opus-5'),

    // AI calling agent: every form lead is POSTed here. Empty = no automatic calls.
    AGENT_WEBHOOK_URL: z.string().url().optional(),
    AGENT_WEBHOOK_SECRET: z.string().optional(),
    // The agent sends this as a Bearer token when it posts the call result back.
    AGENT_API_KEY: z.string().min(24, 'AGENT_API_KEY трябва да е поне 24 символа').optional(),
    AGENT_NAME: z.string().default('AI агент'),
  })
  .superRefine((env, ctx) => {
    if (env.DATA_SOURCE === 'sheets') {
      for (const key of ['SPREADSHEET_ID', 'GOOGLE_CLIENT_EMAIL', 'GOOGLE_PRIVATE_KEY'] as const) {
        if (!env[key]) ctx.addIssue({ code: 'custom', path: [key], message: `${key} липсва` });
      }
    }
    if (env.DATA_SOURCE === 'demo' && !process.env.BLOB_READ_WRITE_TOKEN) {
      ctx.addIssue({ code: 'custom', path: ['BLOB_READ_WRITE_TOKEN'], message: 'свържете Vercel Blob store към проекта' });
    }
    if (env.RESEND_API_KEY && env.NOTIFY_EMAIL_TO.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['NOTIFY_EMAIL_TO'], message: 'на кого да пращаме известията за нови лийдове' });
    }
    if (env.CALL_PROVIDER === 'vapi') {
      for (const key of ['VAPI_API_KEY', 'VAPI_ASSISTANT_ID', 'VAPI_PHONE_NUMBER_ID'] as const) {
        if (!env[key]) ctx.addIssue({ code: 'custom', path: [key], message: `${key} липсва` });
      }
    }
    if (env.CALL_PROVIDER === 'webhook' && !env.AGENT_WEBHOOK_URL) {
      ctx.addIssue({ code: 'custom', path: ['AGENT_WEBHOOK_URL'], message: 'къде да изпратим лийда за обаждане' });
    }
    if (env.EMAIL_TRANSPORT === 'smtp') {
      for (const key of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM'] as const) {
        if (!env[key]) ctx.addIssue({ code: 'custom', path: [key], message: `${key} липсва` });
      }
    }
  });

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`Настройките не са пълни: ${problems.join('; ')}`);
  }
  cached = parsed.data;
  return cached;
}
