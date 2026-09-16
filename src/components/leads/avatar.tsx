import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/cn';
import { initials } from '@/lib/format';

export function LeadAvatar({ name, fresh, className }: { name: string; fresh: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-11 shrink-0 items-center justify-center rounded-md text-base font-semibold text-white',
        fresh ? 'bg-spark' : 'bg-avatar',
        className,
      )}
    >
      {fresh ? <Sparkles className="size-5" /> : initials(name)}
    </span>
  );
}
