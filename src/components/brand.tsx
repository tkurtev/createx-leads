import Image from 'next/image';
import { cn } from '@/lib/cn';

/** The CreateX wordmark, as used on createx.bg. */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/createx-logo.png"
      alt="CreateX"
      width={1059}
      height={501}
      priority
      className={cn('h-7 w-auto', className)}
    />
  );
}
