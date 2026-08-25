// Shared helpers for hitbut's deploy/provision/preflight task workers: a
// subprocess runner against the checked-out repo, and a reader for a repository
// Actions VARIABLE (API_ORIGIN, SITE_ORIGIN, VECTORIZE_DIMENSIONS — custom-domain
// and model-shape overrides, none of them secret). Variables are not part of the
// `required_secrets` contract, so this reads them directly with the same
// GITHUB_TOKEN code-work already carries.

import { spawn } from 'node:child_process';

// Runs `command` in the repo root, echoing its output live and returning it once
// the child exits. `extraEnv` layers over the worker's own environment (which
// already carries CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID via
// `required_secrets`), the same way a step's `env:` block used to.
export function run(root, command, args, extraEnv = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: root,
      env: { ...process.env, ...extraEnv },
      stdio: ['inherit', 'pipe', 'inherit'],
    });
    let stdout = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      process.stdout.write(chunk);
    });
    child.on('close', (code) => resolve({ ok: code === 0, stdout }));
    child.on('error', (error) => resolve({ ok: false, stdout: '', error: error.message }));
  });
}

export async function repoVariable(name) {
  const repo = process.env.CLAUDINITE_REPO;
  const token = process.env.GITHUB_TOKEN;
  if (!repo || !token) return null;
  const response = await fetch(`https://api.github.com/repos/${repo}/actions/variables/${name}`, {
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' },
  });
  if (!response.ok) return null;
  const body = await response.json().catch(() => null);
  const value = body?.value?.trim();
  return value ? value : null;
}
