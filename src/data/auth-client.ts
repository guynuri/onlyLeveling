// Client for the Worker's auth endpoints (PLAN Phase 4b). Bearer token only, never a cookie:
// every request omits credentials, so the browser cannot attach one.

export interface AuthClientOptions {
  baseUrl: string;
  fetch: typeof fetch;
}

export class AuthClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function post<T>(opts: AuthClientOptions, path: string, body: unknown, token?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await opts.fetch(`${opts.baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'omit',
    });
  } catch {
    throw new AuthClientError('network', 'Could not reach the server. Check your connection and try again.');
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string } & Record<string, unknown>;
  if (!res.ok) {
    const code = data.code ?? (res.status === 429 ? 'rate_limited' : `http_${res.status}`);
    throw new AuthClientError(code, data.error ?? `The server answered ${res.status}.`);
  }
  return data as T;
}

export function signInRequest(
  opts: AuthClientOptions,
  input: { username: string; password: string },
): Promise<{ token: string; userId: string }> {
  return post(opts, '/api/auth/signin', input);
}

export function signUpRequest(
  opts: AuthClientOptions,
  input: { code: string; username: string; password: string },
): Promise<{ token: string; userId: string }> {
  return post(opts, '/api/auth/signup', input);
}

export function recoverRequest(
  opts: AuthClientOptions,
  input: { username: string; code: string; newPassword: string },
): Promise<{ token: string }> {
  return post(opts, '/api/auth/recover', input);
}

export async function signOutRequest(opts: AuthClientOptions, token: string): Promise<void> {
  await post(opts, '/api/auth/signout', {}, token);
}

export function createInviteRequest(opts: AuthClientOptions, token: string): Promise<{ code: string }> {
  return post(opts, '/api/invites', {}, token);
}
