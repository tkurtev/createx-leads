import { formatDuration } from '@/lib/audio/validation';
import { STATUS_LABELS, type Activity } from '@/lib/leads/types';

export function activitySummary(activity: Activity): string {
  switch (activity.type) {
    case 'call': {
      if (activity.call?.state === 'queued') return 'AI агентът звъни в момента';
      const kind = activity.call ? 'AI обаждане' : 'Обаждане';
      const length = activity.call?.durationSec ? ` · ${formatDuration(activity.call.durationSec)} мин.` : '';
      return activity.status ? `${kind}: ${STATUS_LABELS[activity.status]}${length}` : `${kind}${length}`;
    }
    case 'email':
      return `Имейл: ${activity.text.split('\n\n')[0].replace(/^\[тест, не е изпратен\] /, '')}`;
    case 'status':
      return activity.status ? `Статус: ${STATUS_LABELS[activity.status]}` : 'Смяна на статус';
    case 'voice':
      return `Гласова бележка · ${formatDuration(activity.audio?.durationSec ?? 0)}`;
    default:
      return activity.text;
  }
}
