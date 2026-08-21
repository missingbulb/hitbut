// Minting identifiers. These are citations: a researcher puts one in a footnote, so an id
// is assigned once and never reused, renumbered or recycled. The ULID minter takes its
// clock and its randomness as arguments, which is what lets a test assert ordering.
import { stripMarks } from '../../shared/text.ts';

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const TIME_LENGTH = 10;
const RANDOM_LENGTH = 16;

/**
 * A ULID: 48 bits of millisecond time, then randomness. Lexicographic order is mint
 * order, which is what makes "the order a payload's statements were extracted in"
 * recoverable from the ids alone.
 */
export type Ulid = () => string;

function encodeTime(milliseconds: number): string {
  let time = milliseconds;
  let encoded = '';
  for (let i = 0; i < TIME_LENGTH; i++) {
    encoded = CROCKFORD[time % 32] + encoded;
    time = Math.floor(time / 32);
  }
  return encoded;
}

/** Increment the randomness in place, right to left — ULID's monotonic rule. */
function increment(indices: number[]): void {
  for (let i = indices.length - 1; i >= 0; i--) {
    if (indices[i] < 31) {
      indices[i] += 1;
      return;
    }
    indices[i] = 0;
  }
}

export function createUlidFactory(options: { now?: () => number; random?: () => number } = {}): Ulid {
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  let lastTime = -1;
  let lastRandom: number[] = [];

  return () => {
    const time = now();
    if (time === lastTime) {
      increment(lastRandom);
    } else {
      lastTime = time;
      lastRandom = Array.from({ length: RANDOM_LENGTH }, () => Math.floor(random() * 32));
    }
    return encodeTime(time) + lastRandom.map((index) => CROCKFORD[index]).join('');
  };
}

/**
 * The slug a figure is created with. It is derived from the display name of the day and
 * then frozen: renaming a figure never touches the id, because a citation of the old URL
 * has to keep resolving. `taken` is the ids already minted, so a collision gets a suffix
 * rather than a second owner.
 *
 * Hebrew names stay in Hebrew. Transliteration without vowels is guesswork — one name
 * spells three ways in Latin — and a guess baked into a permanent id is a guess forever.
 */
export function mintFigureId(displayName: string, taken: Iterable<string> = []): string {
  const base =
    stripMarks(displayName)
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '') || 'figure';
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let suffix = 2; ; suffix++) {
    const candidate = `${base}-${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
}
