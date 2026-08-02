/**
 * IDs are generated on the client so IndexedDB and Postgres share them —
 * that is what makes upsert-based sync idempotent. docs/06 §6.
 */
export function newId(): string {
  return crypto.randomUUID()
}
