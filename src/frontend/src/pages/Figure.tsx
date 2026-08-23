// A figure's page: who they are, what the corpus holds, and the timeline — with the
// statements a live judgment names marked, so the record and the flags are one view.
import type { JSX } from 'preact';
import type { FigureRecord } from '../../../shared/api.ts';
import { useResource } from '../api.ts';
import { Link } from '../router.tsx';
import { Carriers, Coverage, Loading, NotFound, Quote, Shell, TopicChips, WhenSaid } from '../components.tsx';
import { stringsFor } from '../strings.ts';

export function Figure({ id }: { id: string }): JSX.Element {
  const strings = stringsFor('he');
  const resource = useResource<FigureRecord>(`/figures/${encodeURIComponent(id)}`);

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
            <span class="stat__value">{figure.utteranceCount}</span>
            <span class="stat__label">{strings.utterances}</span>
          </div>
          <div class="stat">
            <span class="stat__value">{figure.flaggedCount}</span>
            <span class="stat__label">{strings.flagged}</span>
          </div>
          <div class="stat">
            <span class="stat__value">{figure.subjects.length}</span>
            <span class="stat__label">{strings.subjects}</span>
          </div>
        </div>

        {/* Only the subjects that have been named. An unnamed one is not a topic called
            "unnamed" — it is a subject the corpus has not yet had enough of to name. */}
        <TopicChips topics={figure.subjects.map((subject) => subject.label).filter((label): label is string => Boolean(label))} />

        <Coverage coverage={figure.coverage} strings={strings} />
      </section>

      <section class="section">
        <div class="section__head">
          <h2 class="section__title">{strings.utterances}</h2>
          <span class="section__note">{strings.resultCount(timeline.length)}</span>
        </div>
        <div class="stack">
          {timeline.map((entry) => (
            <article class={`card${entry.flagged ? ' card--flagged' : ''}`} key={entry.utterance.id}>
              <div class="card__head">
                <span class="meta">
                  <WhenSaid utterance={entry.utterance} strings={strings} />
                </span>
                {/* Every outlet that carried it, named — not a count, and not one of them. */}
                <span class="meta">
                  {strings.venue[entry.utterance.venue]} · <Carriers publishers={entry.publishers} />
                </span>
              </div>
              <Quote utterance={entry.utterance}>
                <Link href={`/utterances/${entry.utterance.id}`}>{entry.utterance.text}</Link>
              </Quote>
            </article>
          ))}
        </div>
      </section>
    </Shell>
  );
}
