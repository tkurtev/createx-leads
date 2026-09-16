import { cn } from '@/lib/cn';
import { STATUS_LABELS, type LeadStatus } from '@/lib/leads/types';

/** Rectangular tags with solid fills; "not contacted" stays a soft pink like an unread marker. */
export const STATUS_STYLES: Record<LeadStatus, { tag: string; square: string }> = {
  new: { tag: 'bg-spark-soft text-spark', square: 'bg-spark' },
  in_progress: { tag: 'bg-brand-blue text-white', square: 'bg-brand-blue' },
  no_answer: { tag: 'bg-orange-500 text-white', square: 'bg-orange-500' },
  call_back: { tag: 'bg-brand-purple text-white', square: 'bg-brand-purple' },
  interested: { tag: 'bg-teal-600 text-white', square: 'bg-teal-600' },
  booked: { tag: 'bg-emerald-700 text-white', square: 'bg-emerald-700' },
  lost: { tag: 'bg-brand-navy/60 text-white', square: 'bg-brand-navy/60' },
};

export function StatusTag({ status, className }: { status: LeadStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-[3px] px-1.5 py-0.5 text-[11px] font-medium leading-tight',
        STATUS_STYLES[status].tag,
        className,
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
