/**
 * Storage abstraction — the seam that makes the persistence layer portable.
 *
 * Every concrete adapter (localStorage, IndexedDB, and — after the mobile
 * migration — AsyncStorage/MMKV) implements this interface. Domain and
 * service code depends only on this contract, so swapping the underlying
 * storage engine requires zero changes to business logic.
 */
import { z } from 'zod'

/** Versioned envelope wrapping every persisted payload. */
export interface VersionedEnvelope<T = unknown> {
  /** Schema version of the payload (bumped on breaking shape changes). */
  schemaVersion: number
  /** Discriminator describing what the payload is (e.g. `'activeRound'`). */
  kind: string
  /** The actual domain payload. */
  payload: T
}

/** Shape-compatible subset of the web `Storage` API (for test fakes). */
export interface KeyValueStorage {
  readonly length: number
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  key(index: number): string | null
}

/**
 * Minimal storage contract used by the whole application.
 *
 * All operations are asynchronous (Promise-based) even when the underlying
 * engine is synchronous (localStorage), so adapters for async engines such
 * as IndexedDB or React Native AsyncStorage/MMKV plug in transparently.
 */
export interface StorageAdapter {
  /** Human-readable engine name for diagnostics, e.g. `'localStorage'`. */
  readonly name: string

  /** Whether the underlying engine can be used in this runtime. */
  isAvailable(): boolean

  /**
   * Reads and JSON-parses a value.
   * @param key - Storage key (or entity id for store-style adapters).
   * @returns The parsed value, or `null` when missing or unparseable.
   */
  read(key: string): Promise<unknown | null>

  /**
   * Reads the raw (unparsed) string value. Used by the migration layer,
   * where legacy apps stored some keys as plain strings rather than JSON.
   * @param key - Storage key.
   * @returns The raw string, or `null` when the key is missing.
   */
  readRaw(key: string): Promise<string | null>

  /**
   * Serializes and writes a value.
   * @param key - Storage key (or entity id for store-style adapters).
   * @param value - Any JSON-serializable value.
   */
  write(key: string, value: unknown): Promise<void>

  /** Removes a single value. */
  delete(key: string): Promise<void>

  /**
   * Lists all values in a logical store.
   * @param storeName - Store/prefix identifier (adapter-specific).
   * @returns All stored values in the store.
   */
  list(storeName: string): Promise<unknown[]>

  /** Removes every value in a logical store. */
  clear(storeName: string): Promise<void>
}

/**
 * Reads a value through an adapter, parses it as JSON, and validates it
 * against a zod schema. On any failure (missing key, malformed JSON, schema
 * mismatch) the raw payload is quarantined and `null` is returned, so a
 * corrupted cache degrades to a clean boot instead of crashing the app.
 *
 * @param adapter - Storage engine to read from.
 * @param key - Key to read.
 * @param schema - Zod schema the payload must satisfy.
 * @returns The validated payload, or `null` when unreadable/invalid.
 */
export async function readValidated<T>(
  adapter: StorageAdapter,
  key: string,
  schema: z.ZodType<T>
): Promise<T | null> {
  let raw: unknown
  try {
    raw = await adapter.read(key)
  } catch (error) {
    await quarantine(adapter, key, undefined, `Unreadable payload: ${error instanceof Error ? error.message : String(error)}`)
    return null
  }
  if (raw === null) return null

  const result = schema.safeParse(raw)
  if (result.success) return result.data

  // Quarantine the corrupt payload so it can be inspected later instead of
  // being silently destroyed or repeatedly re-parsed on every boot.
  try {
    await adapter.write(`${QUARANTINE_PREFIX}.${key}`, {
      quarantinedAt: new Date().toISOString(),
      reason: result.error.issues.map((i) => i.message).join('; '),
      raw,
    })
    await adapter.delete(key)
  } catch {
    // Quarantine is best-effort; never let a storage failure crash boot.
  }
  return null
}

/** Key prefix for payloads that failed validation. */
export const QUARANTINE_PREFIX = 'golfme.corrupt'

/** Loose shape of the versioned envelope, validated before payload parsing. */
const envelopeShape = z.object({
  schemaVersion: z.number().int().nonnegative(),
  kind: z.string().min(1),
  payload: z.unknown(),
})

/**
 * Reads a value wrapped in a {@link VersionedEnvelope}, validates the payload
 * against a zod schema, and quarantines the raw value on any failure.
 *
 * @param adapter - Storage engine to read from.
 * @param key - Key to read.
 * @param schema - Zod schema the payload must satisfy.
 * @param expectedKind - Envelope kind the payload must declare.
 * @returns The validated payload, or `null` when unreadable/invalid.
 */
export async function readValidatedEnvelope<T>(
  adapter: StorageAdapter,
  key: string,
  schema: z.ZodType<T>,
  expectedKind: string
): Promise<T | null> {
  let raw: unknown
  try {
    raw = await adapter.read(key)
  } catch (error) {
    await quarantine(adapter, key, undefined, `Unreadable payload: ${error instanceof Error ? error.message : String(error)}`)
    return null
  }
  if (raw === null) return null

  const parsedEnvelope = envelopeShape.safeParse(raw)
  if (!parsedEnvelope.success) {
    await quarantine(adapter, key, raw, 'Malformed envelope')
    return null
  }
  if (parsedEnvelope.data.kind !== expectedKind || parsedEnvelope.data.schemaVersion !== 2) {
    await quarantine(adapter, key, raw, `Unexpected kind/version: ${parsedEnvelope.data.kind}@${parsedEnvelope.data.schemaVersion}`)
    return null
  }

  const result = schema.safeParse(parsedEnvelope.data.payload)
  if (result.success) return result.data

  await quarantine(adapter, key, raw, result.error.issues.map((i) => i.message).join('; '))
  return null
}

/**
 * Moves a corrupt payload to the quarantine bucket and removes the original,
 * so a poisoned key cannot crash every subsequent boot.
 */
async function quarantine(adapter: StorageAdapter, key: string, raw: unknown, reason: string): Promise<void> {
  try {
    await adapter.write(`${QUARANTINE_PREFIX}.${key}`, {
      quarantinedAt: new Date().toISOString(),
      reason,
      raw,
    })
    await adapter.delete(key)
  } catch {
    // Quarantine is best-effort; never let a storage failure crash boot.
  }
}
