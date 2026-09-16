'use client';

import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  CornerDownRight,
  ExternalLink,
  History,
  Loader2,
  MessageCircle,
  Phone,
  Plus,
  Send,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { durationSince, fullDate, relativeTime } from '@/lib/format';
import { latestCall } from '@/lib/leads/calls';
import { formatPhone, viberLink, whatsappLink } from '@/lib/leads/normalize';
import { lastActivity, statusSince, type LeadWithActivity } from '@/lib/leads/status';
import { STATUSES, STATUS_LABELS, type Activity, type LeadStatus } from '@/lib/leads/types';
import { ActivityFeed } from './activity-feed';
import { activitySummary } from './activity-summary';
import { CallCard } from './call-card';
import { CallOutcome } from './call-outcome';
import { CommentComposer } from './comment-composer';
import { EmailComposer } from './email-composer';
import { postJson } from './post';
import { STATUS_STYLES } from './status-badge';

type Props = {
  lead: LeadWithActivity;
  userName: string;
  emailEnabled: boolean;
  voiceEnabled: boolean;
  agentName: string;
  sheetUrl: string | null;
  onBack: () => void;
  onActivity: (activity: Activity) => void;
};

type Tab = 'overview' | 'info' | 'history';

const pill = cn(
  'flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-semibold text-white',
  'shadow-sm transition-opacity duration-150 hover:opacity-90',
);

function Field({ label, children, aside }: { label: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="px-4 py-3.5 sm:px-5">
      <div className="flex items-baseline justify-between gap-3">
        <dt className="label-caps text-foreground">{label}</dt>
        {aside && <span className="text-xs text-subtle">{aside}</span>}
      </div>
      <dd className="mt-1 text-[15px]">{children}</dd>
    </div>
  );
}

