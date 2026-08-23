// One screen: what the corpus holds, and what each source module last did.
//
// Nothing here counts a reader of the site. Every number comes from what the server
// already knows about itself, which is why the dashboard needed no write surface and no
// change to what the product retains about anybody.
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { ModuleState, OperationsView, StatusView } from '../../shared/api.ts';
import { loadToken, readOperations, readStatus, storeToken, type Loaded } from './api.ts';
import { count, StatTile, VenueBars, YearColumns } from './charts.tsx';

/** How stale a module's last run may be before it is worth remarking on, in minutes. */
const LATE_MULTIPLE = 3;

const when = (instant: string): string => instant.replace('T', ' ').replace(/\.\d+Z$/, 'Z').replace('Z', ' UTC');

type Health = { tone: 'ok' | 'stale' | 'failing' | 'unknown'; label: string };

/**
 * Never-run is deliberately not a fourth colour: it is the absence of a reading rather
 * than a state on the same scale, so it draws no status mark at all. Every other chip
 * carries its word as well as its colour — the colour alone is never the message.
 */
function health(module: ModuleState, readAt: string): Health {
  if (!module.lastRun) return { tone: 'unknown', label: 'never run' };
  if (module.lastRun.failures.length) return { tone: 'failing', label: 'failures' };
  const minutesSince = (Date.parse(readAt) - Date.parse(module.lastRun.startedAt)) / 60_000;
  if (minutesSince > module.refreshMinutes * LATE_MULTIPLE) return { tone: 'stale', label: 'overdue' };
  return { tone: 'ok', label: 'ran' };
}

