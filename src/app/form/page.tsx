import type { Metadata } from 'next';
import { PhoneCall, ShieldCheck, Timer } from 'lucide-react';
import { BrandLogo } from '@/components/brand';
import { IntakeForm } from '@/components/intake/intake-form';

export const metadata: Metadata = {
  title: 'Оставете телефон · CreateX',
  description: 'Оставете телефон и ще ви се обадим до минути.',
};

type Props = { searchParams: Promise<{ source?: string }> };

/** Public demo landing page: a lead fills this in, lands in the app, and the AI agent calls them. */
export default async function FormPage({ searchParams }: Props) {
  const { source } = await searchParams;

  const points = [
    { icon: Timer, text: 'Обаждаме се до няколко минути' },
    { icon: PhoneCall, text: 'Кратък разговор, без ангажимент' },
    { icon: ShieldCheck, text: 'Данните ви не се споделят' },
  ];

  return (
    <main className="bg-brand-hero min-h-full px-4 py-8 sm:py-14">
      <div className="mx-auto grid w-full max-w-5xl items-center gap-8 lg:grid-cols-[1fr_440px] lg:gap-14">
        <section className="text-white">
          <div className="inline-flex rounded-2xl bg-white px-4 py-2.5">
            <BrandLogo className="h-8" />
          </div>
          <h1 className="mt-8 text-3xl leading-tight font-bold text-balance sm:text-4xl">
            Оставете телефон и ще ви се обадим до минути
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-white/90">
            Попълнете формата. Наш асистент ще ви звънне веднага, ще зададе няколко въпроса и ще уговори следващата
            стъпка.
          </p>
          <ul className="mt-6 hidden space-y-3 sm:block">
            {points.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm font-medium">
                <span className="flex size-9 items-center justify-center rounded-full bg-white/15">
                  <Icon className="size-4" aria-hidden />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </section>

        <div className="rounded-3xl bg-surface p-6 text-foreground shadow-[0_24px_60px_rgba(11,12,34,0.25)] sm:p-8">
          <IntakeForm source={source} />
        </div>
      </div>
    </main>
  );
}
