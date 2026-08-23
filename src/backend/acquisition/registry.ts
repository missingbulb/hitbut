// What a source module is, and what it has to say about itself before the pipeline will
// run it. There is no support channel for any of these sites, so the two declarations
// below are the only durable record of the reconnaissance that produced the parser.
import { VENUES } from '../../shared/types.ts';
import type { Audience, Language, SourceKind, Venue } from '../../shared/types.ts';

/**
 * Where the module reads its data, in the order of preference the reconnaissance works
 * down: the hydration blob a server-rendered app embeds, then the endpoint a single-page
 * app fetches its rows from, and only then the markup — which a redesign breaks.
 */
export type DataSurface = 'hydration' | 'api' | 'markup';

const SURFACES: DataSurface[] = ['hydration', 'api', 'markup'];

/** One document worth fetching, keyed the way the source itself keys it. */
export type SourceDocument = {
  /** Stable at the source. With the module id, this is what "already fetched" means. */
  key: string;
  url: string;
};

/** A statement as the extractor read it — the speaker by name, because ids are ours to mint. */
export type RawStatement = {
  ordinal: number;
  speaker: { displayName: string; role: string };
  quote: string;
  language: Language;
  /** null when the document does not establish when it was said. */
  saidAt: string | null;
  context: string | null;
  topics: string[];
  /**
   * Where it was said, when this passage was said somewhere other than the module's usual
   * room — a witness at a committee inside a plenary transcript, a quote from a rally
   * inside an article. Absent means the module's `venue`.
   */
  venue?: Venue;
  /** Who it was addressed to, where the document establishes one. */
  audience?: Audience;
};

export type SourceModule = {
  id: string;
  publisher: string;
  kind: SourceKind;
  surface: DataSurface;
  /**
   * How fast this source actually moves. A transcript archive and a press feed do not
   * share a clock, and running everything on the fastest one re-learns a static document
   * thousands of times — which is the traffic most likely to get us blocked.
   */
  refreshMinutes: number;
  /**
   * The room this source reports from. A property of the speech act rather than of the
   * document, and the same words to a committee and at a rally are two utterances — so it
   * cannot be guessed from `kind`, which says how the document was published rather than
   * where the speaking happened.
   */
  venue: Venue;
  list(): Promise<SourceDocument[]>;
  extract(payload: string, document: SourceDocument): RawStatement[];
};

export class SourceRegistry {
  #modules = new Map<string, SourceModule>();

  /** Refuses a module that has not declared what the pipeline needs to run it safely. */
  register(module: SourceModule): void {
    const problems: string[] = [];
    if (!module.id) problems.push('an id');
    if (!module.publisher) problems.push('a publisher');
    if (!SURFACES.includes(module.surface)) problems.push(`a data surface (one of ${SURFACES.join(', ')})`);
    if (!Number.isFinite(module.refreshMinutes) || module.refreshMinutes <= 0) problems.push('a positive refresh interval in minutes');
    if (!VENUES.includes(module.venue as (typeof VENUES)[number])) problems.push(`the venue it reports from (one of ${VENUES.join(', ')})`);
    if (typeof module.list !== 'function') problems.push('a list() of documents to fetch');
    if (typeof module.extract !== 'function') problems.push('an extract() from payload to statements');
    if (problems.length) {
      throw new Error(`source module ${module.id || '(unnamed)'} is missing ${problems.join(', ')}`);
    }
    if (this.#modules.has(module.id)) throw new Error(`source module ${module.id} is already registered`);
    this.#modules.set(module.id, module);
  }

  get(id: string): SourceModule | undefined {
    return this.#modules.get(id);
  }

  all(): SourceModule[] {
    return [...this.#modules.values()];
  }
}

/**
 * The modules acquisition runs in production. Empty until the owner picks the first
 * sources off a `map-a-data-source` reconnaissance: a hand-invented sample would prove
 * support for a target the world does not serve. Tracked in #28.
 */
export function productionRegistry(): SourceRegistry {
  return new SourceRegistry();
}
