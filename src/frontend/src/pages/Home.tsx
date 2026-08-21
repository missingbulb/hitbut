// The home page leads with the search, then what was flagged most recently, then the
// figures being tracked — the corpus first, the inconsistencies as one lens over it.
import type { JSX } from 'preact';
import type { FigureSummary, InconsistencySummary, Page } from '../../../shared/api.ts';
import { useResource } from '../api.ts';
import { Link } from '../router.tsx';
import { KindBadge, Loading, Quote, SearchBox, Shell, WhenSaid } from '../components.tsx';
import { stringsFor, type Strings } from '../strings.ts';

function InconsistencyCard({ item, strings }: { item: InconsistencySummary; strings: Strings }): JSX.Element {
  return (
    <article class="card card--flagged">
      <div class="card__head">
        <KindBadge judgment={item.judgment} strings={strings} />
        <span class="meta">{item.later.topics.join(' · ')}</span>
      </div>
      <h3 class="section__title">
        <Link href={`/inconsistencies/${item.judgment.id}`}>{item.figure.displayName}</Link>
      </h3>
      <div class="stack" style="gap: 10px; margin-block-start: 12px">
        <div>
          <div class="meta">
            {strings.then} · <WhenSaid statement={item.earlier} strings={strings} />
          </div>
          <Quote statement={item.earlier} class="quote quote--card" />
        </div>
        <div>
          <div class="meta">
            {strings.now} · <WhenSaid statement={item.later} strings={strings} />
          </div>
          <Quote statement={item.later} class="quote quote--card" />
        </div>
      </div>
    </article>
  );
}

export function Home(): JSX.Element {
  const strings = stringsFor('he');
  const flagged = useResource<Page<InconsistencySummary>>('/inconsistencies?limit=3');
  const figures = useResource<Page<FigureSummary>>('/figures?limit=6');

  if (flagged.state !== 'ready' || figures.state !== 'ready') return <Loading strings={strings} />;

  return (
    <Shell>
      <section class="hero">
        <h1 class="hero__title">{strings.heroTitle}</h1>
        <p class="hero__lede">{strings.heroLede}</p>
        <div style="margin-block-start: 24px">
          <SearchBox strings={strings} />
        </div>
      </section>

      <section class="section">
        <div class="section__head">
          <h2 class="section__title">{strings.latest}</h2>
          <span class="section__note">
            <Link href="/methodology">{strings.methodologyLink}</Link>
          </span>
        </div>
        <div class="stack">
          {flagged.value.items.map((item) => (
            <InconsistencyCard key={item.judgment.id} item={item} strings={strings} />
          ))}
        </div>
      </section>

      <section class="section">
        <div class="section__head">
          <h2 class="section__title">{strings.figures}</h2>
        </div>
        <div class="grid">
          {figures.value.items.map((figure) => (
            <article class="card" key={figure.id}>
              <h3 class="section__title" style="font-size: 19px">
                <Link href={`/figures/${encodeURIComponent(figure.id)}`}>{figure.displayName}</Link>
              </h3>
              <div class="meta">{figure.role}</div>
              <div class="stats" style="margin-block-end: 0">
                <div class="stat">
                  <span class="stat__value">{figure.statementCount}</span>
                  <span class="stat__label">{strings.statements}</span>
                </div>
                <div class="stat">
                  <span class="stat__value">{figure.flaggedCount}</span>
                  <span class="stat__label">{strings.flagged}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </Shell>
  );
}
