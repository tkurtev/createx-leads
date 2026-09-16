import type { Activity, CallDetails } from './types';

export type CallActivity = Activity & { call: CallDetails };

const hasCall = (activity: Activity): activity is CallActivity => Boolean(activity.call);

/** The most recent AI call on a lead, whatever state it is in. */
export function latestCall(activities: Activity[]): CallActivity | null {
  return activities.filter(hasCall).reduce<CallActivity | null>((latest, a) => (!latest || a.at > latest.at ? a : latest), null);
}

/** The last finished AI conversation: what the team reads to catch up. */
export function lastFinishedCall(activities: Activity[]): CallActivity | null {
  return activities
    .filter((a) => hasCall(a) && a.call.state === 'ended')
    .reduce<CallActivity | null>((latest, a) => (!latest || a.at > latest.at ? (a as CallActivity) : latest), null);
}

/** A call that was placed but whose result never came back, so nobody should assume it is handled. */
export function pendingCall(activities: Activity[]): CallActivity | null {
  const latest = latestCall(activities);
  return latest?.call.state === 'queued' ? latest : null;
}
