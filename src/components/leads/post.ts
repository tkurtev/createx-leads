export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (response.status === 401) window.location.href = '/login';
  if (!response.ok) throw new Error(data.error ?? 'Не се запази. Опитайте пак.');
  return data;
}
