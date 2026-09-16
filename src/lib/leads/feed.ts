import type { LeadWithActivity } from './status';
import type { Activity, ActivityType } from './types';

export type FeedFilter = 'all' | Extract<ActivityType, 'voice' | 'call' | 'comment' | 'email'>;
export type FeedItem = { activity: Activity; lead: LeadWithActivity };

/** Everything the team did across all leads, newest first. Status-only changes are noise here. */
export function teamFeed(leads: LeadWithActivity[], filter: FeedFilter = 'all', limit = 200): FeedItem[] {
  const items: FeedItem[] = [];
  for (const lead of leads) {
    for (const activity of lead.activity) {
      if (activity.type === 'status') continue;
      if (filter !== 'all' && activity.type !== filter) continue;
      items.push({ activity, lead });
    }
  }
  return items.sort((a, b) => b.activity.at.localeCompare(a.activity.at)).slice(0, limit);
}
