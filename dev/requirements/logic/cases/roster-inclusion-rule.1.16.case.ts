import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { readRoster, faultsIn, type RosterEntry } from '../../../../src/backend/corpus/roster.ts';
import { ROSTER } from '../../../../src/backend/corpus/roster-data.ts';

const COMPLETE: RosterEntry = {
  id: 'דמות-לדוגמה',
  displayName: 'דמות לדוגמה',
  role: 'חברת הכנסת (דמות לדוגמה)',
  aliases: [],
  qualifies: 'דמות לדוגמה: נבחרת ציבור מכהנת.',
  coverage: [{ sourceModule: 'sample-protocols', from: '2023-01-01' }],
  status: 'active',
};

export default {
  title: 'a roster entry states what put its person on the roster, or it is refused',
  async run() {
    assert.deepEqual(faultsIn(COMPLETE, 0), [], 'a complete entry has nothing to answer for');

    // The field that carries the defensibility. An entry without it is the difference
    // between a roster and a list of people somebody decided to scrutinise.
    const { qualifies: _dropped, ...withoutRule } = COMPLETE;
    const faults = faultsIn(withoutRule, 0);
    assert.equal(faults.length, 1);
    assert.match(faults[0] as string, /qualifies is required/);

    // Whitespace is not a reason, either.
    assert.equal(faultsIn({ ...COMPLETE, qualifies: '   ' }, 0).length, 1);

    // The whole file is refused rather than the bad entry, because a roster half loaded is
    // a roster that has silently stopped tracking somebody.
    assert.throws(
      () => readRoster({ entries: [COMPLETE, withoutRule] }),
      /qualifies is required/,
      'one unusable entry takes the file with it',
    );

    // Two entries cannot claim one id: an id is a citation and cannot mean two people.
    assert.throws(() => readRoster({ entries: [COMPLETE, { ...COMPLETE, displayName: 'אחרת' }] }), /appears more than once/);

    // And a bare array is not the file's shape — the wrapper is what carries its warning.
    assert.throws(() => readRoster([COMPLETE]), /entries/);

    // The committed roster itself passes: this leaf is only worth anything if the file the
    // product actually reads is one the rule admits.
    assert.ok(ROSTER.length > 0, 'the committed roster loaded');
    for (const [index, entry] of ROSTER.entries()) assert.deepEqual(faultsIn(entry, index), []);
  },
} satisfies Case<void>;
