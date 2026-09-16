import { redirect } from 'next/navigation';
import { LeadsApp } from '@/components/leads-app';
import { getSession } from '@/lib/auth/server';

export default async function Home() {
  const session = await getSession();
  if (!session) redirect('/login');
  return <LeadsApp userName={session.name} />;
}
