// The pieces every page is built from. The masthead lockup is the approved logo: התבט —
// which reads "hitbut" — carved out of התבטאויות in the one accent colour.
import type { ComponentChildren, JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import type { Figure as FigureType, Finding, Language, Source } from '../../shared/types.ts';
import type { WireAttestation, WireUtterance } from '../../shared/api.ts';
import { highlightTerms, isHighlighted } from '../../shared/text.ts';
import { stringsFor, type Strings } from './strings.ts';
import { Link, navigate } from './router.tsx';

export function Wordmark({ strings }: { strings: Strings }): JSX.Element {
  return (
    <Link href="/" class="wordmark">
      <span class="wordmark__hebrew" dir="rtl">
        <span class="wordmark__stem">{strings.brand.stem}</span>
        <span class="wordmark__rest">{strings.brand.rest}</span>
      </span>
      <span class="wordmark__latin ltr">{strings.brand.latin}</span>
    </Link>
  );
}

/**
 * The page frame. Direction and language come from the content being shown, not from a
 * site-wide setting, so an English pair renders a left-to-right page in the same system.
 */
export function Shell(props: {
  language?: Language;
  ready?: boolean;
  children: ComponentChildren;
}): JSX.Element {
  const language = props.language ?? 'he';
  const strings = stringsFor(language);

  useEffect(() => {
    document.documentElement.dir = strings.dir;
    document.documentElement.lang = language;
  }, [language, strings.dir]);

  return (
    <>
      <header class="masthead">
        <div class="page masthead__inner">
          <Wordmark strings={strings} />
          <nav class="masthead__nav">
            <Link href="/search">{strings.nav.search}</Link>
            <Link href="/methodology">{strings.nav.methodology}</Link>
          </nav>
        </div>
        <div class="page">
          <div class="masthead__rule" />
        </div>
      </header>
      <main class="page" data-ready={props.ready === false ? undefined : 'true'}>
        {props.children}
      </main>
      <footer class="colophon">
        <div class="page colophon__inner">
          <span>{strings.footerRights}</span>
          <Link href="/methodology">{strings.methodologyLink}</Link>
        </div>
      </footer>
    </>
  );
}

export function SearchBox({ strings, initial = '' }: { strings: Strings; initial?: string }): JSX.Element {
  const submit = (event: Event) => {
    event.preventDefault();
    const input = (event.currentTarget as HTMLFormElement).elements.namedItem('q') as HTMLInputElement;
    navigate(`/search?q=${encodeURIComponent(input.value)}`);
  };
  return (
    <form class="search" onSubmit={submit}>
      <input class="search__input" type="search" name="q" value={initial} placeholder={strings.searchPlaceholder} />
      <button class="search__button" type="submit">
        {strings.searchAction}
      </button>
    </form>
  );
}

export function KindBadge({ finding, strings }: { finding: Finding; strings: Strings }): JSX.Element {
  return (
    <span class={`badge${finding.kind === 'trend-change' ? ' badge--shift' : ''}`}>
      {strings.kind[finding.kind]}
    </span>
  );
}

/**
 * Arrows are drawn, not typed. The vendored subsets carry no ← and no ↗, so a character
 * would fall back to whatever font the reader has — and to a missing-glyph box wherever
 * they have none.
 */
export function Arrow({ dir }: { dir: 'rtl' | 'ltr' }): JSX.Element {
  return (
    <svg width="14" height="10" viewBox="0 0 14 10" fill="none" aria-hidden="true" style="vertical-align: -1px">
      <g stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"
         transform={dir === 'rtl' ? 'translate(14 0) scale(-1 1)' : undefined}>
        <path d="M1 5h11" />
        <path d="M8.5 1.5 12 5l-3.5 3.5" />
      </g>
    </svg>
  );
}

/** The "leaves this site" mark, for the same reason. */
export function ExternalArrow(): JSX.Element {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true" style="vertical-align: 0">
      <g stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 8 8 2" />
        <path d="M3.5 2H8v4.5" />
      </g>
    </svg>
  );
}

/** Direction follows the text, so a Latin date or quote inside a Hebrew page stays readable. */
export const dirOf = (language: Language): 'rtl' | 'ltr' => (language === 'he' ? 'rtl' : 'ltr');

/**
 * The date, rendered to the precision the source established and no finer. A month shown as
 * a day invents a fact — and it is exactly the kind of invention nobody notices, because a
 * specific date always looks more authoritative than a vague one.
 */
