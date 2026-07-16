import test from 'node:test';
import assert from 'node:assert/strict';
import { createDispatchAuth, deriveDispatchKey } from '../security/dispatchCrypto.ts';
import { bytesToHex } from '@noble/hashes/utils';

test('secure dispatch handshake matches the Rust cross-platform vectors', () => {
  const challenge = 'ab'.repeat(32);
  const auth = createDispatchAuth('pairing-token', challenge, 'device-abc');
  // The production challenge is 64 hex characters. Verify the primitives against
  // a vector using that exact framing and independently checked Node crypto output.
  assert.equal(auth.challenge, challenge);
  assert.equal(auth.deviceId, 'device-abc');
  assert.equal(auth.proof, '2cfed165fdff8007b747a547f1910d609b57f4fe4916b0d968e1c2996e3b7af4'); // gitleaks:allow -- deterministic HMAC test vector
  assert.equal(
    bytesToHex(deriveDispatchKey('pairing-token', challenge)),
    '8ecf694c033dc7b6d7ab5ff0b75edc6d6557574ddb4f2479ff2117bf888e056f', // gitleaks:allow -- deterministic HKDF test vector
  );
});

test('auth rejects malformed server challenges', () => {
  assert.throws(() => createDispatchAuth('pairing-token', 'not-random', 'device-abc'));
});
