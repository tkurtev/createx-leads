import { BrandLogo } from '@/components/brand';
import { LoginForm } from '@/components/login-form';

export default function LoginPage() {
  return (
    <main className="bg-brand-hero flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="rounded-3xl bg-surface p-6 shadow-[0_24px_60px_rgba(11,12,34,0.25)] sm:p-8">
          <BrandLogo className="h-12" />
          <h1 className="mt-6 text-xl font-bold">Лийдове</h1>
          <p className="mt-1 text-sm text-muted">Входящи запитвания, обаждания и бележки на екипа.</p>
          <div className="mt-6">
            <LoginForm />
          </div>
        </div>
      </div>
    </main>
  );
}
