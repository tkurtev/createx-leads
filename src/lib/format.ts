const relative = new Intl.RelativeTimeFormat('bg', { numeric: 'auto' });
const full = new Intl.DateTimeFormat('bg-BG', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const short = new Intl.DateTimeFormat('bg-BG', { day: 'numeric', month: 'short', year: 'numeric' });

const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['minute', 60],
  ['hour', 24],
  ['day', 7],
];

export function relativeTime(iso: string | null, now = Date.now()): string {
  if (!iso) return 'без дата';
  const date = new Date(iso);
  let value = (date.getTime() - now) / 60_000;
  if (Math.abs(value) < 1) return 'току-що';
  for (const [unit, size] of STEPS) {
    if (Math.abs(value) < size) return relative.format(Math.round(value), unit);
    value /= size;
  }
  return short.format(date);
}

export function fullDate(iso: string | null): string {
  return iso ? full.format(new Date(iso)) : 'Без дата';
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? '?').slice(0, 2);
  return letters.toUpperCase();
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "5 минути", "3 часа", "1 ден" — how long something has been true. */
export function durationSince(iso: string | null, now = Date.now()): string | null {
  if (!iso) return null;
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return plural(Math.max(1, minutes), 'минута', 'минути');
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return plural(hours, 'час', 'часа');
  return plural(Math.floor(hours / 24), 'ден', 'дни');
}
