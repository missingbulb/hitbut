// One utterance, with everything needed to check it: what was said, when — to the precision
// the source established — where and to whom, and every document that reported it.
import type { JSX } from 'preact';
import type { UtteranceDetail } from '../../../shared/api.ts';
import { useResource } from '../api.ts';
import { Link } from '../router.tsx';
import { Arrow, Loading, NotFound, Quote, Shell, SourceLine, WhenSaid } from '../components.tsx';
import { stringsFor } from '../strings.ts';

export function Utterance({ id }: { id: string }): JSX.Element {
  const resource = useResource<UtteranceDetail>(`/utterances/${encodeURIComponent(id)}`);
  const language = resource.state === 'ready' ? resource.value.utterance.language : 'he';
  const strings = stringsFor(language);

  if (resource.state === 'loading') return <Loading strings={strings} />;
  if (resource.state !== 'ready') return <NotFound strings={strings} />;

  const { utterance, figure, attestations, subject } = resource.value;

  return (
    <Shell language={language}>
      <article style="padding-block-start: 40px" class="prose">
        <div class="card__head">
          <span class="meta">
            <WhenSaid utterance={utterance} strings={strings} />
          </span>
          <span class="meta">
            <Link href={`/figures/${encodeURIComponent(figure.id)}`}>{figure.displayName}</Link> · {figure.role}
          </span>
        </div>

        <Quote utterance={utterance} class="quote quote--lead" />

        {/* Where it was said and to whom. A property of the speech act rather than of any
            document, and the part an anomaly turns on. */}
        <p class="meta">
          {`${strings.addressedTo}${strings.venue[utterance.venue]}`}
          {utterance.audience && ` · ${strings.audienceLabel}${strings.audience[utterance.audience]}`}
        </p>

        <div style="margin-block-start: 20px">
          <h2 class="rationale__title">{strings.attestedBy(attestations.length)}</h2>
          {attestations.map(({ attestation, source }) => (
            <div class="attestation" key={attestation.id}>
              <SourceLine source={source} strings={strings} />
              {/* The wording this document printed, where it differs from the fullest one
                  above — a trimmed quote is a fact about that document, not about the
                  utterance, and hiding the difference hides an editorial decision. */}
              {attestation.text !== utterance.text && (
                <p class="attestation__text" dir={utterance.language === 'he' ? 'rtl' : 'ltr'}>
                  “{attestation.text}”
                </p>
              )}
            </div>
          ))}
        </div>

        <p class="meta" style="margin-block-start: 20px">
          {subject
            ? `${strings.subject}: ${subject.label ?? strings.unnamedSubject}`
            : strings.unplaced}
        </p>

        <p style="margin-block-start: 28px">
          <Link href={`/figures/${encodeURIComponent(figure.id)}`}>
            {strings.fullTimeline} <Arrow dir={strings.dir} />
          </Link>
        </p>
      </article>
    </Shell>
  );
}