export function WhenSaid({ utterance, strings }: { utterance: WireUtterance; strings: Strings }): JSX.Element {
  // Unknown is shown as unknown. A stand-in date would order a timeline wrongly and look
  // entirely plausible doing it.
  if (!utterance.saidAt) return <span class="meta">{strings.unknownDate}</span>;
  const { value, precision } = utterance.saidAt;
  const parts: Intl.DateTimeFormatOptions =
    precision === 'year' ? { year: 'numeric' }
    : precision === 'month' ? { month: 'long', year: 'numeric' }
    : { day: 'numeric', month: 'long', year: 'numeric' };
  const formatted = new Intl.DateTimeFormat(utterance.language === 'he' ? 'he-IL' : 'en-GB', {
    ...parts,
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`.slice(0, 20)));
  // Isolated: an English date inside a Hebrew page otherwise has its parts reordered.
  return (
    <span dir={dirOf(utterance.language)} style="unicode-bidi: isolate">
      {formatted}
    </span>
  );
}

/** A quote, in its own direction — the page it sits on may be in the other one. */
export function Quote(props: { utterance: WireUtterance; class?: string; children?: ComponentChildren }): JSX.Element {
  return (
    <p class={props.class ?? 'quote'} dir={dirOf(props.utterance.language)} style="unicode-bidi: isolate">
      “{props.children ?? props.utterance.text}”
    </p>
  );
}

export function SourceLine({ source, strings }: { source: Source; strings: Strings }): JSX.Element {
  return (
    <div class="meta">
      {source.publisher} ·{' '}
      <a href={source.url} rel="noopener nofollow" target="_blank">
        {strings.viewSource} <ExternalArrow />
      </a>
    </div>
  );
}

/** The query's words, marked in a result — folded the same way the index folded them. */
export function Highlighted({ text, query }: { text: string; query: string }): JSX.Element {
  const terms = highlightTerms(query);
  const parts = text.split(/([^\p{L}\p{N}]+)/u);
  return (
    <>
      {parts.map((part, index) =>
        part && isHighlighted(part, terms) ? <mark key={index}>{part}</mark> : <span key={index}>{part}</span>,
      )}
    </>
  );
}

export function TopicChips({ topics }: { topics: string[] }): JSX.Element {
  return (
    <div class="chips">
      {topics.map((topic) => (
        <span class="chip" key={topic}>
          {topic}
        </span>
      ))}
    </div>
  );
}

/**
 * What a figure's record actually covers. The point is the sentence beside the list, not
 * the list: without it a thin timeline reads as "this person has said little", which is
 * the same wrong implication an empty page would carry.
 */
export function Coverage(
  { coverage, strings }: { coverage: FigureType['coverage']; strings: Strings },
): JSX.Element {
  return (
    <section class="coverage">
      <h2 class="coverage__title">{strings.coverageTitle}</h2>
      <p class="coverage__lede">{coverage === null ? strings.coverageUnknown : strings.coverageLede}</p>
      {coverage !== null && (
        <ul class="coverage__list">
          {coverage.map((reach) => (
            <li class="coverage__item" key={reach.sourceModule}>
              <span class="coverage__source">{reach.sourceModule}</span>
              <span class="coverage__from">
                {strings.coverageFrom}
                {/* Only the date is isolated. Isolating the label with it would put a
                    Hebrew prefix inside an LTR run, which renders it after the date. */}
                <span dir="ltr" style="unicode-bidi: isolate">{reach.from}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Who carried a quote, named. Every surface that shows a quote shows this beside it: a
 * quote with no visible publisher is our word for what somebody said, and one click away is
 * not beside it. Where several outlets carried one utterance, all of them are named —
 * which outlets carried something is itself part of the record.
 */
export function Carriers({ publishers }: { publishers: string[] }): JSX.Element {
  return <span class="meta carriers">{publishers.join(' · ')}</span>;
}

/** The «אבל» mark: what sits between a Then and a Now, and what the site is named after. */
export function ButMark({ strings }: { strings: Strings }): JSX.Element {
  return <div class="mark">{strings.but}</div>;
}

/**
 * One side of the pair a trend change shows. Several documents may have reported the same
 * utterance, and all of them are listed: the claim is checkable only if a reader can get to
 * every document it rests on, not just the first one we happened to fetch.
 */
export function UtteranceSide(props: {
  utterance: WireUtterance;
  attestations: WireAttestation[];
  label: string;
  now?: boolean;
  strings: Strings;
}): JSX.Element {
  return (
    <div class={`pair__side${props.now ? ' pair__side--now' : ''}`}>
      <div class="pair__when">
        <span class="pair__label">{props.label}</span>
        <span class="pair__date">
          <WhenSaid utterance={props.utterance} strings={props.strings} />
        </span>
      </div>
      <Quote utterance={props.utterance} />
      {props.attestations.map(({ attestation, source }) => (
        <SourceLine source={source} strings={props.strings} key={attestation.id} />
      ))}
    </div>
  );
}

export function Loading({ strings }: { strings: Strings }): JSX.Element {
  return (
    <Shell ready={false}>
      <p class="empty">{strings.loading}</p>
    </Shell>
  );
}

export function NotFound({ strings }: { strings: Strings }): JSX.Element {
  return (
    <Shell>
      <p class="empty">{strings.notFound}</p>
    </Shell>
  );
}
