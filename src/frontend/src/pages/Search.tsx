// Search results. The query's words are marked in each hit using the same folding the
// index used, so a word matched through its prefix is still visibly the word that matched.
import type { JSX } from 'preact';
import type { SearchResults } from '../../../shared/api.ts';
import { useResource } from '../api.ts';
import { Link } from '../router.tsx';
import { Highlighted, Loading, Quote, SearchBox, Shell, SourceLine, WhenSaid } from '../components.tsx';
import { stringsFor } from '../strings.ts';

export function Search({ query }: { query: string }): JSX.Element {
  const strings = stringsFor('he');
  const resource = useResource<SearchResults>(query ? `/search?q=${encodeURIComponent(query)}` : '/search?q=');

  if (resource.state === 'loading') return <Loading strings={strings} />;
  const hits = resource.state === 'ready' ? resource.value.hits : [];

  return (
    <Shell>
      <section style="padding-block-start: 40px">
        <SearchBox strings={strings} initial={query} />
      </section>

      <section class="section">
        <div class="section__head">
          <h2 class="section__title">{strings.resultsFor(query)}</h2>
          <span class="section__note">{strings.resultCount(hits.length)}</span>
        </div>

        {hits.length === 0 ? (
          <p class="empty">{strings.noResults}</p>
        ) : (
          <div class="stack">
            {hits.map((hit) => (
              <article class="card" key={hit.statement.id}>
                <div class="card__head">
                  <span class="meta">
                    <Link href={`/figures/${encodeURIComponent(hit.figure.id)}`}>{hit.figure.displayName}</Link>
                  </span>
                  <span class="meta">
                    <WhenSaid statement={hit.statement} strings={strings} />
                  </span>
                </div>
                <Quote statement={hit.statement}>
                  <Link href={`/statements/${hit.statement.id}`}>
                    <Highlighted text={hit.statement.quote} query={query} />
                  </Link>
                </Quote>
                <div style="margin-block-start: 10px">
                  <SourceLine source={hit.source} strings={strings} />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </Shell>
  );
}
