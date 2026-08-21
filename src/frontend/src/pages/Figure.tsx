// A figure's page: who they are, what the corpus holds, and the timeline — with the
// statements a live judgment names marked, so the record and the flags are one view.
import type { JSX } from 'preact';
import type { FigureDetail } from '../../../shared/api.ts';
import { useResource } from '../api.ts';
import { Link } from '../router.tsx';
import { Loading, NotFound, Quote, Shell, SourceLine, TopicChips, WhenSaid } from '../components.tsx';
import { stringsFor } from '../strings.ts';

export function Figure({ id }: { id: string }): JSX.Element {
  const strings = stringsFor('he');
  const resource = useResource<FigureDetail>(`/figures/${encodeURIComponent(id)}`);

  if (resource.state === 'loading') return <Loading strings={strings} />;
  if (resource.state !== 'ready') return <NotFound strings={strings} />;

  const { figure, timeline } = resource.value;

  return (
    <Shell>
      <section style="padding-block-start: 40px">
        {figure.status === 'retired' && <p class="notice">{strings.retired}</p>}
        <h1 class="page-title">{figure.displayName}</h1>
        <p class="meta">{figure.role}</p>

        <div class="stats">
          <div class="stat">
            <span class="stat__value">{figure.statementCount}</span>
            <span class="stat__label">{strings.statements}</span>
          </div>
          <div class="stat">
            <span class="stat__value">{figure.flaggedCount}</span>
            <span class="stat__label">{strings.flagged}</span>
          </div>
          <div class="stat">
            <span class="stat__value">{figure.topics.length}</span>
            <span class="stat__label">{strings.topics}</span>
          </div>
        </div>

        <TopicChips topics={figure.topics} />
      </section>

      <section class="section">
        <div class="section__head">
          <h2 class="section__title">{strings.statements}</h2>
          <span class="section__note">{strings.resultCount(timeline.length)}</span>
        </div>
        <div class="stack">
          {timeline.map((entry) => (
            <article class={`card${entry.flagged ? ' card--flagged' : ''}`} key={entry.statement.id}>
              <div class="card__head">
                <span class="meta">
                  <WhenSaid statement={entry.statement} strings={strings} />
                </span>
                <span class="meta">{entry.statement.topics.join(' · ')}</span>
              </div>
              <Quote statement={entry.statement}>
                <Link href={`/statements/${entry.statement.id}`}>{entry.statement.quote}</Link>
              </Quote>
              <div style="margin-block-start: 10px">
                <SourceLine source={entry.source} strings={strings} />
              </div>
            </article>
          ))}
        </div>
      </section>
    </Shell>
  );
}
