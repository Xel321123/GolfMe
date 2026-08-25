/**
 * In-memory StorageAdapter implementation.
 *
 * Primary use: unit tests and the "new round" happy path in runtimes without
 * any persistent engine. Data is lost on process exit by design.
 */
import type { StorageAdapter } from '../types'

export class MemoryAdapter implements StorageAdapter {
  readonly name = 'memory'

  private readonly data = new Map<string, unknown>()

  isAvailable(): boolean {
    return true
  }

  async read(key: string): Promise<unknown | null> {
    return this.data.has(key) ? this.data.get(key)! : null
  }

  async readRaw(key: string): Promise<string | null> {
    return this.data.has(key) ? JSON.stringify(this.data.get(key)) : null
  }

  async write(key: string, value: unknown): Promise<void> {
    this.data.set(key, value)
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key)
  }

  async list(storeName: string): Promise<unknown[]> {
    const values: unknown[] = []
    for (const [key, value] of this.data) {
      if (key.startsWith(storeName)) values.push(value)
    }
    return values
  }

  async clear(storeName: string): Promise<void> {
    for (const key of [...this.data.keys()]) {
      if (key.startsWith(storeName)) this.data.delete(key)
    }
  }
}
