// The prompt, committed and versioned. The version string below travels with every
// judgment the prompt produced, so "which prompt said this?" stays answerable after the
// prompt has moved on. Changing the wording means minting a new version here — never
// editing v1 in place, which would relabel judgments nobody re-ran.
import type { Figure, Statement } from '../../shared/types.ts';

export const PROMPT_VERSION = 'inconsistency/v1';

export type PromptInput = {
  figure: Figure;
  earlier: Statement;
  later: Statement;
};

const when = (statement: Statement): string => statement.saidAt ?? 'תאריך לא ידוע / date not established';

export const SYSTEM_PROMPT = [
  'You compare two things one public figure said, and report whether the later one conflicts with the earlier one.',
  'Most statements in this corpus are Hebrew. Read them in Hebrew; do not translate before judging.',
  '',
  'Answer with one of three kinds:',
  '- "contradiction": the later statement asserts something the earlier one rules out, or denies having held the earlier position.',
  '- "position-shift": the figure has changed position over time and the later statement is consistent with having done so openly.',
  '- "consistent": the two can both be true, or they are about different things.',
  '',
  'Be conservative. A difference of emphasis, a narrower claim, or a statement about a different subject is "consistent".',
  'The rationale is shown to readers beside both quotes, so state what specifically conflicts, in the language of the statements.',
  'Reply with JSON only: {"kind": "...", "score": 0.0-1.0, "rationale": "..."}',
].join('\n');

export function buildUserPrompt(input: PromptInput): string {
  return [
    `Speaker: ${input.figure.displayName} (${input.figure.role})`,
    '',
    `Earlier — ${when(input.earlier)}:`,
    input.earlier.quote,
    input.earlier.context ? `Context: ${input.earlier.context}` : '',
    '',
    `Later — ${when(input.later)}:`,
    input.later.quote,
    input.later.context ? `Context: ${input.later.context}` : '',
  ]
    .filter((line) => line !== '')
    .join('\n');
}
