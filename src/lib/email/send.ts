import nodemailer from 'nodemailer';
import type { Env } from '@/lib/env';
import type { EmailRequest } from './validation';

export type SendResult = { delivered: boolean; transport: Env['EMAIL_TRANSPORT'] };

export async function sendLeadEmail(env: Env, email: EmailRequest): Promise<SendResult> {
  if (env.EMAIL_TRANSPORT === 'off') {
    throw new Error('Изпращането на имейли от приложението не е включено. Използвайте „Отвори в пощата“.');
  }

  // "log" builds the message but never hands it to a mail server. For local testing.
  const transport =
    env.EMAIL_TRANSPORT === 'log'
      ? nodemailer.createTransport({ jsonTransport: true })
      : nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_PORT === 465,
          auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
        });

  await transport.sendMail({
    from: env.EMAIL_FROM ?? 'dev@localhost',
    to: email.to,
    subject: email.subject,
    text: email.body,
  });

  return { delivered: env.EMAIL_TRANSPORT === 'smtp', transport: env.EMAIL_TRANSPORT };
}