export function App(): JSX.Element {
  const [status, setStatus] = useState<Loaded<StatusView>>({ state: 'loading' });
  const [operations, setOperations] = useState<Loaded<OperationsView>>({ state: 'loading' });
  const [token, setToken] = useState(loadToken());
  // When *this page* read the server, taken from this device's clock. The server's own
  // readAt is on the wire too and is what staleness is measured against below — it has to
  // be, because a run's timestamps are the server's. But how fresh the screen in front of
  // you is, is a question about your clock, and answering it with the server's would drift
  // by whatever the skew between them happens to be.
  const [readAt, setReadAt] = useState<string | null>(null);

  useEffect(() => {
    void readStatus().then((loaded) => {
      setStatus(loaded);
      setReadAt(new Date().toISOString());
    });
  }, []);
  useEffect(() => {
    void readOperations(token).then(setOperations);
  }, [token]);

  // Ready once both halves have answered — including when one of them answered "no". A
  // refusal is an answer; waiting forever on it would leave the page half-drawn.
  const settled = status.state !== 'loading' && operations.state !== 'loading';

  return (
    <div class="page" data-ready={settled ? 'true' : 'false'}>
      <header class="masthead">
        <h1>hitbut <span class="masthead__role">operator</span></h1>
        <p class="masthead__read">{readAt ? `read ${when(readAt)}` : 'reading…'}</p>
      </header>

      {/* One cause, said once. Both halves are blank for the same reason, and repeating it
          per section reads as two faults rather than one setting. */}
      {status.state === 'no-origin' ? <NoOrigin /> : null}

      {status.state === 'no-origin' ? null : (
        <>
          {status.state === 'ready' ? <Corpus status={status.value} /> : <Unavailable loaded={status} what="the corpus" />}

          <section class="section">
            <h2>Sources</h2>
        {operations.state === 'ready' ? (
          <Modules view={operations.value} />
        ) : (
          <>
                <Unavailable loaded={operations} what="the crawl" />
                <TokenPanel onToken={(next) => { storeToken(next); setToken(next); }} current={token} />
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/** The whole page's condition, stated where a reader looks first. */
function NoOrigin(): JSX.Element {
  return (
    <section class="section">
      <p class="empty">
        No API origin is configured, so nothing was requested. Set the repository variable{' '}
        <code>API_ORIGIN</code> to the deployed Worker's origin and publish again — the console bakes it in
        at build time, because a static page has no server to ask.
      </p>
    </section>
  );
}

function Corpus({ status }: { status: StatusView }): JSX.Element {
  const { totals, distributions } = status;
  return (
    <>
      <section class="tiles">
        <StatTile label="figures" value={totals.figures} />
        <StatTile label="utterances" value={totals.utterances} />
        <StatTile label="documents" value={totals.attestations} note="attestations, not utterances" />
        <StatTile label="subjects" value={totals.clusters} />
        <StatTile label="findings" value={totals.findings} note="live and surfaced" />
        <StatTile label="unattributed" value={totals.unattributed} note="speakers not on the roster" />
      </section>

      <div class="split">
        <section class="section">
          <h2>Where it was said</h2>
          <VenueBars distribution={distributions.venue} />
        </section>
        <section class="section">
          <h2>When it was said</h2>
          <YearColumns distribution={distributions.year} />
        </section>
      </div>
    </>
  );
}

function Modules({ view }: { view: OperationsView }): JSX.Element {
  if (!view.modules.length) {
    return <p class="empty">No source modules are registered yet — the first ones arrive with the reconnaissance in #32.</p>;
  }
  return (
    <table class="modules">
      <thead>
        <tr>
          <th>module</th><th>state</th><th>last run</th>
          <th class="num">fetched</th><th class="num">cached</th><th class="num">utterances</th>
        </tr>
      </thead>
      <tbody>
        {view.modules.map((module) => {
          const state = health(module, view.readAt);
          return (
            <>
              <tr key={module.id}>
                <td>
                  <span class="modules__id">{module.id}</span>
                  <span class="modules__publisher">{module.publisher}</span>
                </td>
                <td><span class={`chip chip--${state.tone}`}>{state.label}</span></td>
                {/* Never-run is a dash, not a zero: the corpus keeps unknown as its own
                    state everywhere else and this is the page where it matters most. */}
                <td data-label="last run">{module.lastRun ? when(module.lastRun.startedAt) : <span class="none">—</span>}</td>
                <td class="num" data-label="fetched">{module.lastRun ? count(module.lastRun.fetched) : <span class="none">—</span>}</td>
                <td class="num" data-label="cached">{module.lastRun ? count(module.lastRun.cached) : <span class="none">—</span>}</td>
                <td class="num" data-label="utterances">{module.lastRun ? count(module.lastRun.utterances) : <span class="none">—</span>}</td>
              </tr>
              {module.lastRun?.failures.length ? (
                // Against the module they belong to, rather than in one list at the
                // bottom: which module is failing is the question.
                <tr class="failures" key={`${module.id}-failures`}>
                  <td colSpan={6}>
                    <ul>
                      {module.lastRun.failures.map((failure) => (
                        <li key={failure.key}><code>{failure.key}</code> {failure.reason}</li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ) : null}
            </>
          );
        })}
      </tbody>
    </table>
  );
}

/** Says which of the several ways it went wrong, because they send you to different places. */
function Unavailable({ loaded, what }: { loaded: Loaded<unknown>; what: string }): JSX.Element {
  if (loaded.state === 'loading') return <p class="empty">Reading {what}…</p>;
  // Stated once at page level, so a section says only that it has nothing.
  if (loaded.state === 'no-origin') return <p class="empty">No API origin.</p>;
  if (loaded.state === 'refused') return <p class="empty">{what} needs a token.</p>;
  if (loaded.state === 'unconfigured') return <p class="empty">{loaded.message}</p>;
  if (loaded.state === 'failed') return <p class="empty">Could not read {what}: {loaded.message}</p>;
  return <></>;
}

function TokenPanel({ current, onToken }: { current: string; onToken: (token: string) => void }): JSX.Element {
  return (
    <form
      class="token"
      onSubmit={(event) => {
        event.preventDefault();
        const field = (event.currentTarget as HTMLFormElement).elements.namedItem('token') as HTMLInputElement;
        onToken(field.value.trim());
      }}
    >
      <label for="token">Operator token</label>
      <input id="token" name="token" type="password" autoComplete="off" value={current} />
      <button type="submit">Use it</button>
      <p class="token__note">
        Kept in this browser only. It is never in the built page — a static page cannot hold a secret.
      </p>
    </form>
  );
}
