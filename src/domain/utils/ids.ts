/**
 * Identifier generation.
 *
 * Uses a timestamp + random-suffix composition instead of `crypto.randomUUID`
 * so the domain core remains usable in every target runtime (browsers, Node,
 * React Native/Hermes) without relying on platform-specific crypto globals.
 */

/**
 * Generates a reasonably unique, sortable identifier string.
 *
 * The timestamp prefix keeps IDs roughly time-ordered (useful for round
 * history lists), while the random suffix guards against collisions when
 * several entities are created within the same millisecond.
 *
 * @returns A non-empty string identifier, e.g. `k3f2a9x7c1m0a8b2`.
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}
