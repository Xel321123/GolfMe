/**
 * Unit tests — persistence & lifecycle services.
 *
 * These are the "zero data loss" acceptance tests:
 * - a snapshot written before a simulated crash is restored exactly;
 * - corrupted snapshots degrade to a clean boot (quarantine);
 * - complete-and-archive moves the round into the archive and clears the
 *   active slot; discard clears without archiving;
 * - legacy v7.1 data (localStorage + GolfTrackerDB) migrates once.
 */
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { LocalStorageAdapter } from '../../../src/storage/adapters/localStorage'
import { IndexedDBAdapter } from '../../../src/storage/adapters/indexedDb'
import { RoundPersistenceService } from '../../../src/services/persistence/RoundPersistenceService'
import { RoundLifecycleService } from '../../../src/services/round/RoundLifecycleService'
import { DB_NAME, LEGACY_DB_NAME, LEGACY_ROUNDS_STORE, LEGACY_STORAGE_KEYS, ROUNDS_STORE, STORAGE_KEYS } from '../../../src/storage/keys'
import { playFixtureRound } from '../analytics/fixtures/roundFixture'
import type { KeyValueStorage } from '../../../src/storage/types'
import { RoundStatus } from '../../../src/domain/enums/golf'

/** In-memory KeyValueStorage fake (mirrors window.localStorage). */
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

function createServices(fake: KeyValueStorage) {
  const activeAdapter = new LocalStorageAdapter(fake)
  const archiveAdapter = new IndexedDBAdapter(indexedDB, DB_NAME, ROUNDS_STORE)
  const persistence = new RoundPersistenceService({ activeAdapter, archiveAdapter, idbFactory: indexedDB })
  const lifecycle = new RoundLifecycleService(persistence)
  return { persistence, lifecycle, activeAdapter }
}

// fake-indexeddb keeps state across tests in the same file; reset both the
// application DB and the legacy DB so tests are hermetic.
beforeEach(async () => {
  await new IndexedDBAdapter(indexedDB, DB_NAME, ROUNDS_STORE).clear(ROUNDS_STORE)
  await new IndexedDBAdapter(indexedDB, LEGACY_DB_NAME, LEGACY_ROUNDS_STORE).clear(LEGACY_ROUNDS_STORE)
})

describe('round persistence — crash recovery', () => {
  it('restores the exact session state after a simulated crash/reload', async () => {
    const fake = createFakeStorage()
    const { persistence } = createServices(fake)

    // Simulate a session in progress before the "crash".
    const session = playFixtureRound()
    await persistence.persistActiveRound(session)

    // Fresh service instances = fresh boot (same underlying storage).
    const { lifecycle: freshLifecycle } = createServices(fake)
    const restored = await freshLifecycle.resumeActiveRound()

    expect(restored).not.toBeNull()
    expect(restored!.currentHole).toBe(session.currentHole)
    expect(restored!.activeStep).toBe(session.activeStep)
    expect(restored!.round.shots).toEqual(session.round.shots)
    expect(restored!.round.holes).toEqual(session.round.holes)
    expect(restored!.selections).toEqual(session.selections)
  })

  it('auto-save writes survive without an explicit flush (every mutation persisted)', async () => {
    const fake = createFakeStorage()
    const { persistence } = createServices(fake)
    const session = playFixtureRound()
    await persistence.persistActiveRound(session)

    const raw = await persistence.hydrateActiveRound()
    expect(raw?.round.shots).toHaveLength(11)
  })

  it('boots cleanly when the snapshot is corrupted (quarantine, no crash)', async () => {
    const fake = createFakeStorage()
    const { lifecycle } = createServices(fake)

    // Write garbage into the active-round slot.
    fake.setItem(STORAGE_KEYS.activeRound, '{{{corrupted')

    const restored = await lifecycle.resumeActiveRound()
    expect(restored).toBeNull()
    // The corrupt payload must have been moved aside, not silently kept.
    expect(fake.getItem('golfme.corrupt.' + STORAGE_KEYS.activeRound)).not.toBeNull()
  })

  it('quarantines snapshots that fail schema validation', async () => {
    const fake = createFakeStorage()
    const { persistence } = createServices(fake)
    fake.setItem(
      STORAGE_KEYS.activeRound,
      JSON.stringify({ schemaVersion: 2, kind: 'activeRound', payload: { not: 'a round' } })
    )
    expect(await persistence.hydrateActiveRound()).toBeNull()
    expect(fake.getItem('golfme.corrupt.' + STORAGE_KEYS.activeRound)).not.toBeNull()
  })
})

