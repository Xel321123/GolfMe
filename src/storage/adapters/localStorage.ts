/**
 * localStorage-backed StorageAdapter.
 *
 * The underlying `KeyValueStorage` (normally `window.localStorage`) is
 * injected rather than imported so that (a) unit tests can supply a fake and
 * (b) the module itself never references the browser global — the React
 * Native migration can swap this constructor argument for an AsyncStorage
 * bridge without touching call sites.
 */
import type { KeyValueStorage, StorageAdapter } from '../types'

export class LocalStorageAdapter implements StorageAdapter {
  readonly name = 'localStorage'

  /**
   * @param storage - The key-value engine to wrap (usually `localStorage`).
   * @param keyPrefix - Optional prefix prepended to every key (namespacing).
   */
  constructor(
    private readonly storage: KeyValueStorage,
    private readonly keyPrefix = ''
  ) {}

  isAvailable(): boolean {
    try {
      const probe = `${this.keyPrefix}__probe__`
      this.storage.setItem(probe, '1')
      this.storage.removeItem(probe)
      return true
    } catch {
      // Throws when storage is disabled (private mode, quota 0, sandboxed
      // iframes). Treat as unavailable rather than crashing.
      return false
    }
  }

  private fullKey(key: string): string {
    return `${this.keyPrefix}${key}`
  }

  async read(key: string): Promise<unknown | null> {
    const raw = this.storage.getItem(this.fullKey(key))
    if (raw === null) return null
    try {
      return JSON.parse(raw) as unknown
    } catch {
      // Surface parse failures so the validation/quarantine layer can move
      // the corrupt payload aside instead of silently ignoring it (a poison
      // value must not survive every boot).
      throw new Error(`Corrupt payload at key "${this.fullKey(key)}": not valid JSON.`)
    }
  }

  async readRaw(key: string): Promise<string | null> {
    return this.storage.getItem(this.fullKey(key))
  }

  async write(key: string, value: unknown): Promise<void> {
    this.storage.setItem(this.fullKey(key), JSON.stringify(value))
  }

  async delete(key: string): Promise<void> {
    this.storage.removeItem(this.fullKey(key))
  }

  async list(storeName: string): Promise<unknown[]> {
    const values: unknown[] = []
    for (let i = 0; i < this.storage.length; i += 1) {
      const rawKey = this.storage.key(i)
      if (rawKey === null) continue
      if (!rawKey.startsWith(`${this.keyPrefix}${storeName}`)) continue
      const raw = this.storage.getItem(rawKey)
      if (raw === null) continue
      try {
        values.push(JSON.parse(raw) as unknown)
      } catch {
        // Skip malformed entries during enumeration.
      }
    }
    return values
  }

  async clear(storeName: string): Promise<void> {
    const doomed: string[] = []
    for (let i = 0; i < this.storage.length; i += 1) {
      const rawKey = this.storage.key(i)
      if (rawKey === null) continue
      if (rawKey.startsWith(`${this.keyPrefix}${storeName}`)) doomed.push(rawKey)
    }
    for (const key of doomed) this.storage.removeItem(key)
  }
}
