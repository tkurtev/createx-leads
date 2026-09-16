import { SYSTEM_AUTHOR, type Activity, type Lead, type LeadStatus } from './types';

/**
 * Latest explicit status wins. Without one, a lead the team already wrote notes
 * about in the sheet has clearly been contacted, so it is "in progress", not "new".
 */
export function currentStatus(activities: Activity[], hasSheetNotes = false): LeadStatus {
  const latest = activities
    .filter((a) => a.status)
    .sort((a, b) => b.at.localeCompare(a.at))[0];
  if (latest?.status) return latest.status;
  // A system note (say, a failed notification) doesn't mean anyone talked to the lead.
  if (hasSheetNotes || activities.some((a) => a.author !== SYSTEM_AUTHOR)) return 'in_progress';
  return 'new';
}

export function groupActivities(activities: Activity[]) {
  const byLead = new Map<string, Activity[]>();
  for (const activity of activities) {
    const list = byLead.get(activity.leadId) ?? [];
    list.push(activity);
    byLead.set(activity.leadId, list);
  }
  for (const list of byLead.values()) list.sort((a, b) => a.at.localeCompare(b.at));
  return byLead;
}

export type LeadWithActivity = Lead & { status: LeadStatus; activity: Activity[] };

export function attachActivity(leads: Lead[], activities: Activity[]): LeadWithActivity[] {
  const byLead = groupActivities(activities);
  return leads.map((lead) => {
    const activity = byLead.get(lead.id) ?? [];
    return { ...lead, activity, status: currentStatus(activity, lead.sheetNotes.length > 0) };
  });
}

/** Most recent thing that happened to the lead, for the "last activity" card and list preview. */
export function lastActivity(activities: Activity[]): Activity | null {
  return activities.reduce<Activity | null>((latest, a) => (!latest || a.at > latest.at ? a : latest), null);
}

/** When the lead entered its current status: the latest status change, else when it arrived. */
export function statusSince(lead: Pick<Lead, 'createdAt'>, activities: Activity[]): string | null {
  const latest = activities
    .filter((a) => a.status)
    .reduce<Activity | null>((acc, a) => (!acc || a.at > acc.at ? a : acc), null);
  return latest?.at ?? lead.createdAt;
}
