const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function apiRequest(path: string, init: RequestInit = {}): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new Error('StayShield could not reach the API. Check that the services are running.');
  }

  if (!response.ok) {
    const body = await response.text();
    let message = `Request failed (${response.status}).`;
    if (body) {
      try {
        const parsed = JSON.parse(body) as { message?: string | string[] };
        if (typeof parsed.message === 'string') message = parsed.message;
        if (Array.isArray(parsed.message)) message = parsed.message.join(' ');
      } catch {
        message = body;
      }
    }
    throw new ApiError(message, response.status);
  }
  return response;
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiRequest(path, init);
  return response.json() as Promise<T>;
}
