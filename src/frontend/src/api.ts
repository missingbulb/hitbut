// Everything the site knows comes through /api/v1. The origin is a build-time value
// because the two halves deploy as separate artifacts — Pages and Workers — and the site
// has no server side to proxy through.
import { useEffect, useState } from 'preact/hooks';
import { API_BASE } from '../../shared/api.ts';

const ORIGIN: string = import.meta.env.VITE_API_ORIGIN ?? '';

export const apiUrl = (path: string): string => `${ORIGIN}${API_BASE}${path}`;

export type Resource<Value> =
  | { state: 'loading' }
  | { state: 'ready'; value: Value }
  | { state: 'missing' }
  | { state: 'error'; message: string };

export function useResource<Value>(path: string | null): Resource<Value> {
  const [resource, setResource] = useState<Resource<Value>>({ state: 'loading' });

  useEffect(() => {
    if (path === null) return;
    let live = true;
    setResource({ state: 'loading' });
    fetch(apiUrl(path))
      .then(async (response) => {
        if (!live) return;
        if (response.status === 404) return setResource({ state: 'missing' });
        if (!response.ok) return setResource({ state: 'error', message: `HTTP ${response.status}` });
        setResource({ state: 'ready', value: (await response.json()) as Value });
      })
      .catch((error: unknown) => {
        if (live) setResource({ state: 'error', message: String(error) });
      });
    return () => {
      live = false;
    };
  }, [path]);

  return resource;
}
