// The behavior lane: a driven action and what it did to the world, asserted against the
// fakes' recordings. The fakes stand in for the platform and for the model — never for our
// own code, which is the shipped code in every one of these.
import test from 'node:test';
import { loadCase, readCases } from '../registry.ts';

for (const caseFile of readCases('behavior')) {
  const behaviorCase = await loadCase<void>(caseFile);
  test(`${caseFile.id} — ${behaviorCase.title}`, async () => {
    await behaviorCase.run(undefined as void);
  });
}
