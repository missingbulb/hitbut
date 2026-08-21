// The page a flag actually means: the two statements side by side, the mark between them,
// and — directly under it — what the model said and how sure it was, with both sources.
// Whoever disagrees with the flag can check it here without leaving the page.
import type { JSX } from 'preact';
import type { InconsistencyDetail } from '../../../shared/api.ts';
import { useResource } from '../api.ts';
import { Link } from '../router.tsx';
import { Arrow, ButMark, KindBadge, Loading, NotFound, Shell, StatementSide } from '../components.tsx';
import { stringsFor } from '../strings.ts';

export function Inconsistency({ id }: { id: string }): JSX.Element {
  const resource = useResource<InconsistencyDetail>(`/inconsistencies/${encodeURIComponent(id)}`);
  // The page speaks the language of the statements it is about.
  const language = resource.state === 'ready' ? resource.value.later.language : 'he';
  const strings = stringsFor(language);

  if (resource.state === 'loading') return <Loading strings={strings} />;
  if (resource.state !== 'ready') return <NotFound strings={strings} />;

  const { judgment, figure, earlier, later, earlierSource, laterSource, supersededBy } = resource.value;

  return (
    <Shell language={language}>
      <article style="padding-block-start: 40px">
        {supersededBy && (
          <p class="notice">
            {strings.supersededNotice}{' '}
            <Link href={`/inconsistencies/${supersededBy.id}`}>{strings.supersededLink}</Link>
          </p>
        )}

        <div class="card__head">
          <KindBadge judgment={judgment} strings={strings} />
          <span class="meta">{later.topics.join(' · ')}</span>
        </div>

        <h1 class="page-title">
          <Link href={`/figures/${encodeURIComponent(figure.id)}`}>{figure.displayName}</Link>
        </h1>

        <div class="pair" style="margin-block-start: 24px">
          <StatementSide statement={earlier} source={earlierSource} label={strings.then} strings={strings} />
          <ButMark strings={strings} />
          <StatementSide statement={later} source={laterSource} label={strings.now} now strings={strings} />
        </div>

        <div class="rationale">
          <h2 class="rationale__title">{strings.whyFlagged}</h2>
          <p style="margin: 0 0 8px">{judgment.rationale}</p>
          <div class="meta">
            {strings.confidence} <strong style="color: var(--oxide)">{judgment.score.toFixed(2)}</strong> ·{' '}
            <span class="ltr">{judgment.modelVersion}</span> · <span class="ltr">{judgment.promptVersion}</span> ·{' '}
            <Link href="/methodology">{strings.methodologyLink}</Link>
          </div>
        </div>

        <p style="margin-block-start: 24px">
          <Link href={`/figures/${encodeURIComponent(figure.id)}`}>
            {strings.fullTimeline} <Arrow dir={strings.dir} />
          </Link>
        </p>
      </article>
    </Shell>
  );
}
