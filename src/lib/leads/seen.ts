/**
 * "New" means: this browser has never shown the lead before. On the first visit
 * everything already in the sheet counts as known, so only leads that arrive
 * afterwards light up. Opening a lead, or "mark all as seen", clears it.
 */
export type SeenState = { known: string[] };

const LIMIT = 5000;

export function seedSeen(state: SeenState | null, currentIds: string[]): SeenState {
  return state ?? { known: currentIds.slice(-LIMIT) };
}

export function unseenIds(state: SeenState, currentIds: string[]): string[] {
  const known = new Set(state.known);
  return currentIds.filter((id) => !known.has(id));
}

export function markSeen(state: SeenState, ids: string[]): SeenState {
  const known = new Set(state.known);
  const additions = [...new Set(ids)].filter((id) => !known.has(id));
  if (additions.length === 0) return state;
  return { known: [...state.known, ...additions].slice(-LIMIT) };
}

export function parseSeen(raw: string | null): SeenState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    if (value && typeof value === 'object' && Array.isArray((value as SeenState).known)) {
      return { known: (value as SeenState).known.filter((id) => typeof id === 'string') };
    }
  } catch {
    // Corrupt storage: start fresh rather than flag everything as new.
  }
  return null;
}
