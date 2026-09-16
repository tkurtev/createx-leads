import { formatDuration } from '@/lib/audio/validation';
import { STATUS_LABELS, type Activity } from '@/lib/leads/types';

export function activitySummary(activity: Activity): string {
  switch (activity.type) {
    case 'call':
      return activity.status ? `Обаждане: ${STATUS_LABELS[activity.status]}` : 'Обаждане';
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
