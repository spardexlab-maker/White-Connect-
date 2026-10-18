import * as Crypto from 'expo-crypto';

/** A fresh key per user intent; reused on retry of the same intent. */
export function newIdempotencyKey(scope: string): string {
  return `${scope}:${Crypto.randomUUID()}`;
}
