'use client';

import { Bell, LogOut, Mail, Mic, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/cn';
import { initials, relativeTime } from '@/lib/format';

type Props = {
  userName: string;
  notify: boolean;
  notificationsSupported: boolean;
  onToggleNotifications: () => void;
  emailEnabled: boolean;
  emailTestMode: boolean;
  voiceEnabled: boolean;
  fetchedAt: string | null;
  refreshing: boolean;
  onRefresh: () => void;
  onLogout: () => void;
};

function Row({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Bell;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-field text-foreground">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold">{title}</p>
        <p className="text-[13px] text-muted">{description}</p>
      </div>
      {children}
    </div>
  );
}

function StateTag({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded-[3px] px-1.5 py-0.5 text-[11px] font-semibold',
        on ? 'bg-emerald-600 text-white' : 'bg-field text-muted',
      )}
    >
      {on ? 'Включено' : 'Изключено'}
    </span>
  );
}

export function ProfileView(props: Props) {
  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-4 rounded-2xl bg-surface p-4 shadow-[0_1px_3px_rgba(27,29,42,0.06)]">
        <span className="bg-brand flex size-14 items-center justify-center rounded-xl text-lg font-bold text-white">
          {initials(props.userName)}
        </span>
        <div>
          <p className="text-lg font-bold">{props.userName}</p>
          <p className="text-[13px] text-muted">Екип продажби · CreateX</p>
        </div>
      </div>

      <div className="divide-y divide-border rounded-2xl bg-surface shadow-[0_1px_3px_rgba(27,29,42,0.06)]">
        <Row
          icon={Bell}
          title="Известия за нови лийдове"
          description={
            props.notificationsSupported
              ? 'Изскачащо съобщение, докато приложението е отворено.'
              : 'Този браузър не поддържа известия.'
          }
        >
          <button
            type="button"
            role="switch"
            aria-checked={props.notify}
            aria-label="Известия за нови лийдове"
            disabled={!props.notificationsSupported}
            onClick={props.onToggleNotifications}
            className={cn(
              'relative h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40',
              props.notify ? 'bg-action' : 'bg-border',
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow transition-transform',
                props.notify && 'translate-x-5',
              )}
            />
          </button>
        </Row>
        <Row
          icon={Mail}
          title="Имейли от приложението"
          description={
            props.emailTestMode
              ? 'Тестов режим: имейлите се записват в историята, но не се изпращат.'
              : props.emailEnabled
                ? 'Имейлите се изпращат директно.'
                : 'Отварят се в програмата ви за поща.'
          }
        >
          <StateTag on={props.emailEnabled && !props.emailTestMode} />
        </Row>
        <Row
          icon={Mic}
          title="Гласови бележки"
          description={props.voiceEnabled ? 'Записите се пазят защитено, само за екипа.' : 'Не е свързано хранилище за записите.'}
        >
          <StateTag on={props.voiceEnabled} />
        </Row>
        <Row
          icon={RefreshCw}
          title="Данни от таблицата"
          description={props.fetchedAt ? `Обновено ${relativeTime(props.fetchedAt)}, автоматично на 30 секунди.` : 'Зареждане...'}
        >
          <button
            type="button"
            onClick={props.onRefresh}
            aria-label="Обнови сега"
            className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-field"
          >
            <RefreshCw className={cn('size-4', props.refreshing && 'animate-spin')} aria-hidden />
          </button>
        </Row>
      </div>

      <button
        type="button"
        onClick={props.onLogout}
        className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-red-200 bg-surface text-sm font-semibold text-red-700 transition-colors hover:bg-red-50"
      >
        <LogOut className="size-4" aria-hidden />
        Изход
      </button>
    </div>
  );
}
