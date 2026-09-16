'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/cn';

const inputClass = cn(
  'h-12 w-full rounded-xl border border-transparent bg-field px-4 text-base',
  'transition-colors placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none',
);

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.get('name'), password: form.get('password') }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Входът не успя.');
      router.replace('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Входът не успя.');
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="name" className="label-caps text-muted">
          Вашето име
        </label>
        <input id="name" name="name" autoComplete="name" required className={inputClass} placeholder="напр. Иван" />
        <p className="text-xs text-muted">Показва се до коментарите ви.</p>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="password" className="label-caps text-muted">
          Парола на екипа
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className={cn(
          'flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full',
          'bg-brand text-sm font-semibold text-white transition-opacity hover:opacity-90',
          'disabled:cursor-not-allowed disabled:opacity-60',
        )}
      >
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Влез
      </button>
    </form>
  );
}
