'use client';

import { ExternalLink, Loader2, Send, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import type { LeadWithActivity } from '@/lib/leads/status';
import { emailTemplates } from '@/lib/leads/templates';
import type { Activity } from '@/lib/leads/types';
import { postJson } from './post';

type Props = {
  lead: LeadWithActivity & { email: string };
  userName: string;
  emailEnabled: boolean;
  onSent: (activity: Activity) => void;
  onClose: () => void;
};

const fieldClass = cn(
  'w-full rounded-xl border border-transparent bg-field px-4 text-base',
  'placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none sm:text-sm',
);

export function EmailComposer({ lead, userName, emailEnabled, onSent, onClose }: Props) {
  const templates = emailTemplates({ leadName: lead.name, userName });
  const [templateId, setTemplateId] = useState(templates[0].id);
  const [subject, setSubject] = useState(templates[0].subject);
  const [body, setBody] = useState(templates[0].body);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) {
      el.focus();
      el.setSelectionRange(0, 0);
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !pending && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, pending]);

  function applyTemplate(id: string) {
    const template = templates.find((t) => t.id === id);
    if (!template) return;
    setTemplateId(id);
    setSubject(template.subject);
    setBody(template.body);
  }

  const mailto = `mailto:${lead.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  async function send() {
    setPending(true);
    setError(null);
    try {
      const result = await postJson<{ activity: Activity; delivered: boolean }>('/api/email', {
        leadId: lead.id,
        leadName: lead.name,
        to: lead.email,
        subject,
        body,
      });
      onSent(result.activity);
      if (result.delivered) {
        onClose();
      } else {
        setNotice('Тестов режим: имейлът е записан в историята, но не е изпратен.');
        setPending(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Имейлът не се изпрати.');
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#1b1d2a]/40 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="composer-title"
        className="flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-3xl bg-surface shadow-xl sm:rounded-3xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <h2 id="composer-title" className="text-base font-semibold">
            Бърз отговор до {lead.name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Затвори"
            className="flex size-9 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-field"
          >
            <X className="size-4" aria-hidden />
          </button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="label-caps w-10 text-muted">До</span>
            <span className="min-w-0 truncate">{lead.email}</span>
          </div>
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]" role="group" aria-label="Готови отговори">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={templateId === t.id}
                onClick={() => applyTemplate(t.id)}
                className={cn(
                  'h-8 shrink-0 cursor-pointer rounded-full border px-3 text-xs font-semibold whitespace-nowrap transition-colors',
                  templateId === t.id
                    ? 'border-primary bg-primary-soft text-primary'
                    : 'border-border text-muted hover:border-primary/40 hover:text-foreground',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div>
            <label htmlFor="subject" className="sr-only">
              Тема
            </label>
            <input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Тема"
              className={cn(fieldClass, 'h-11 font-medium')}
            />
          </div>
          <div>
            <label htmlFor="body" className="sr-only">
              Текст
            </label>
            <textarea
              id="body"
              ref={bodyRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className={cn(fieldClass, 'resize-y py-2 leading-relaxed')}
            />
          </div>
          {!emailEnabled && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Изпращането директно от приложението още не е свързано с пощенска кутия. Бутонът „Отвори в пощата“ ще
              подготви имейла в програмата ви за поща.
            </p>
          )}
          {notice && <p className="rounded-lg bg-primary-soft px-3 py-2 text-sm text-primary">{notice}</p>}
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">
          <a
            href={mailto}
            className={cn(
              'flex h-11 cursor-pointer items-center gap-2 rounded-full border border-border px-4 text-sm font-semibold',
              'transition-colors hover:bg-field',
            )}
          >
            <ExternalLink className="size-4" aria-hidden />
            Отвори в пощата
          </a>
          {emailEnabled && (
            <button
              type="button"
              onClick={send}
              disabled={pending || !subject.trim() || !body.trim()}
              className={cn(
                'bg-brand flex h-11 cursor-pointer items-center gap-2 rounded-full px-5 text-sm font-semibold text-white',
                'transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
              Изпрати
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
