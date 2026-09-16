'use client';

import { CircleCheck, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/cn';

const inputClass = cn(
  'h-12 w-full rounded-xl border border-transparent bg-field px-4 text-base',
  'transition-colors placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none',
);

type Result = { id: string; agentCalls: boolean };

export function IntakeForm({ source }: { source?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      const response = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.get('name'),
          phone: form.get('phone'),
          email: form.get('email') || undefined,
          message: form.get('message') || undefined,
          consent: form.get('consent') === 'on',
          website: form.get('website') || undefined,
          source,
        }),
      });
      const data = (await response.json()) as Partial<Result> & { error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Изпращането не успя.');
      setResult({ id: data.id ?? '', agentCalls: Boolean(data.agentCalls) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Изпращането не успя. Опитайте отново.');
    } finally {
      setPending(false);
    }
  }

  if (result) {
    return (
      <div role="status" className="py-6 text-center">
        <CircleCheck className="mx-auto size-12 text-primary" aria-hidden />
        <h2 className="mt-4 text-xl font-bold">Благодарим ви!</h2>
        <p className="mt-2 text-base text-muted">
          {result.agentCalls
            ? 'Дръжте телефона наблизо: ще ви се обадим до няколко минути.'
            : 'Получихме запитването. Ще се свържем с вас съвсем скоро.'}
        </p>
        <button
          type="button"
          onClick={() => setResult(null)}
          className="mt-6 cursor-pointer text-sm font-semibold text-primary hover:underline"
        >
          Изпрати ново запитване
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <h2 className="text-lg font-bold">Вашите данни</h2>

      <div className="space-y-1.5">
        <label htmlFor="name" className="label-caps text-muted">
          Име
        </label>
        <input id="name" name="name" autoComplete="name" required minLength={2} className={inputClass} />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="phone" className="label-caps text-muted">
          Телефон
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          placeholder="0888 123 456"
          className={inputClass}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="email" className="label-caps text-muted">
          Имейл <span className="font-medium normal-case tracking-normal text-subtle">(по желание)</span>
        </label>
        <input id="email" name="email" type="email" autoComplete="email" className={inputClass} />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="message" className="label-caps text-muted">
          Какво ви интересува? <span className="font-medium normal-case tracking-normal text-subtle">(по желание)</span>
        </label>
        <textarea
          id="message"
          name="message"
          rows={3}
          maxLength={2000}
          className={cn(inputClass, 'h-auto resize-none py-3')}
        />
      </div>

      {/* Honeypot: hidden from people and screen readers, bots fill it in. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="website">Уебсайт</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-muted">
        <input name="consent" type="checkbox" required className="mt-1 size-5 shrink-0 cursor-pointer accent-primary" />
        <span>
          Съгласен/на съм да ми се обадят по повод запитването. Обаждането може да е от AI асистент и да бъде записано.
        </span>
      </label>

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
          'bg-brand text-base font-semibold text-white transition-opacity hover:opacity-90',
          'disabled:cursor-not-allowed disabled:opacity-60',
        )}
      >
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Обадете ми се
      </button>
    </form>
  );
}
