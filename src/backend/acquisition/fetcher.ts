// The one place anything outside hitbut is fetched. Swapping the vendor, adding a
// rendering proxy or changing the retry policy is an edit here and nowhere else.
//
// Sources are other organisations' sites, reached without a contract: the job of this
// module is to make a source's failure legible as a failure instead of letting it become
// data that looks fine.

/** Statuses another attempt could plausibly improve. Everything else is about our request. */
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

/**
 * Markers of an anti-bot interstitial. These arrive as a perfectly ordinary 200, so
 * without this scan a challenge page is cached as if it were the document.
 */
const BOT_WALL_MARKERS = [
  'just a moment...',
  'checking your browser',
  'cf-browser-verification',
  'attention required! | cloudflare',
  'enable javascript and cookies to continue',
  'request unsuccessful. incapsula incident',
  'px-captcha',
  'are you a robot',
  'g-recaptcha',
];
/** Interstitials announce themselves early; no need to lowercase a whole document. */
const MARKER_SCAN_BYTES = 4096;

const BROWSER_HEADERS: Record<string, string> = {
  'user-agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'he-IL,he;q=0.9,en;q=0.8',
};

export type FetchFailure = 'http' | 'blocked' | 'empty' | 'network';

export type FetchResult =
  | { ok: true; body: string; status: number; attempts: number }
  | { ok: false; reason: FetchFailure; status: number | null; detail: string; attempts: number };

export type FetchDeps = {
  fetch: (url: string, init?: { headers?: Record<string, string> }) => Promise<{ status: number; text(): Promise<string> }>;
  /** Injected so a test exercises the retry path without sleeping through it. */
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
};

export type FetchOptions = {
  /** Total attempts, including the first. Budget: attempts × timeout + waits must fit the Worker's limit. */
  attempts?: number;
  /** First backoff wait; doubles each retry. */
  backoffMs?: number;
  /** Randomised pause before the request, so a run does not arrive as a metronome. */
  politenessMs?: number;
};

export function detectBotWall(body: string): boolean {
  const head = body.slice(0, MARKER_SCAN_BYTES).toLowerCase();
  return BOT_WALL_MARKERS.some((marker) => head.includes(marker));
}

export async function fetchPage(url: string, deps: FetchDeps, options: FetchOptions = {}): Promise<FetchResult> {
  const maxAttempts = options.attempts ?? 3;
  const backoff = options.backoffMs ?? 500;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const random = deps.random ?? Math.random;

  let attempts = 0;
  let last: FetchResult = { ok: false, reason: 'network', status: null, detail: 'no attempt was made', attempts: 0 };

  while (attempts < maxAttempts) {
    if (options.politenessMs) await sleep(Math.floor(options.politenessMs * (0.5 + random())));
    attempts += 1;
    try {
      const response = await deps.fetch(url, { headers: BROWSER_HEADERS });
      const body = await response.text();
      if (response.status >= 400) {
        last = { ok: false, reason: 'http', status: response.status, detail: `HTTP ${response.status}`, attempts };
        // A client error will answer identically forever; only gateway-class statuses
        // are worth the next attempt.
        if (!RETRYABLE_STATUSES.has(response.status)) return last;
      } else if (detectBotWall(body)) {
        // Not content and not a transient failure: the site is refusing us, and retrying
        // is exactly the traffic that earned the refusal.
        return { ok: false, reason: 'blocked', status: response.status, detail: 'anti-bot interstitial', attempts };
      } else if (body.trim() === '') {
        // Nothing rendered. A successful-but-empty response stays successful and empty.
        return { ok: false, reason: 'empty', status: response.status, detail: 'empty body', attempts };
      } else {
        return { ok: true, body, status: response.status, attempts };
      }
    } catch (error) {
      last = { ok: false, reason: 'network', status: null, detail: String(error), attempts };
    }
    if (attempts < maxAttempts) await sleep(backoff * 2 ** (attempts - 1));
  }
  return last;
}
