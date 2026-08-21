// One statement, with everything needed to check it: what was said, when, the surrounding
// context, who said it, and a link to the document it was taken from.
import type { JSX } from 'preact';
import type { StatementDetail } from '../../../shared/api.ts';
import { useResource } from '../api.ts';
import { Link } from '../router.tsx';
import { Arrow, Loading, NotFound, Quote, Shell, SourceLine, TopicChips, WhenSaid } from '../components.tsx';
import { stringsFor } from '../strings.ts';

export function Statement({ id }: { id: string }): JSX.Element {
  const resource = useResource<StatementDetail>(`/statements/${encodeURIComponent(id)}`);
  const language = resource.state === 'ready' ? resource.value.statement.language : 'he';
  const strings = stringsFor(language);

  if (resource.state === 'loading') return <Loading strings={strings} />;
  if (resource.state !== 'ready') return <NotFound strings={strings} />;

  const { statement, source, figure } = resource.value;

  return (
    <Shell language={language}>
      <article style="padding-block-start: 40px" class="prose">
        <div class="card__head">
          <span class="meta">
            <WhenSaid statement={statement} strings={strings} />
          </span>
          <span class="meta">
            <Link href={`/figures/${encodeURIComponent(figure.id)}`}>{figure.displayName}</Link> · {figure.role}
          </span>
        </div>

        <Quote statement={statement} class="quote quote--lead" />

        {statement.context && (
          <div class="rationale" style="margin-block-start: 0">
            <h2 class="rationale__title">{strings.context}</h2>
            <p style="margin: 0">{statement.context}</p>
          </div>
        )}

        <div style="margin-block-start: 20px">
          <SourceLine source={source} strings={strings} />
        </div>

        <div style="margin-block-start: 20px">
          <TopicChips topics={statement.topics} />
        </div>

        <p style="margin-block-start: 28px">
          <Link href={`/figures/${encodeURIComponent(figure.id)}`}>
            {strings.fullTimeline} <Arrow dir={strings.dir} />
          </Link>
        </p>
      </article>
    </Shell>
  );
}