export function LeadDetail({ lead, userName, emailEnabled, voiceEnabled, agentName, sheetUrl, onBack, onActivity }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [showOutcome, setShowOutcome] = useState(false);
  const [composing, setComposing] = useState(false);
  const [pending, setPending] = useState<'status' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  const latest = lastActivity(lead.activity);
  const aiCall = latestCall(lead.activity);
  const inStatusFor = durationSince(statusSince(lead, lead.activity));
  const historyCount = lead.activity.length + (lead.sheetNotes.length > 0 ? 1 : 0);

  async function save(body: { type: 'status'; status: LeadStatus }) {
    setPending('status');
    setError(null);
    try {
      const { activity } = await postJson<{ activity: Activity }>('/api/activity', {
        leadId: lead.id,
        leadName: lead.name,
        ...body,
      });
      onActivity(activity);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не се запази.');
    } finally {
      setPending(null);
    }
  }

  async function copyPhone() {
    if (!lead.phone) return;
    try {
      await navigator.clipboard.writeText(lead.phone);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: the number is visible on screen anyway.
    }
  }

  function openComposer() {
    setTab('history');
    window.setTimeout(() => commentRef.current?.focus(), 50);
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Преглед' },
    { id: 'info', label: 'Информация' },
    { id: 'history', label: historyCount > 0 ? `История (${historyCount})` : 'История' },
  ];

  return (
    <article className="relative mx-auto flex min-h-full max-w-2xl flex-col">
      <header className="px-4 pt-3 sm:px-6 sm:pt-6">
        <div className={cn('flex h-10 items-center justify-between', !sheetUrl && 'lg:hidden')}>
          <button
            type="button"
            onClick={onBack}
            aria-label="Всички лийдове"
            className="-ml-2 flex size-10 cursor-pointer items-center justify-center rounded-full hover:bg-surface lg:invisible"
          >
            <ArrowLeft className="size-5" aria-hidden />
          </button>
          {sheetUrl && (
            <a
              href={`${sheetUrl}#range=A${lead.row}`}
              target="_blank"
              rel="noreferrer"
              className="flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium hover:bg-surface"
            >
              В таблицата
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          )}
        </div>
        <p className="mt-1 flex items-center gap-1 text-[13px] font-medium text-muted">
          <CornerDownRight className="size-3.5" aria-hidden />
          Лийд от формата · {relativeTime(lead.createdAt)}
        </p>
        <h2 className="mt-1 text-[28px] leading-tight font-bold">{lead.name}</h2>

        <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6">
          {lead.email ? (
            <button type="button" onClick={() => setComposing(true)} className={cn(pill, 'bg-brand')}>
              <Send className="size-4" aria-hidden />
              Бърз отговор
            </button>
          ) : null}
          {lead.phone && (
            <>
              <a href={`tel:${lead.phone}`} onClick={() => setShowOutcome(true)} className={cn(pill, 'bg-action')}>
                <Phone className="size-4" aria-hidden />
                Обади се
              </a>
              <a href={viberLink(lead.phone)} className={cn(pill, 'bg-[#7360f2]')}>
                <MessageCircle className="size-4" aria-hidden />
                Viber
              </a>
              <a href={whatsappLink(lead.phone)} target="_blank" rel="noreferrer" className={cn(pill, 'bg-[#1f9d55]')}>
                <MessageCircle className="size-4" aria-hidden />
                WhatsApp
              </a>
            </>
          )}
          {!lead.phone && !lead.email && <p className="text-sm text-muted">Няма валиден телефон или имейл.</p>}
        </div>

        <nav className="mt-4 flex gap-6 border-b border-border" aria-label="Раздели">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={cn(
                '-mb-px cursor-pointer border-b-2 pb-2.5 text-sm font-semibold transition-colors',
                tab === t.id ? 'border-foreground text-foreground' : 'border-transparent text-muted hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="flex-1 space-y-3 px-4 py-4 pb-28 sm:px-6">
        {showOutcome && <CallOutcome lead={lead} onSaved={onActivity} onClose={() => setShowOutcome(false)} />}

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">
            {error}
          </p>
        )}

        {tab === 'overview' && (
          <>
            {aiCall && <CallCard activity={aiCall} agentName={agentName} />}

            <button
              type="button"
              onClick={() => setTab('history')}
              className="flex w-full cursor-pointer items-center gap-3 rounded-2xl bg-surface px-4 py-3.5 text-left shadow-[0_1px_3px_rgba(27,29,42,0.06)] hover:shadow-md sm:px-5"
            >
              <History className="size-5 shrink-0 text-foreground" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="label-caps block">
                  {latest ? `Последна активност ${relativeTime(latest.at)}` : `Добавен ${relativeTime(lead.createdAt)}`}
                </span>
                <span className="mt-0.5 block truncate text-sm">
                  {latest ? activitySummary(latest) : 'Още никой не се е свързал с този лийд'}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
            </button>

            <dl className="divide-y divide-border rounded-2xl bg-surface shadow-[0_1px_3px_rgba(27,29,42,0.06)]">
              <Field label="Статус" aside={inStatusFor ? `В този статус: ${inStatusFor}` : undefined}>
                <div className="relative flex items-center gap-2">
                  <span className={cn('size-4 shrink-0 rounded-[3px]', STATUS_STYLES[lead.status].square)} aria-hidden />
                  <label htmlFor="status" className="sr-only">
                    Статус
                  </label>
                  <select
                    id="status"
                    value={lead.status}
                    disabled={pending === 'status'}
                    onChange={(e) => void save({ type: 'status', status: e.target.value as LeadStatus })}
                    className="h-9 flex-1 cursor-pointer appearance-none bg-transparent pr-8 text-[15px] font-medium focus:outline-none"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                  {pending === 'status' ? (
                    <Loader2 className="pointer-events-none absolute right-1 size-4 animate-spin text-muted" aria-hidden />
                  ) : (
                    <ChevronDown className="pointer-events-none absolute right-1 size-4 text-muted" aria-hidden />
                  )}
                </div>
              </Field>
              {lead.answers.map((a, i) => (
                <Field key={i} label={a.question}>
                  {a.answer}
                </Field>
              ))}
              {lead.sheetNotes.length > 0 && (
                <Field label="Бележки от таблицата">
                  <ul className="space-y-1 text-muted">
                    {lead.sheetNotes.map((note, i) => (
                      <li key={i} className="leading-relaxed whitespace-pre-wrap">
                        {note}
                      </li>
                    ))}
                  </ul>
                </Field>
              )}
            </dl>
          </>
        )}

        {tab === 'info' && (
          <dl className="divide-y divide-border rounded-2xl bg-surface shadow-[0_1px_3px_rgba(27,29,42,0.06)]">
            <Field label="Име">{lead.name}</Field>
            <Field label="Мобилен номер">
              <span className="flex items-center gap-2">
                {lead.phone ? formatPhone(lead.phone) : <span className="text-subtle">{lead.rawPhone || 'липсва'}</span>}
                {lead.phone && (
                  <button
                    type="button"
                    onClick={copyPhone}
                    aria-label="Копирай телефона"
                    className="flex size-8 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-field"
                  >
                    {copied ? <Check className="size-4 text-emerald-600" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                  </button>
                )}
              </span>
            </Field>
            <Field label="Имейл">
              <span className="break-all">{lead.email ?? <span className="text-subtle">липсва</span>}</span>
            </Field>
            <Field label="Добавен">{fullDate(lead.createdAt)}</Field>
            <Field label="Ред в таблицата">{lead.row}</Field>
          </dl>
        )}

        {tab === 'history' && (
          <div className="rounded-2xl bg-surface p-4 shadow-[0_1px_3px_rgba(27,29,42,0.06)] sm:p-5">
            <ActivityFeed activity={lead.activity} sheetNotes={lead.sheetNotes} agentName={agentName} />
          </div>
        )}
      </div>

      {tab === 'history' ? (
        <CommentComposer ref={commentRef} lead={lead} voiceEnabled={voiceEnabled} onSaved={onActivity} />
      ) : (
        <button
          type="button"
          onClick={openComposer}
          aria-label="Добави коментар или гласова бележка"
          className={cn(
            'fixed right-5 bottom-6 z-20 flex size-14 cursor-pointer items-center justify-center rounded-full',
            'bg-action text-white shadow-[0_8px_20px_rgba(43,88,248,0.35)] transition-colors hover:bg-action-hover',
          )}
        >
          <Plus className="size-6" aria-hidden />
        </button>
      )}

      {composing && lead.email && (
        <EmailComposer
          lead={{ ...lead, email: lead.email }}
          userName={userName}
          emailEnabled={emailEnabled}
          onSent={onActivity}
          onClose={() => setComposing(false)}
        />
      )}
    </article>
  );
}
