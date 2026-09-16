'use client';

import { ChevronDown, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { filterLeads, type LeadFilter } from '@/lib/leads/filter';
import type { LeadWithActivity } from '@/lib/leads/status';
import { STATUSES, STATUS_LABELS, type LeadStatus } from '@/lib/leads/types';
import { LeadList } from '../../leads/lead-list';

export type LeadsTab = 'all' | 'unseen' | 'new';

type Props = {
  leads: LeadWithActivity[];
  unseen: ReadonlySet<string>;
  selectedId: string | null;
  tab: LeadsTab;
  onTabChange: (tab: LeadsTab) => void;
  onSelect: (id: string) => void;
  onMarkAllSeen: () => void;
};

export function LeadsView({ leads, unseen, selectedId, tab, onTabChange, onSelect, onMarkAllSeen }: Props) {
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'any'>('any');
  const [query, setQuery] = useState('');

  const filter: LeadFilter =
    tab === 'unseen' ? 'unseen' : tab === 'new' ? 'new' : statusFilter === 'any' ? 'all' : statusFilter;
  const visible = useMemo(() => filterLeads(leads, filter, query, unseen), [leads, filter, query, unseen]);

  const tabs = [
    { id: 'all' as const, label: 'Всички', count: leads.length },
    { id: 'unseen' as const, label: 'Нови', count: unseen.size },
    { id: 'new' as const, label: 'Не са търсени', count: leads.filter((l) => l.status === 'new').length },
  ];

  return (
    <>
      <div className="border-b border-border">
        <div className="px-3 pt-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-subtle" aria-hidden />
            <label htmlFor="search" className="sr-only">
              Търси
            </label>
            <input
              id="search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Търси по име, телефон, имейл..."
              className={cn(
                'h-11 w-full rounded-xl border border-transparent bg-field pr-3 pl-10 text-base',
                'placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none sm:text-sm',
              )}
            />
          </div>
        </div>
        <nav className="mt-3 flex gap-5 overflow-x-auto border-b border-border px-4 [scrollbar-width:none]" aria-label="Списъци">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-current={tab === t.id ? 'page' : undefined}
              onClick={() => onTabChange(t.id)}
              className={cn(
                '-mb-px flex shrink-0 cursor-pointer items-center gap-1.5 border-b-2 pb-2.5 text-sm font-semibold whitespace-nowrap transition-colors',
                tab === t.id ? 'border-foreground text-foreground' : 'border-transparent text-muted hover:text-foreground',
              )}
            >
              {t.label}
              {t.count > 0 && (
                <span
                  className={cn(
                    'rounded-full px-1.5 text-[11px] tabular-nums',
                    t.id === 'unseen' ? 'bg-spark text-white' : 'bg-field text-muted',
                  )}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2 bg-background/60 px-4 py-2 text-[13px] text-muted">
          {tab === 'all' ? (
            <div className="relative flex min-w-0 flex-1 items-center">
              <label htmlFor="status-filter" className="sr-only">
                Филтър по статус
              </label>
              <select
                id="status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as LeadStatus | 'any')}
                className="h-8 w-full cursor-pointer appearance-none bg-transparent pr-6 font-medium focus:outline-none"
              >
                <option value="any">Най-новите първо · всички статуси</option>
                {STATUSES.map((st) => (
                  <option key={st} value={st}>
                    Най-новите първо · {STATUS_LABELS[st]}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-0 size-4" aria-hidden />
            </div>
          ) : (
            <span className="flex-1 py-1.5 font-medium">Най-новите първо</span>
          )}
          {tab === 'unseen' && unseen.size > 0 && (
            <button type="button" onClick={onMarkAllSeen} className="cursor-pointer text-xs font-semibold text-primary hover:underline">
              Маркирай като видени
            </button>
          )}
        </div>
      </div>
      <LeadList leads={visible} selectedId={selectedId} unseen={unseen} onSelect={onSelect} />
    </>
  );
}
