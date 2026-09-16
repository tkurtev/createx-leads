import { z } from 'zod';
import { normalizeEmail, normalizePhone } from '@/lib/leads/normalize';

/** What the public lead form sends. Phone is required: the whole point is calling back fast. */
export const intakeSchema = z.object({
  name: z.string().trim().min(2, 'Напишете името си').max(80),
  phone: z
    .string()
    .trim()
    .transform((value, ctx) => {
      const phone = normalizePhone(value);
      if (!phone) ctx.addIssue({ code: 'custom', message: 'Проверете телефона, напр. 0888 123 456' });
      return phone ?? '';
    }),
  email: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value, ctx) => {
      if (!value) return null;
      const email = normalizeEmail(value);
      if (!email) ctx.addIssue({ code: 'custom', message: 'Проверете имейла' });
      return email;
    }),
  interest: z.string().trim().max(120).optional().default(''),
  message: z.string().trim().max(2000).optional().default(''),
  source: z
    .string()
    .trim()
    .max(60)
    .optional()
    .transform((value) => value?.replace(/[^\p{L}\p{N} _.-]/gu, '') || 'форма'),
  consent: z.literal(true, { error: 'Нужно е съгласие, за да ви се обадим' }),
  /** Honeypot: real people never see this field, bots fill it in. */
  website: z.string().max(0).optional(),
});

export type IntakeInput = z.input<typeof intakeSchema>;
export type IntakeLead = z.output<typeof intakeSchema>;
