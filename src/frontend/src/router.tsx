// A router, because six routes and an intercepted click is what routing is here. A
// library would bring its own view of history, scroll and lazy loading; none of that is
// wanted on a site that is six pages of text.
import { useEffect, useState } from 'preact/hooks';
import type { ComponentChildren, JSX } from 'preact';

const LOCATION_CHANGED = 'hitbut:navigated';

export type Route = { path: string; query: URLSearchParams };

const currentRoute = (): Route => ({
  path: window.location.pathname,
  query: new URLSearchParams(window.location.search),
});

export function navigate(to: string): void {
  window.history.pushState(null, '', to);
  window.dispatchEvent(new Event(LOCATION_CHANGED));
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(currentRoute);
  useEffect(() => {
    const update = () => setRoute(currentRoute());
    window.addEventListener(LOCATION_CHANGED, update);
    window.addEventListener('popstate', update);
    return () => {
      window.removeEventListener(LOCATION_CHANGED, update);
      window.removeEventListener('popstate', update);
    };
  }, []);
  return route;
}

export function Link(props: { href: string; class?: string; children: ComponentChildren }): JSX.Element {
  const onClick = (event: MouseEvent) => {
    // Leave the modified clicks alone: a middle click or a ⌘-click means "somewhere else".
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    navigate(props.href);
    window.scrollTo(0, 0);
  };
  return (
    <a href={props.href} class={props.class} onClick={onClick}>
      {props.children}
    </a>
  );
}

/** `/figures/:id` and friends: one parameter, always the last segment. */
export function matchRoute(path: string, prefix: string): string | null {
  if (!path.startsWith(`${prefix}/`)) return null;
  const rest = path.slice(prefix.length + 1);
  return rest && !rest.includes('/') ? decodeURIComponent(rest) : null;
}
