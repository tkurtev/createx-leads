'use client';

import { CircleUserRound, History, PhoneCall, Users, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export type AppView = 'leads' | 'followup' | 'activity' | 'profile';

type Item = { id: AppView; label: string; icon: LucideIcon; badge?: number; badgeTone?: 'spark' | 'action' };

type Props = {
  view: AppView;
  onChange: (view: AppView) => void;
  unseenCount: number;
  followUpCount: number;
  variant: 'bottom' | 'rail';
  className?: string;
};

export function AppNav({ view, onChange, unseenCount, followUpCount, variant, className }: Props) {
  const items: Item[] = [
    { id: 'leads', label: 'Лийдове', icon: Users, badge: unseenCount, badgeTone: 'spark' },
    { id: 'followup', label: 'За обаждане', icon: PhoneCall, badge: followUpCount, badgeTone: 'action' },
    { id: 'activity', label: 'Активност', icon: History },
    { id: 'profile', label: 'Профил', icon: CircleUserRound },
  ];

  return (
    <nav
      aria-label="Основно меню"
      className={cn(
        variant === 'bottom'
          ? 'fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur'
          : 'flex w-[96px] shrink-0 flex-col gap-1 border-r border-border bg-surface py-3',
        className,
      )}
    >
      {items.map(({ id, label, icon: Icon, badge, badgeTone }) => {
        const active = view === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative flex cursor-pointer flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors',
              variant === 'bottom' ? 'h-16' : 'mx-2 min-h-16 rounded-xl py-2 hover:bg-field',
              active ? 'text-primary' : 'text-muted hover:text-foreground',
              variant === 'rail' && active && 'bg-primary-soft hover:bg-primary-soft',
            )}
          >
            <span className="relative">
              <Icon className="size-6" strokeWidth={active ? 2.4 : 1.8} aria-hidden />
              {badge !== undefined && badge > 0 && (
                <span
                  className={cn(
                    'absolute -top-1.5 left-4 min-w-[18px] rounded-full px-1 text-center text-[10px] leading-[18px] text-white tabular-nums',
                    badgeTone === 'spark' ? 'bg-spark' : 'bg-action',
                  )}
                >
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </span>
            <span className={cn('max-w-full px-1 text-center leading-tight', variant === 'bottom' ? 'truncate' : 'line-clamp-2')}>
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
