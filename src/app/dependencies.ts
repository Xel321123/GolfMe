/**
 * Composition root — wires concrete platform implementations into the
 * framework-agnostic services.
 *
 * This is the ONLY place where browser globals meet the core. When migrating
 * to React Native, this file is replaced by an equivalent that injects
 * AsyncStorage/MMKV adapters and the native geolocation provider; nothing in
 * `src/domain`, `src/services`, `src/storage` or `src/analytics` changes.
 */
import { LocalStorageAdapter } from '../storage/adapters/localStorage'
import { IndexedDBAdapter } from '../storage/adapters/indexedDb'
import { DB_NAME, ROUNDS_STORE } from '../storage/keys'
import { RoundPersistenceService } from '../services/persistence/RoundPersistenceService'
import { RoundLifecycleService } from '../services/round/RoundLifecycleService'
import { browserGeolocationProvider } from '../lib/browserGeolocation'
import type { GeolocationProvider } from '../services/geolocation/types'

/** Fully wired application services for the web platform. */
export interface AppServices {
  persistence: RoundPersistenceService
  lifecycle: RoundLifecycleService
  geolocation: GeolocationProvider
}

/**
 * Builds the service graph for the current runtime.
 *
 * @returns Wired services, or `null` when localStorage is unavailable
 *          (e.g. private-mode browsers that block storage entirely).
 */
export function createAppServices(): AppServices | null {
  const storage = window.localStorage
  const idbFactory = window.indexedDB

  if (storage === null || storage === undefined) {
    return null
  }

  const activeAdapter = new LocalStorageAdapter(storage)
  const archiveAdapter = new IndexedDBAdapter(idbFactory, DB_NAME, ROUNDS_STORE)
  const persistence = new RoundPersistenceService({
    activeAdapter,
    archiveAdapter,
    idbFactory,
  })
  const lifecycle = new RoundLifecycleService(persistence)

  return { persistence, lifecycle, geolocation: browserGeolocationProvider }
}
