export const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '/api';

export function api(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(`${apiBase}${path}`, {
    ...init,
    credentials: 'include',
    headers,
  });
}

export async function readError(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => null)) as { message?: string | string[] } | null;
  if (Array.isArray(payload?.message)) return payload.message.join(' ');
  if (typeof payload?.message === 'string') return payload.message;
  return fallback;
}
