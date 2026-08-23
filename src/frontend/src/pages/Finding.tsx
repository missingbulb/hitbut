// The page a flag actually means. A trend change keeps the shape the product is named
// after: the two utterances either side of the change, the mark between them, and what the
// series said underneath. An anomaly is one utterance rather than two — so it gets the room
// it was said in, which is the whole of why it is worth surfacing.
import type { JSX } from 'preact';
import type { FindingDetail } from '../../../shared/api.ts';
import { useResource } from '../api.ts';
import { Link } from '../router.tsx';
import { Arrow, ButMark, KindBadge, Loading, NotFound, Quote, Shell, SourceLine, UtteranceSide, WhenSaid } from '../components.tsx';
import { stringsFor } from '../strings.ts';

export function Finding({ id }: { id: string }): JSX.Element {
  const resource = useResource<FindingDetail>(`/findings/${encodeURIComponent(id)}`);
  // The page speaks the language of the utterances it is about.
  const language = resource.state === 'ready' ? (resource.value.restsOn[0]?.utterance.language ?? 'he') : 'he';
  const strings = stringsFor(language);

  if (resource.state === 'loading') return <Loading strings={strings} />;
  if (resource.state !== 'ready') return <NotFound strings={strings} />;

  const { finding, figure, restsOn, supersededBy } = resource.value;
  const before = restsOn.find((rests) => rests.role === 'before');
  const after = restsOn.find((rests) => rests.role === 'after');
  const deviating = restsOn.find((rests) => rests.role === 'deviating');

  return (
    <Shell language={language}>
      <article style="padding-block-start: 40px">
        {supersededBy && (
          <p class="notice">
            {strings.supersededNotice} <Link href={`/findings/${supersededBy.id}`}>{strings.supersededLink}</Link>
          </p>
        )}

        <div class="card__head">
          <KindBadge finding={finding} strings={strings} />
          {finding.changed && (
            <span class="meta">
              {strings.changedBetween} <span class="ltr">{finding.changed.after}</span> {strings.and}{' '}
              <span class="ltr">{finding.changed.before}</span>
            </span>
          )}
        </div>

        <h1 class="page-title">
          <Link href={`/figures/${encodeURIComponent(figure.id)}`}>{figure.displayName}</Link>
        </h1>

        {before && after ? (
          <div class="pair" style="margin-block-start: 24px">
            <UtteranceSide
              utterance={before.utterance}
              attestations={before.attestations}
              label={strings.then}
              strings={strings}
            />
            <ButMark strings={strings} />
            <UtteranceSide
              utterance={after.utterance}
              attestations={after.attestations}
              label={strings.now}
              now
              strings={strings}
            />
          </div>
        ) : (
          deviating && (
            <section style="margin-block-start: 24px">
              <p class="meta">
                <WhenSaid utterance={deviating.utterance} strings={strings} />
              </p>
              <Quote utterance={deviating.utterance} class="quote quote--lead" />
              {/* The room, given the weight it deserves: an anomaly's claim is not that a
                  position moved but that it moved *here*. */}
              <p class="anomaly__where">
                {strings.addressedTo}
                <strong>{strings.venue[deviating.utterance.venue]}</strong>
                {deviating.utterance.audience && (
                  <>
                    {' · '}
                    {strings.audienceLabel}
                    <strong>{strings.audience[deviating.utterance.audience]}</strong>
                  </>
                )}
              </p>
              {deviating.attestations.map(({ attestation, source }) => (
                <SourceLine source={source} strings={strings} key={attestation.id} />
              ))}
            </section>
          )
        )}

        <div class="rationale">
          <h2 class="rationale__title">{strings.whyFlagged}</h2>
          <p style="margin: 0 0 8px">{finding.rationale}</p>
          <div class="meta">
            {strings.confidence} <strong style="color: var(--oxide)">{finding.score.toFixed(2)}</strong> ·{' '}
            <span class="ltr">{finding.modelVersion}</span> · <span class="ltr">{finding.promptVersion}</span> ·{' '}
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
