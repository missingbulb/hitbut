// What makes two documents reports of one speech rather than two speeches.
import { fold } from '../../shared/text.ts';
import type { SaidAt, Venue } from '../../shared/types.ts';

/**
 * The key two documents reporting one utterance agree on: the words folded and stripped of
 * punctuation, plus when and where they were said. Outlets differ on quotation marks,
 * ellipses and where they trim — none of which makes it a different thing said.
 *
 * Venue is part of the key on purpose. The same sentence to a committee and at a rally is
 * two utterances, and the difference between them is the whole point of an anomaly; merging
 * them on the words alone would erase the finding before anything could look for it.
 *
 * Two limits, both deliberate and both closed by the embedding step (#34). This is exact
 * matching on folded text, so a paraphrase or a quote trimmed mid-sentence stays separate
 * rather than being merged on a guess. And two documents that date one speech differently —
 * one to the day, one to the month — stay separate, because picking a winner between them
 * is a judgment this layer has no business making.
 */
export function mergeKey(input: { text: string; saidAt: SaidAt; venue: Venue }): string {
  const words = fold(input.text).replace(/[^\p{L}\p{N}]+/gu, '');
  return `${words}|${input.saidAt?.value ?? ''}|${input.venue}`;
}
