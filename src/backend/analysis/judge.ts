// The one place a model is asked anything. Everything else in analysis works against this
// interface, so moving to a different model — or off Cloudflare's platform entirely — is
// a config change rather than a rewrite.
import type { Ai } from '../env.ts';
import type { Figure, JudgmentKind, Statement } from '../../shared/types.ts';
import { PROMPT_VERSION, SYSTEM_PROMPT, buildUserPrompt } from './prompt.ts';

export type Verdict = {
  kind: JudgmentKind;
  /** 0–1 confidence that the pair is what `kind` says it is. */
  score: number;
  rationale: string;
};

export type JudgeRequest = { figure: Figure; earlier: Statement; later: Statement };

export interface Judge {
  /** Recorded on every judgment: the trail is only worth something if it is specific. */
  readonly modelVersion: string;
  readonly promptVersion: string;
  judge(request: JudgeRequest): Promise<Verdict>;
}

const KINDS: JudgmentKind[] = ['contradiction', 'position-shift', 'consistent'];

/**
 * Models wrap JSON in prose, in code fences, or in an apology. Read the first object in
 * the reply and validate it; anything unreadable is a failed judgment, not a guess.
 */
export function parseVerdict(reply: string): Verdict {
  const start = reply.indexOf('{');
  const end = reply.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error(`judge replied without JSON: ${reply.slice(0, 200)}`);
  const parsed = JSON.parse(reply.slice(start, end + 1)) as Partial<Verdict>;
  if (!parsed.kind || !KINDS.includes(parsed.kind)) throw new Error(`judge replied with an unknown kind: ${parsed.kind}`);
  const score = Number(parsed.score);
  if (!Number.isFinite(score) || score < 0 || score > 1) throw new Error(`judge replied with an out-of-range score: ${parsed.score}`);
  return { kind: parsed.kind, score, rationale: String(parsed.rationale ?? '') };
}

export class WorkersAiJudge implements Judge {
  readonly modelVersion: string;
  readonly promptVersion = PROMPT_VERSION;
  #ai: Ai;

  constructor(ai: Ai, model: string) {
    this.#ai = ai;
    this.modelVersion = model;
  }

  async judge(request: JudgeRequest): Promise<Verdict> {
    const result = await this.#ai.run(this.modelVersion, {
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(request) },
      ],
    });
    return parseVerdict(result.response ?? '');
  }
}
