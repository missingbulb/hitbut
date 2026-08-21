// Hebrew-aware text folding, shared because search only works if the same rules run in
// three places: the indexer that writes the search column, the API that builds the query,
// and the site that highlights what matched. Two copies of these rules would be two
// different searches.
//
// SQLite's FTS tokenizers split Hebrew on whitespace and nothing else. Hebrew glues its
// conjunction, article and prepositions onto the front of the word, so `בכנסת` and `כנסת`
// are unrelated words to an unaided index — and D1 cannot load a custom tokenizer. So the
// folding happens here, on our side of the index.

/** Niqqud and cantillation: decoration a formal transcript carries and a press release does not. */
const MARKS = /[֑-ׇ]/g;
/** Geresh and gershayim, plus the ASCII and curly quotes people type instead of them. */
const QUOTE_MARKS = /['"‘’“”׳״]/g;
/** Positional variants of one letter — the same letter as far as a search is concerned. */
const FINAL_FORMS: Record<string, string> = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };

/** The one-letter clitics Hebrew attaches to the front of a word. */
const CLITICS = ['ו', 'ה', 'ב', 'כ', 'ל', 'מ', 'ש'];
/**
 * A strip that would leave less than this keeps only the surface token: `בית` must not be
 * indexed as `ית`, and `של` must not become `ל`. Three keeps `בבית` → `בית` — the common
 * case — at the price of some stems that are not words (`כנסת` also yields `נסת`). Without
 * a Hebrew lexicon that price buys the recall, and it costs precision: a stem two
 * different words share makes them match. Tracked as an open question on the methodology page.
 */
const MIN_STEM = 3;
/** Hebrew stacks clitics (`ושב…`, `שבכ…`) but rarely more than two. */
const MAX_STRIPS = 2;

const HEBREW_LETTER = /[א-ת]/;

/**
 * Decoration removed and case flattened, with the letters left alone. This is as far as
 * anything user-visible folds: a figure's slug goes through here, so it reads as the name
 * rather than as a misspelling of it.
 */
export function stripMarks(text: string): string {
  return text.replace(MARKS, '').replace(QUOTE_MARKS, '').toLowerCase();
}

/** One word, reduced to the form both the index and the query agree on. */
export function fold(word: string): string {
  return [...stripMarks(word)].map((letter) => FINAL_FORMS[letter] ?? letter).join('');
}

export const isHebrew = (word: string): boolean => HEBREW_LETTER.test(word);

/** Words, already folded. Anything that is not a letter or a digit separates them. */
export function tokenize(text: string): string[] {
  return fold(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** A Hebrew word with its plausible stems; a non-Hebrew word is only itself. */
export function variantsOf(token: string): string[] {
  if (!isHebrew(token)) return [token];
  const variants = [token];
  let frontier = [token];
  for (let strip = 0; strip < MAX_STRIPS; strip++) {
    const next: string[] = [];
    for (const word of frontier) {
      for (const clitic of CLITICS) {
        if (!word.startsWith(clitic)) continue;
        const stem = word.slice(clitic.length);
        if (stem.length < MIN_STEM || variants.includes(stem)) continue;
        variants.push(stem);
        next.push(stem);
      }
    }
    frontier = next;
  }
  return variants;
}

/**
 * What goes into the search column: every token plus its stems, so a query for the bare
 * word reaches a statement that only ever wrote it with a prefix.
 */
export function indexTerms(text: string): string[] {
  const terms = new Set<string>();
  for (const token of tokenize(text)) for (const variant of variantsOf(token)) terms.add(variant);
  return [...terms];
}

export const indexText = (text: string): string => indexTerms(text).join(' ');

/**
 * The FTS5 MATCH expression for a query: every query word must appear (AND), in any of
 * its forms (OR). The query is expanded too, so a query that carries the prefix reaches a
 * statement that does not.
 */
export function matchExpression(query: string): string | null {
  const groups = tokenize(query)
    .map((token) => variantsOf(token).map((variant) => `"${variant}"`).join(' OR '))
    .map((group) => `(${group})`);
  return groups.length ? groups.join(' AND ') : null;
}

/** Every form of every word in the query — what a result should highlight. */
export function highlightTerms(query: string): Set<string> {
  return new Set(tokenize(query).flatMap(variantsOf));
}

/** Whether a word from a result is one the query asked for. */
export const isHighlighted = (word: string, terms: Set<string>): boolean =>
  variantsOf(fold(word)).some((variant) => terms.has(variant));
