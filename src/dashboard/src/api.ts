// Reading the two routes, and holding the one credential.
//
// The token lives in localStorage rather than in the built page, because a static page
// cannot hold a secret: anything shipped in the bundle is shipped to everybody. It is
// per-browser and the operator can clear it, which is the whole of its lifecycle.
import type { OperationsView, StatusView } from '../../shared/api.ts';

const API_ORIGIN = (import.meta.env.VITE_API_ORIGIN ?? '').replace(/\/+$/, '');
const TOKEN_KEY = 'hitbut.operator.token';

/**
 * Loaded and stored behind try/catch: a browser with site data blocked throws on the
 * accessor itself, and a dashboard that cannot remember a token should still show the
 * half that needs none.
 */
export function loadToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function storeToken(token: string): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // A browser that will not keep it still shows this session's reading.
  }
}

/** Loading, or an answer, or a reason — never an empty object standing in for any of them. */
export type Loaded<T> =
  | { state: 'loading' }
  | { state: 'ready'; value: T }
  | { state: 'refused' }
  | { state: 'unconfigured'; message: string }
  | { state: 'failed'; message: string };

async function read<T>(path: string, token?: string): Promise<Loaded<T>> {
  try {
    const response = await fetch(`${API_ORIGIN}/api/v1${path}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
      // Sent so that fronting the route with Cloudflare Access — which authenticates in
      // its own redirect and leaves a cookie — needs no change here. Harmless without it.
      credentials: 'include',
    });
    if (response.status === 401) return { state: 'refused' };
    if (response.status === 503) {
      const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      return { state: 'unconfigured', message: body?.error?.message ?? 'the operations view is not configured' };
    }
    if (!response.ok) return { state: 'failed', message: `${response.status} from ${path}` };
    return { state: 'ready', value: (await response.json()) as T };
  } catch (error) {
    // The API origin being wrong, or unreachable, looks exactly like this. Say which
    // request failed: "failed to fetch" alone sends nobody anywhere useful.
    return { state: 'failed', message: `could not reach ${API_ORIGIN || '(no API origin configured)'}${path}` };
  }
}

export const readStatus = (): Promise<Loaded<StatusView>> => read<StatusView>('/status');
export const readOperations = (token: string): Promise<Loaded<OperationsView>> =>
  read<OperationsView>('/operations', token || undefined);
