/** A fresh key per user intent; reused on retry of the same intent. */
export function newIdempotencyKey(scope: string): string {
  const rand = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${scope}:${rand}`;
}
