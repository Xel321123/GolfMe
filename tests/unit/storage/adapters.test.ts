/**
 * Unit tests — storage adapters (memory, localStorage with fake storage,
 * IndexedDB with fake-indexeddb).
 */
import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { LocalStorageAdapter } from '../../../src/storage/adapters/localStorage'
import { IndexedDBAdapter } from '../../../src/storage/adapters/indexedDb'
import { MemoryAdapter } from '../../../src/storage/adapters/memory'
import type { KeyValueStorage } from '../../../src/storage/types'

/** Minimal in-memory KeyValueStorage fake matching the web Storage API. */
function createFakeStorage(initial: Record<string, string> = {}): KeyValueStorage {
  const data = new Map(Object.entries(initial))
  return {
    get length() {
      return data.size
    },
    getItem(key) {
      return data.has(key) ? data.get(key)! : null
    },
    setItem(key, value) {
      data.set(key, value)
    },
    removeItem(key) {
      data.delete(key)
    },
    key(index) {
      return [...data.keys()][index] ?? null
    },
  }
}

describe('MemoryAdapter', () => {
  it('round-trips values and lists by store prefix', async () => {
    const adapter = new MemoryAdapter()
    expect(await adapter.read('a')).toBeNull()
    await adapter.write('rounds.1', { id: 1 })
    await adapter.write('rounds.2', { id: 2 })
    await adapter.write('other', 42)
    expect(await adapter.read('rounds.1')).toEqual({ id: 1 })
    expect(await adapter.list('rounds')).toHaveLength(2)
    await adapter.clear('rounds')
    expect(await adapter.list('rounds')).toHaveLength(0)
    expect(await adapter.read('other')).toBe(42)
  })
})

describe('LocalStorageAdapter', () => {
  it('serializes and deserializes through the injected storage', async () => {
    const fake = createFakeStorage()
    const adapter = new LocalStorageAdapter(fake)
    await adapter.write('k', { nested: [1, 2, 3] })
    expect(await adapter.read('k')).toEqual({ nested: [1, 2, 3] })
    await adapter.delete('k')
    expect(await adapter.read('k')).toBeNull()
  })

  it('throws on unparseable JSON so the quarantine layer can act', async () => {
    const fake = createFakeStorage({ broken: '{not json' })
    const adapter = new LocalStorageAdapter(fake)
    await expect(adapter.read('broken')).rejects.toThrow(/Corrupt payload/)
  })

  it('honours the key prefix and reports availability', async () => {
    const fake = createFakeStorage()
    const adapter = new LocalStorageAdapter(fake, 'gm.')
    await adapter.write('x', 1)
    expect(fake.getItem('gm.x')).toBe('1')
    expect(await adapter.read('x')).toBe(1)
    expect(adapter.isAvailable()).toBe(true)
  })
})

describe('IndexedDBAdapter', () => {
  it('creates the object store on demand and round-trips entities', async () => {
    const adapter = new IndexedDBAdapter(indexedDB, 'TestDB', 'rounds')
    await adapter.write('r1', { courseName: 'A', shots: [] })
    await adapter.write('r2', { courseName: 'B', shots: [] })
    expect(await adapter.read('r1')).toMatchObject({ id: 'r1', courseName: 'A' })
    const all = await adapter.list('rounds')
    expect(all).toHaveLength(2)
    await adapter.delete('r1')
    expect(await adapter.read('r1')).toBeNull()
    await adapter.clear('rounds')
    expect(await adapter.list('rounds')).toHaveLength(0)
  })
})
