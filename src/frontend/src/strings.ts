// The site's own words, in the two languages the corpus is in. Direction and wording
// follow the *content*: an English pair renders an English page, left to right, because
// deferring non-Hebrew sources was never the plan — supporting both was.
import type { Language } from '../../shared/types.ts';

const he = {
  dir: 'rtl' as 'rtl' | 'ltr',
  brand: { stem: 'התבט', rest: 'אויות', latin: 'HITBUT' },
  nav: { search: 'חיפוש', methodology: 'איך זה עובד' },
  heroTitle: 'מה הם אמרו. מה הם אומרים עכשיו.',
  heroLede:
    'אוסף מתועד של התבטאויות פומביות, כל אחת עם המקור שממנו נלקחה — ובתוכו, המקומות שבהם הדברים לא מתיישבים זה עם זה.',
  searchPlaceholder: 'חיפוש בהתבטאויות…',
  searchAction: 'חיפוש',
  latest: 'סומנו לאחרונה',
  figures: 'דמויות במעקב',
  resultsFor: (query: string) => `תוצאות עבור «${query}»`,
  resultCount: (count: number) => (count === 1 ? 'התבטאות אחת' : `${count} התבטאויות`),
  noResults: 'לא נמצאו התבטאויות התואמות לחיפוש.',
  then: 'אז',
  now: 'עכשיו',
  but: 'אבל',
  whyFlagged: 'למה זה סומן',
  confidence: 'ודאות',
  viewSource: 'למקור',
  unknownDate: 'תאריך לא ידוע',
  context: 'הקשר',
  fullTimeline: 'לציר המלא',
  statements: 'התבטאויות',
  flagged: 'סומנו',
  topics: 'נושאים',
  kind: { contradiction: 'סתירה', 'position-shift': 'שינוי עמדה', consistent: 'עקבי' },
  supersededNotice: 'הסימון הזה הוחלף בסימון מאוחר יותר על אותו צמד. הוא נשמר כאן כי יש שהפנו אליו.',
  supersededLink: 'לסימון המעודכן',
  retired: 'הרשומה הזו הוסרה מהאתר ונשמרת כאן בלבד.',
  loading: 'טוען…',
  notFound: 'לא נמצא.',
  methodologyLink: 'איך האיתור עובד',
  footerRights: 'התבטאויות — אוסף מתועד של אמירות פומביות.',
};

export type Strings = typeof he;

const en: Strings = {
  dir: 'ltr',
  brand: { stem: 'התבט', rest: 'אויות', latin: 'HITBUT' },
  nav: { search: 'Search', methodology: 'How this works' },
  heroTitle: 'What they said. What they are saying now.',
  heroLede:
    'A sourced record of public statements, each with the document it came from — and, inside it, the places where the record does not add up.',
  searchPlaceholder: 'Search statements…',
  searchAction: 'Search',
  latest: 'Recently flagged',
  figures: 'Figures tracked',
  resultsFor: (query: string) => `Results for “${query}”`,
  resultCount: (count: number) => (count === 1 ? '1 statement' : `${count} statements`),
  noResults: 'No statements matched that search.',
  then: 'Then',
  now: 'Now',
  but: 'but',
  whyFlagged: 'Why this was flagged',
  confidence: 'Confidence',
  viewSource: 'View source',
  unknownDate: 'Date not established',
  context: 'Context',
  fullTimeline: 'Full timeline',
  statements: 'statements',
  flagged: 'flagged',
  topics: 'topics',
  kind: { contradiction: 'contradiction', 'position-shift': 'position shift', consistent: 'consistent' },
  supersededNotice: 'This judgment was replaced by a later one about the same pair. It is kept because people linked to it.',
  supersededLink: 'The current judgment',
  retired: 'This record was withdrawn from the site and is kept here only.',
  loading: 'Loading…',
  notFound: 'Not found.',
  methodologyLink: 'How detection works',
  footerRights: 'hitbut — a sourced record of public statements.',
};

export const STRINGS: Record<Language, Strings> = { he, en };

export const stringsFor = (language: Language): Strings => STRINGS[language];
