'use client';

import { Bell, BellOff, Loader2, LogOut, RefreshCw, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { relativeTime } from '@/lib/format';
import { followUpCount } from '@/lib/leads/followup';
import { AppNav, type AppView } from './app/app-nav';
import { ActivityView } from './app/views/activity-view';
import { FollowUpView } from './app/views/followup-view';
import { LeadsView, type LeadsTab } from './app/views/leads-view';
import { ProfileView } from './app/views/profile-view';
import { BrandLogo } from './brand';
import { LeadDetail } from './leads/lead-detail';
import { useLeads } from './leads/use-leads';

const TITLES: Record<AppView, string> = {
  leads: 'Лийдове',
  followup: 'За обаждане',
  activity: 'Активност',
  profile: 'Профил',
};

export function LeadsApp({ userName }: { userName: string }) {
  const state = useLeads();
  const { leads, unseen, arrived, clearArrived, markLeadSeen } = state;
  const [view, setView] = useState<AppView>('leads');
  const [leadsTab, setLeadsTab] = useState<LeadsTab>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notify, setNotify] = useState(false);
  const [notificationsSupported, setNotificationsSupported] = useState(false);
  const [, setTick] = useState(0);

  const selected = leads?.find((l) => l.id === selectedId) ?? null;
  const toCall = leads ? followUpCount(leads) : 0;

  useEffect(() => {
    const supported = typeof Notification !== 'undefined';
    setNotificationsSupported(supported);
    setNotify(supported && Notification.permission === 'granted');
    const timer = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // Links in notification emails open straight to the lead: /?lead=<id>
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('lead');
    if (id) setSelectedId(id);
  }, []);

  useEffect(() => {
    document.title = unseen.size > 0 ? `(${unseen.size}) Лийдове · CreateX` : 'Лийдове · CreateX';
  }, [unseen.size]);

  useEffect(() => {
    if (arrived.length === 0 || !notify || !leads) return;
    const names = leads.filter((l) => arrived.includes(l.id)).map((l) => l.name);
    new Notification(arrived.length === 1 ? 'Нов лийд' : `${arrived.length} нови лийда`, {
      body: names.slice(0, 3).join(', '),
    });
  }, [arrived, notify, leads]);

  function select(id: string) {
    setSelectedId(id);
    markLeadSeen(id);
    clearArrived();
  }

  function changeView(next: AppView) {
    setView(next);
    if (next === view) setSelectedId(null);
  }

  async function toggleNotifications() {
    if (typeof Notification === 'undefined') return;
    if (notify) return setNotify(false);
    const permission = await Notification.requestPermission();
    setNotify(permission === 'granted');
  }

  async function logout() {
    await fetch('/api/login', { method: 'DELETE' });
    window.location.href = '/login';
  }

  const iconButton = 'flex size-10 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-field';

  return (
    <div className="flex h-dvh flex-col">
      <header
        className={cn(
          'flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur',
          selected && 'hidden lg:flex',
        )}
      >
        <BrandLogo className="h-7 lg:h-8" />
        <span className="h-6 w-px bg-border" aria-hidden />
        <h1 className="text-base font-bold">
          <span className="lg:hidden">{TITLES[view]}</span>
          <span className="hidden lg:inline">Лийдове</span>
        </h1>
        {state.demo && (
          <span
            title="Примерни лийдове. Имейлите не се изпращат."
            className="rounded-[3px] bg-brand-navy px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase"
          >
            Демо
          </span>
        )}
        {unseen.size > 0 && (
          <button
            type="button"
            onClick={() => {
              setView('leads');
              setLeadsTab('unseen');
            }}
            className="cursor-pointer rounded-full bg-spark px-2.5 py-0.5 text-xs font-semibold text-white hover:opacity-90"
          >
            {unseen.size} {unseen.size === 1 ? 'нов' : 'нови'}
          </button>
        )}
        <div className="ml-auto flex items-center gap-1">
          <span className="hidden text-xs text-subtle sm:inline">
            {state.refreshing ? 'Обновява...' : state.fetchedAt ? `Обновено ${relativeTime(state.fetchedAt)}` : ''}
          </span>
          <button type="button" onClick={() => void state.reload()} aria-label="Обнови" className={iconButton}>
            <RefreshCw className={cn('size-4', state.refreshing && 'animate-spin')} aria-hidden />
          </button>
          <button
            type="button"
            onClick={toggleNotifications}
            aria-label={notify ? 'Изключи известията' : 'Включи известия за нови лийдове'}
            className={cn(iconButton, 'hidden lg:flex', notify && 'text-primary')}
          >
            {notify ? <Bell className="size-4" aria-hidden /> : <BellOff className="size-4" aria-hidden />}
          </button>
          <span className="mx-1 hidden text-sm text-muted lg:inline">{userName}</span>
          <button type="button" onClick={logout} aria-label="Изход" className={cn(iconButton, 'hidden lg:flex')}>
            <LogOut className="size-4" aria-hidden />
          </button>
        </div>
      </header>

      {state.error && (
        <div role="alert" className="flex items-start gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{state.error}</span>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <AppNav
          variant="rail"
          className="hidden lg:flex"
          view={view}
          onChange={changeView}
          unseenCount={unseen.size}
          followUpCount={toCall}
        />

        <aside
          className={cn(
            'min-h-0 w-full overflow-y-auto overscroll-contain border-r border-border bg-surface pb-20 lg:w-[420px] lg:shrink-0 lg:pb-0',
            selected && 'hidden lg:block',
            view === 'profile' && 'bg-background',
          )}
        >
          {leads === null ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
              {!state.error && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {state.error ? 'Няма връзка с таблицата.' : 'Зареждане на лийдовете...'}
            </div>
          ) : (
            <>
              <div hidden={view !== 'leads'}>
                <LeadsView
                  leads={leads}
                  unseen={unseen}
                  selectedId={selectedId}
                  tab={leadsTab}
                  onTabChange={setLeadsTab}
                  onSelect={select}
                  onMarkAllSeen={state.markAllSeen}
                />
              </div>
              {view === 'followup' && (
                <FollowUpView leads={leads} unseen={unseen} selectedId={selectedId} onSelect={select} />
              )}
              {view === 'activity' && <ActivityView leads={leads} onSelect={select} />}
              {view === 'profile' && (
                <ProfileView
                  userName={userName}
                  notify={notify}
                  notificationsSupported={notificationsSupported}
                  onToggleNotifications={toggleNotifications}
                  emailEnabled={state.emailEnabled}
                  emailTestMode={state.emailTestMode}
                  voiceEnabled={state.voiceEnabled}
                  fetchedAt={state.fetchedAt}
                  refreshing={state.refreshing}
                  onRefresh={() => void state.reload()}
                  onLogout={logout}
                />
              )}
            </>
          )}
        </aside>

        <main className={cn('relative min-h-0 flex-1 overflow-y-auto', !selected && 'hidden lg:block')}>
          {selected ? (
            <LeadDetail
              key={selected.id}
              lead={selected}
              userName={userName}
              emailEnabled={state.emailEnabled}
              voiceEnabled={state.voiceEnabled}
              agentName={state.agentName}
              sheetUrl={state.sheetUrl}
              onBack={() => setSelectedId(null)}
              onActivity={state.addActivity}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted">
              Изберете лийд от списъка, за да видите детайлите, да се обадите или да оставите коментар.
            </div>
          )}
        </main>
      </div>

      {!selected && (
        <AppNav
          variant="bottom"
          className="lg:hidden"
          view={view}
          onChange={changeView}
          unseenCount={unseen.size}
          followUpCount={toCall}
        />
      )}
    </div>
  );
}
