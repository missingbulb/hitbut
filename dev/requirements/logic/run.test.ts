// The logic lane: pure product rules, asserted against the shipped code directly. Fast,
// deterministic, no platform in the way — this is the lane the inner loop runs.
import test from 'node:test';
import { loadCase, readCases } from '../registry.ts';

for (const caseFile of readCases('logic')) {
  const logicCase = await loadCase<void>(caseFile);
  test(`${caseFile.id} — ${logicCase.title}`, async () => {
    await logicCase.run(undefined as void);
  });
}
