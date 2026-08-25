/**
 * IndexedDB-backed StorageAdapter for entity stores.
 *
 * Used for the archived-rounds store. Entities are keyed by their own `id`
 * field (`keyPath: 'id'`), matching how the legacy app stored rounds — which
 * lets the migration read the old `GolfTrackerDB` through the exact same
 * adapter class.
 *
 * The `IDBFactory` is injected for testability (`fake-indexeddb` in tests).
 */
import type { StorageAdapter } from '../types'

/** Wraps an IndexedDB request in a Promise, rejecting on `onerror`/`onblocked`. */
function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

export class IndexedDBAdapter implements StorageAdapter {
  readonly name = 'indexedDB'

  /**
   * @param idb - The IndexedDB factory (usually `indexedDB`).
   * @param dbName - Database name.
   * @param storeName - Object store holding the entities.
   * @param version - Database schema version.
   */
  constructor(
    private readonly idb: IDBFactory,
    private readonly dbName: string,
    private readonly storeName: string,
    private readonly version = 1
  ) {}

  isAvailable(): boolean {
    return typeof this.idb !== 'undefined'
  }

  /** Opens the database, creating the object store on first run. */
  private openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = this.idb.open(this.dbName, this.version)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id' })
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
      request.onblocked = () => reject(new Error(`IndexedDB blocked (${this.dbName})`))
    })
  }

  private async withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.openDb()
    try {
      const transaction = db.transaction(this.storeName, mode)
      return await requestToPromise(fn(transaction.objectStore(this.storeName)))
    } finally {
      db.close()
    }
  }

  async read(key: string): Promise<unknown | null> {
    const value = await this.withStore('readonly', (store) => store.get(key))
    return (value as unknown) ?? null
  }

  async readRaw(key: string): Promise<string | null> {
    const value = await this.withStore('readonly', (store) => store.get(key))
    return value === undefined ? null : JSON.stringify(value)
  }

  async write(key: string, value: unknown): Promise<void> {
    // Store entities are keyed by `id`; force the key into the payload so the
    // keyPath constraint is satisfied even when callers omit it.
    const entity = { id: key, ...(value as Record<string, unknown>) }
    await this.withStore('readwrite', (store) => store.put(entity))
  }

  async delete(key: string): Promise<void> {
    await this.withStore('readwrite', (store) => store.delete(key))
  }

  async list(_storeName: string): Promise<unknown[]> {
    return this.withStore('readonly', (store) => store.getAll())
  }

  async clear(_storeName: string): Promise<void> {
    await this.withStore('readwrite', (store) => store.clear())
  }
}