describe('round lifecycle actions', () => {
  it('completeAndArchiveRound finalizes, archives, and clears the active slot', async () => {
    const fake = createFakeStorage()
    const { persistence, lifecycle } = createServices(fake)
    const session = playFixtureRound()

    await lifecycle.saveActiveRound(session)
    const archived = await lifecycle.completeAndArchiveRound(session)

    expect(archived.status).toBe(RoundStatus.COMPLETED)
    expect(archived.completedAt).toBeDefined()
    expect(archived.holes.every((h) => h.status === 'COMPLETED')).toBe(true)

    // Active slot cleared; archived round present in the store.
    expect(await persistence.hydrateActiveRound()).toBeNull()
    const rounds = await persistence.listArchivedRounds()
    expect(rounds).toHaveLength(1)
    expect(rounds[0]?.id).toBe(archived.id)
  })

  it('discardRound clears the active slot without archiving', async () => {
    const fake = createFakeStorage()
    const { persistence, lifecycle } = createServices(fake)
    await lifecycle.saveActiveRound(playFixtureRound())

    await lifecycle.discardRound()
    expect(await persistence.hydrateActiveRound()).toBeNull()
    expect(await persistence.listArchivedRounds()).toHaveLength(0)
  })

  it('startNewRound persists a fresh session immediately', async () => {
    const fake = createFakeStorage()
    const { lifecycle } = createServices(fake)
    const state = await lifecycle.startNewRound({ courseName: 'Fresh GC', playerName: 'Me' })
    expect(state.round.courseName).toBe('Fresh GC')
    expect(state.round.players[0]?.name).toBe('Me')
    expect(state.currentHole).toBe(1)
  })

  it('archives can be deleted and replaced (backup import path)', async () => {
    const fake = createFakeStorage()
    const { persistence, lifecycle } = createServices(fake)
    const a = await lifecycle.completeAndArchiveRound(playFixtureRound())

    await persistence.deleteArchivedRound(a.id)
    expect(await persistence.listArchivedRounds()).toHaveLength(0)

    const b = await lifecycle.completeAndArchiveRound(playFixtureRound())
    await persistence.replaceAllArchivedRounds([a, b])
    expect(await persistence.listArchivedRounds()).toHaveLength(2)
  })
})

describe('legacy v7.1 migration', () => {
  it('migrates the legacy active round (golf_v7_shots) exactly once', async () => {
    const legacyShots = [
      { hole: 1, par: 4, shotNum: 1, club: 'D', result: 'Fairway', startLat: 59.3, startLon: 18.0 },
      { hole: 1, par: 4, shotNum: 2, club: 'PLIKT (OoB)', quality: 'Plikt' },
      { hole: 1, par: 4, shotNum: 3, club: 'PW', result: 'Green' },
      { hole: 1, par: 4, shotNum: 4, club: 'Putter', putts: 2, puttDist: '<2m' },
    ]
    const fake = createFakeStorage({
      [LEGACY_STORAGE_KEYS.shots]: JSON.stringify(legacyShots),
      [LEGACY_STORAGE_KEYS.pars]: JSON.stringify({ 1: 4 }),
      [LEGACY_STORAGE_KEYS.courseName]: 'Old Course',
    })
    const { persistence } = createServices(fake)

    expect(await persistence.migrateLegacyIfNeeded()).toBe(true)
    const restored = await persistence.hydrateActiveRound()
    expect(restored).not.toBeNull()
    expect(restored!.round.courseName).toBe('Old Course')
    // 3 non-putt shots (D + OoB penalty + PW) + 2 putts = 5 strokes on hole 1.
    expect(restored!.round.holes[0]?.strokes).toBe(5)
    expect(restored!.round.holes[0]?.greenInRegulation).toBe(false) // PW landed on green on stroke 3 > limit 2

    // Idempotency: a second run must not double-migrate or crash.
    expect(await persistence.migrateLegacyIfNeeded()).toBe(false)
    expect((await persistence.hydrateActiveRound())!.round.shots).toHaveLength(4)
  })

  it('migrates legacy archived rounds from GolfTrackerDB', async () => {
    const fake = createFakeStorage()
    const { persistence } = createServices(fake)

    // Seed the legacy database with one archived round.
    const legacyDb = new IndexedDBAdapter(indexedDB, LEGACY_DB_NAME, 'rounds')
    await legacyDb.write('777', {
      id: 777,
      date: '2025-07-01',
      course: 'Legacy GC',
      pars: { 1: 4 },
      data: [
        { hole: 1, par: 4, shotNum: 1, club: 'D', result: 'Fairway' },
        { hole: 1, par: 4, shotNum: 2, club: '9i', result: 'Green' },
        { hole: 1, par: 4, shotNum: 3, club: 'Putter', putts: 2 },
      ],
    })

    expect(await persistence.migrateLegacyIfNeeded()).toBe(true)
    const archived = await persistence.listArchivedRounds()
    expect(archived).toHaveLength(1)
    expect(archived[0]?.id).toBe('777')
    expect(archived[0]?.courseName).toBe('Legacy GC')
    expect(archived[0]?.holes[0]?.strokes).toBe(4)
  })

  it('migrates the minimal tracker (golf_shots) when no v7 data exists', async () => {
    const fake = createFakeStorage({
      [LEGACY_STORAGE_KEYS.minimalShots]: JSON.stringify([
        { hole: 1, shotNum: 1, club: 'D', lat: 59.3, lon: 18.0 },
        { hole: 1, shotNum: 2, putts: 2 },
      ]),
    })
    const { persistence } = createServices(fake)
    expect(await persistence.migrateLegacyIfNeeded()).toBe(true)
    const restored = await persistence.hydrateActiveRound()
    expect(restored?.round.holes[0]?.strokes).toBe(3) // 1 swing + 2 putts
  })
})
