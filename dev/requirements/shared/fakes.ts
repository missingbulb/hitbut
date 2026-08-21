// Stand-ins for the platform and for the model. Each one *records* what the product asked
// it for, because that recording is what a behavior case asserts against — the point is
// never that the fake worked, it is what our code did with it.
import type { AnalysisMessage, Ai, Queue, R2Bucket, R2Object } from '../../../src/backend/env.ts';
import type { Judge, JudgeRequest, Verdict } from '../../../src/backend/analysis/judge.ts';

/**
 * The raw payload cache. `log` can be shared with other fakes so a case can assert the
 * *order* two things happened in — which is the whole of "raw before parse".
 */
export class FakeR2 implements R2Bucket {
  objects = new Map<string, string>();
  log: string[];

  constructor(log: string[] = []) {
    this.log = log;
  }

  async put(key: string, value: string | ArrayBuffer): Promise<unknown> {
    this.log.push(`put ${key}`);
    this.objects.set(key, String(value));
    return {};
  }

  async get(key: string): Promise<R2Object | null> {
    const stored = this.objects.get(key);
    return stored === undefined ? null : { text: async () => stored };
  }

  async head(key: string): Promise<unknown | null> {
    return this.objects.has(key) ? {} : null;
  }
}

export class FakeQueue implements Queue<AnalysisMessage> {
  sent: AnalysisMessage[] = [];

  async send(message: AnalysisMessage): Promise<void> {
    this.sent.push(message);
  }
}

/** A judge whose answers a case decides, so analysis is tested without a model in it. */
export class ScriptedJudge implements Judge {
  readonly modelVersion: string;
  readonly promptVersion: string;
  asked: JudgeRequest[] = [];
  #answer: (request: JudgeRequest) => Verdict;

  constructor(answer: (request: JudgeRequest) => Verdict, versions: { model?: string; prompt?: string } = {}) {
    this.#answer = answer;
    this.modelVersion = versions.model ?? 'scripted/v1';
    this.promptVersion = versions.prompt ?? 'inconsistency/v1';
  }

  async judge(request: JudgeRequest): Promise<Verdict> {
    this.asked.push(request);
    return this.#answer(request);
  }
}

/** Workers AI, answering whatever the case put in its mouth. */
export class FakeAi implements Ai {
  calls: { model: string; input: unknown }[] = [];
  #reply: string;

  constructor(reply: string) {
    this.#reply = reply;
  }

  async run(model: string, input: unknown): Promise<{ response?: string }> {
    this.calls.push({ model, input });
    return { response: this.#reply };
  }
}

export type ScriptedResponse = { status: number; body: string } | Error;

/**
 * An HTTP surface the case writes out in advance, plus the record of what was asked for —
 * so "did it retry?" and "how many times?" are assertions rather than guesses.
 */
export function scriptedFetch(responses: ScriptedResponse[]) {
  const calls: string[] = [];
  const waits: number[] = [];
  let index = 0;
  return {
    calls,
    waits,
    deps: {
      fetch: async (url: string) => {
        calls.push(url);
        const next = responses[Math.min(index++, responses.length - 1)];
        if (next instanceof Error) throw next;
        return { status: next.status, text: async () => next.body };
      },
      // Records the backoff instead of serving it: the retry path is exercised, the test
      // does not sleep through it.
      sleep: async (milliseconds: number) => {
        waits.push(milliseconds);
      },
      random: () => 0.5,
    },
  };
}

/** The same, but keyed by URL — for a run over several documents. */
export function servingFetch(routes: Record<string, ScriptedResponse>) {
  const calls: string[] = [];
  return {
    calls,
    deps: {
      fetch: async (url: string) => {
        calls.push(url);
        const response = routes[url] ?? { status: 404, body: 'not found' };
        if (response instanceof Error) throw response;
        return { status: response.status, text: async () => response.body };
      },
      sleep: async () => {},
      random: () => 0.5,
    },
  };
}

/** A fetcher that fails the test if anything reaches for the network. */
export const forbiddenFetch = {
  fetch: async (url: string): Promise<never> => {
    throw new Error(`the network was used for ${url}, and this path must not need it`);
  },
};
