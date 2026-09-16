'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { markSeen, parseSeen, seedSeen, unseenIds, type SeenState } from '@/lib/leads/seen';
import { currentStatus, type LeadWithActivity } from '@/lib/leads/status';
import type { Activity } from '@/lib/leads/types';

export const POLL_MS = 30_000;
const SEEN_KEY = 'cx-leads-seen-v1';

type LeadsResponse = {
  leads: LeadWithActivity[];
  emailEnabled: boolean;
  emailTestMode: boolean;
  demo: boolean;
  voiceEnabled: boolean;
  sheetUrl: string | null;
  fetchedAt: string;
};

function readStorage(): SeenState | null {
  try {
    return parseSeen(window.localStorage.getItem(SEEN_KEY));
  } catch {
    return null;
  }
}

function writeStorage(state: SeenState) {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(state));
  } catch {
    // Private mode: "new" badges just won't survive a reload.
  }
}

export function useLeads() {
  const [data, setData] = useState<LeadsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [seen, setSeen] = useState<SeenState | null>(null);
  const [arrived, setArrived] = useState<string[]>([]);
  const seenRef = useRef<SeenState | null>(null);
  const loadedIds = useRef<Set<string> | null>(null);

  const updateSeen = useCallback((next: SeenState) => {
    seenRef.current = next;
    setSeen(next);
    writeStorage(next);
  }, []);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch('/api/leads', { cache: 'no-store' });
      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }
      const body = (await response.json()) as LeadsResponse & { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Лийдовете не се заредиха.');

      const ids = body.leads.map((l) => l.id);
      const previous = seenRef.current ?? readStorage();
      const state = seedSeen(previous, ids);
      if (!seenRef.current) updateSeen(state);

      if (loadedIds.current) {
        const before = loadedIds.current;
        const fresh = ids.filter((id) => !before.has(id));
        if (fresh.length > 0) setArrived(fresh);
      }
      loadedIds.current = new Set(ids);
      setData(body);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Лийдовете не се заредиха.');
    } finally {
      setRefreshing(false);
    }
  }, [updateSeen]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && void load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  const unseen = useMemo(
    () => new Set(seen && data ? unseenIds(seen, data.leads.map((l) => l.id)) : []),
    [seen, data],
  );

  const markLeadSeen = useCallback(
    (id: string) => {
      const state = seenRef.current;
      if (state) updateSeen(markSeen(state, [id]));
    },
    [updateSeen],
  );

  const markAllSeen = useCallback(() => {
    const state = seenRef.current;
    if (state && data) updateSeen(markSeen(state, data.leads.map((l) => l.id)));
  }, [data, updateSeen]);

  const addActivity = useCallback((activity: Activity) => {
    setData((old) => {
      if (!old) return old;
      return {
        ...old,
        leads: old.leads.map((lead) => {
          if (lead.id !== activity.leadId) return lead;
          const list = [...lead.activity, activity];
          return { ...lead, activity: list, status: currentStatus(list, lead.sheetNotes.length > 0) };
        }),
      };
    });
  }, []);

  return {
    leads: data?.leads ?? null,
    emailEnabled: data?.emailEnabled ?? false,
    emailTestMode: data?.emailTestMode ?? false,
    demo: data?.demo ?? false,
    voiceEnabled: data?.voiceEnabled ?? false,
    sheetUrl: data?.sheetUrl ?? null,
    fetchedAt: data?.fetchedAt ?? null,
    error,
    refreshing,
    reload: load,
    unseen,
    arrived,
    clearArrived: () => setArrived([]),
    markLeadSeen,
    markAllSeen,
    addActivity,
  };
}
