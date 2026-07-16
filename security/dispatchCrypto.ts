import { chacha20poly1305 } from '@noble/ciphers/chacha';
import { hkdf } from '@noble/hashes/hkdf';
import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';

const AAD = utf8ToBytes('canopy-mobile-dispatch-v1');
const AUTH_PREFIX = 'canopy-mobile-auth-v1';
const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const MAX_ENVELOPE_CHARS = 2_000_000;

function toBase64(bytes: Uint8Array): string {
  let output = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    output += BASE64[a >> 2];
    output += BASE64[((a & 3) << 4) | (b >> 4)];
    output += i + 1 < bytes.length ? BASE64[((b & 15) << 2) | (c >> 6)] : '=';
    output += i + 2 < bytes.length ? BASE64[c & 63] : '=';
  }
  return output.replace(/=+$/, '');
}

function fromBase64(value: string): Uint8Array {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length > MAX_ENVELOPE_CHARS) {
    throw new Error('Invalid encrypted payload');
  }
  const normalized = value + '='.repeat((4 - (value.length % 4)) % 4);
  const output: number[] = [];
  for (let i = 0; i < normalized.length; i += 4) {
    const indexes = [...normalized.slice(i, i + 4)].map(char => char === '=' ? 0 : BASE64.indexOf(char));
    if (indexes.some(index => index < 0)) throw new Error('Invalid encrypted payload');
    output.push((indexes[0] << 2) | (indexes[1] >> 4));
    if (normalized[i + 2] !== '=') output.push(((indexes[1] & 15) << 4) | (indexes[2] >> 2));
    if (normalized[i + 3] !== '=') output.push(((indexes[2] & 3) << 6) | indexes[3]);
  }
  return Uint8Array.from(output);
}

function nonce(direction: 'C2S' | 'S2C', counter: number): Uint8Array {
  if (!Number.isSafeInteger(counter) || counter <= 0) throw new Error('Invalid secure counter');
  const result = new Uint8Array(12);
  result.set(direction === 'C2S' ? [67, 50, 83, 0] : [83, 50, 67, 0], 0);
  let remaining = counter;
  for (let index = 11; index >= 4; index -= 1) {
    result[index] = remaining % 256;
    remaining = Math.floor(remaining / 256);
  }
  if (remaining !== 0) throw new Error('Secure counter exhausted');
  return result;
}

export function createDispatchAuth(
  token: string,
  challenge: string,
  deviceId?: string,
): { challenge: string; proof: string; deviceId?: string } {
  if (!token || !/^[a-f0-9]{64}$/i.test(challenge)) throw new Error('Invalid auth challenge');
  const message = utf8ToBytes(`${AUTH_PREFIX}\n${challenge}\n${deviceId ?? ''}`);
  return {
    challenge,
    proof: bytesToHex(hmac(sha256, utf8ToBytes(token), message)),
    ...(deviceId ? { deviceId } : {}),
  };
}

export function deriveDispatchKey(token: string, challenge: string): Uint8Array {
  return hkdf(sha256, utf8ToBytes(token), utf8ToBytes(challenge), AAD, 32);
}

interface SecureEnvelope {
  type: 'secure';
  counter: number;
  ciphertext: string;
}

export class DispatchCryptoSession {
  private readonly key: Uint8Array;
  private sendCounter = 0;
  private receiveCounter = 0;

  constructor(token: string, challenge: string) {
    this.key = deriveDispatchKey(token, challenge);
  }

  encrypt(plaintext: string): string {
    this.sendCounter += 1;
    const cipher = chacha20poly1305(this.key, nonce('C2S', this.sendCounter), AAD);
    const envelope: SecureEnvelope = {
      type: 'secure',
      counter: this.sendCounter,
      ciphertext: toBase64(cipher.encrypt(utf8ToBytes(plaintext))),
    };
    return JSON.stringify(envelope);
  }

  decrypt(envelopeJson: string): string {
    if (!envelopeJson || envelopeJson.length > MAX_ENVELOPE_CHARS) throw new Error('Invalid secure envelope');
    const envelope = JSON.parse(envelopeJson) as SecureEnvelope;
    const expectedCounter = this.receiveCounter + 1;
    if (envelope?.type !== 'secure' || envelope.counter !== expectedCounter) {
      throw new Error('Out-of-order or replayed message');
    }
    const cipher = chacha20poly1305(this.key, nonce('S2C', envelope.counter), AAD);
    const plaintext = cipher.decrypt(fromBase64(envelope.ciphertext));
    this.receiveCounter = envelope.counter;
    return new TextDecoder().decode(plaintext);
  }
}
