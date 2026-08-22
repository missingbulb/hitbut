// The pieces every page is built from. The masthead lockup is the approved logo: התבט —
// which reads "hitbut" — carved out of התבטאויות in the one accent colour.
import type { ComponentChildren, JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import type { Figure as FigureType, Judgment, Language, Source, Statement } from '../../shared/types.ts';
import type { WireStatement } from '../../shared/api.ts';
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

export function KindBadge({ judgment, strings }: { judgment: Judgment; strings: Strings }): JSX.Element {
  return (
    <span class={`badge${judgment.kind === 'position-shift' ? ' badge--shift' : ''}`}>
      {strings.kind[judgment.kind]}
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

export function WhenSaid({ statement, strings }: { statement: WireStatement; strings: Strings }): JSX.Element {
  // Unknown is shown as unknown. A stand-in date would order a timeline wrongly and look
  // entirely plausible doing it.
  if (!statement.saidAt) return <span class="meta">{strings.unknownDate}</span>;
  const formatted = new Intl.DateTimeFormat(statement.language === 'he' ? 'he-IL' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(statement.saidAt));
  // Isolated: an English date inside a Hebrew page otherwise has its parts reordered.
  return (
    <span dir={dirOf(statement.language)} style="unicode-bidi: isolate">
      {formatted}
    </span>
  );
}

/** A quote, in its own direction — the page it sits on may be in the other one. */
export function Quote(props: { statement: WireStatement | Statement; class?: string; children?: ComponentChildren }): JSX.Element {
  return (
    <p class={props.class ?? 'quote'} dir={dirOf(props.statement.language)} style="unicode-bidi: isolate">
      “{props.children ?? props.statement.quote}”
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

/** The «אבל» mark: what sits between a Then and a Now, and what the site is named after. */
export function ButMark({ strings }: { strings: Strings }): JSX.Element {
  return <div class="mark">{strings.but}</div>;
}

export function StatementSide(props: {
  statement: WireStatement | Statement;
  source: Source;
  label: string;
  now?: boolean;
  strings: Strings;
}): JSX.Element {
  const wire = props.statement as WireStatement;
  return (
    <div class={`pair__side${props.now ? ' pair__side--now' : ''}`}>
      <div class="pair__when">
        <span class="pair__label">{props.label}</span>
        <span class="pair__date">
          <WhenSaid statement={wire} strings={props.strings} />
        </span>
      </div>
      <Quote statement={props.statement} />
      <SourceLine source={props.source} strings={props.strings} />
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
