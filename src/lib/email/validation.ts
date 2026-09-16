import { z } from 'zod';

export const emailRequestSchema = z.object({
  leadId: z.string().min(1),
  leadName: z.string().optional(),
  to: z.email('Невалиден имейл адрес'),
  subject: z.string().trim().min(1, 'Добавете тема').max(200),
  body: z.string().trim().min(1, 'Имейлът е празен').max(10_000),
});

export type EmailRequest = z.infer<typeof emailRequestSchema>;
