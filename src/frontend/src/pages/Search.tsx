// Search results. The query's words are marked in each hit using the same folding the
// index used, so a word matched through its prefix is still visibly the word that matched.
import type { JSX } from 'preact';
import type { UtteranceSearchResults } from '../../../shared/api.ts';
import { useResource } from '../api.ts';
import { Link } from '../router.tsx';
import { Highlighted, Loading, Quote, SearchBox, Shell, WhenSaid } from '../components.tsx';
import { stringsFor } from '../strings.ts';

export function Search({ query }: { query: string }): JSX.Element {
  const strings = stringsFor('he');
  const resource = useResource<UtteranceSearchResults>(query ? `/search?q=${encodeURIComponent(query)}` : '/search?q=');

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
              <article class="card" key={hit.utterance.id}>
                <div class="card__head">
                  <span class="meta">
                    <Link href={`/figures/${encodeURIComponent(hit.figure.id)}`}>{hit.figure.displayName}</Link>
                  </span>
                  <span class="meta">
                    <WhenSaid utterance={hit.utterance} strings={strings} />
                  </span>
                </div>
                <Quote utterance={hit.utterance}>
                  <Link href={`/utterances/${hit.utterance.id}`}>
                    <Highlighted text={hit.utterance.text} query={query} />
                  </Link>
                </Quote>
                {/* One result per thing said, so a speech five outlets carried is one row
                    with five sources behind it rather than five rows of the same sentence. */}
                <div class="meta" style="margin-block-start: 10px">
                  {strings.attestedBy(hit.attestationCount)}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </Shell>
  );
}
