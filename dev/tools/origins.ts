// Where a deployed half of the product can be reached, worked out from what the deploy
// itself said. Pure: given text, it returns an origin, so the reading can be tested without
// an account. Doing the deploy is `deploy.ts`.
import { jsonArrayIn, stripAnsi } from './cloudflare.ts';

/** Every origin carries how it was found, because "derived" and "overridden" fail differently. */
export type Origin = { url: string; how: string };

/** A custom domain in front of either half is the one thing that cannot be derived. */
export const overrideFrom = (name: string, value: string | undefined): Origin | null => {
  const trimmed = value?.trim().replace(/\/+$/, '');
  return trimmed ? { url: trimmed, how: `the ${name} repository variable` } : null;
};

/** The first URL on `suffix` anywhere in wrangler's output, colour codes and all. */
export const hostIn = (output: string, suffix: string): string | undefined =>
  stripAnsi(output).match(new RegExp(`https://[a-z0-9-]+(?:\\.[a-z0-9-]+)*\\.${suffix.replaceAll('.', '\\.')}`, 'i'))?.[0];

export const deployedWorker = (output: string): Origin | null => {
  const url = hostIn(output, 'workers.dev');
  return url ? { url, how: 'the URL wrangler printed for the deployed Worker' } : null;
};

/**
 * The Pages project's own production hostname, out of `pages project list --json`. Preferred
 * over the deploy output, which carries the per-deployment alias — a URL that answers, but
 * is not where anyone reads the site.
 */
export const projectSite = (json: string, project: string): Origin | null => {
  const projects = jsonArrayIn<{ name?: string; subdomain?: string; domains?: string[] }>(json);
  const found = projects?.find((candidate) => candidate.name === project);
  const host = found?.subdomain ?? found?.domains?.[0];
  return host ? { url: `https://${host.replace(/^https?:\/\//, '')}`, how: "the Pages project's own subdomain" } : null;
};

/** Last resort: the deployment's alias with its per-deployment label stripped back off. */
export const deployedSite = (output: string, project: string): Origin | null => {
  const url = hostIn(output, 'pages.dev');
  if (!url) return null;
  const labels = new URL(url).hostname.split('.');
  const index = labels.indexOf(project);
  return index === -1
    ? null
    : { url: `https://${labels.slice(index).join('.')}`, how: "the deployment URL, back to the project's own host" };
};
