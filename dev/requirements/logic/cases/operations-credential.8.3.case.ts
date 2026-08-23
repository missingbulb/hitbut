import assert from 'node:assert/strict';
import type { Case } from '../../registry.ts';
import { admit } from '../../../../src/backend/api/operations.ts';
import type { Env } from '../../../../src/backend/env.ts';

const TOKEN = 'a-long-enough-operator-token';
const configured = { DASHBOARD_TOKEN: TOKEN } as Env;
const asking = (authorization?: string) =>
  new Request('https://hitbut.test/api/v1/operations', { headers: authorization ? { authorization } : {} });

export default {
  title: 'the operations credential admits the configured token and nothing else',
  run() {
    assert.equal(admit(asking(`Bearer ${TOKEN}`), configured).admitted, true);

    const refused = (authorization?: string) => {
      const admission = admit(asking(authorization), configured);
      assert.equal(admission.admitted, false, `${authorization ?? '(no header)'} was admitted`);
      if (!admission.admitted) assert.equal(admission.status, 401);
    };

    refused();
    refused('Bearer');
    refused(`Bearer ${TOKEN}x`);
    // A prefix of the real token. This is the one a length check alone catches and a
    // character-by-character compare that stops at the first difference does not — and
    // it is the shape an attacker guessing a secret one character at a time produces.
    refused(`Bearer ${TOKEN.slice(0, 6)}`);
    // One character out, right length: the comparison must not pass on a prefix, and must
    // not answer faster for a token that is nearly right.
    refused(`Bearer ${TOKEN.slice(0, -1)}X`);
    // The right secret in the wrong scheme is not a credential.
    refused(TOKEN);
    refused(`Basic ${TOKEN}`);
  },
} satisfies Case<void>;
