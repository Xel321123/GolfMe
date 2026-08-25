/**
 * Round persistence service — the only module that knows how round data
 * moves in and out of storage.
 *
 * Responsibilities:
 * - Hydrate/persist/clear the active round snapshot (versioned envelope).
 * - CRUD for archived rounds in the entity store.
 * - One-time, idempotent migration of legacy v7.1 data (localStorage +
 *   GolfTrackerDB) into schema v2.
 *
 * Storage engines are injected via {@link PersistenceOptions} — nothing here
 * references browser globals, so the whole service is React Native portable.
 */
import { roundSchema } from '../../domain/models/entities'
import type { Round } from '../../domain/models/entities'
import { activeRoundStateSchema, createActiveRoundState } from '../../domain/models/roundSession'
import type { ActiveRoundState } from '../../domain/models/roundSession'
import { IndexedDBAdapter } from '../../storage/adapters/indexedDb'
import {
  LEGACY_DB_NAME,
  LEGACY_ROUNDS_STORE,
  LEGACY_STORAGE_KEYS,
  ROUNDS_STORE,
  STORAGE_KEYS,
} from '../../storage/keys'
import { buildRoundFromLegacy, convertLegacyArchivedRound, convertLegacyMinimalShot, convertLegacyV7Shot } from '../../storage/schema/migrations'
import type { LegacyArchivedRound, LegacyMinimalShot, LegacyV7Shot } from '../../storage/schema/migrations'
import { readValidatedEnvelope } from '../../storage/types'
import type { StorageAdapter, VersionedEnvelope } from '../../storage/types'

/** Composition inputs for the persistence service. */
export interface PersistenceOptions {
  /** Adapter for scalar key-value snapshots (active round, flags). */
  activeAdapter: StorageAdapter
  /** Adapter for the archived-rounds entity store. */
  archiveAdapter: StorageAdapter
  /** IndexedDB factory for reading the legacy GolfTrackerDB (optional). */
  idbFactory?: IDBFactory
}

/** Envelope kind identifier for the active round snapshot. */
const ACTIVE_ROUND_KIND = 'activeRound'

export class RoundPersistenceService {
  constructor(private readonly options: PersistenceOptions) {}

  /**
   * Loads and validates the persisted active round session.
   *
   * @returns The restored session, or `null` when no (valid) snapshot exists.
   */
  async hydrateActiveRound(): Promise<ActiveRoundState | null> {
    return readValidatedEnvelope(
      this.options.activeAdapter,
      STORAGE_KEYS.activeRound,
      activeRoundStateSchema,
      ACTIVE_ROUND_KIND
    )
  }

  /**
   * Persists the active round session snapshot (auto-save target).
   *
   * @param state - Current session state; written under a versioned envelope.
   */
  async persistActiveRound(state: ActiveRoundState): Promise<void> {
    const envelope: VersionedEnvelope<ActiveRoundState> = {
      schemaVersion: 2,
      kind: ACTIVE_ROUND_KIND,
      payload: state,
    }
    await this.options.activeAdapter.write(STORAGE_KEYS.activeRound, envelope)
  }

  /** Removes the active round snapshot (after archive or discard). */
  async clearActiveRound(): Promise<void> {
    await this.options.activeAdapter.delete(STORAGE_KEYS.activeRound)
  }

  /**
   * Archives a completed round into the entity store.
   * The round is validated against the schema before writing.
   *
   * @param round - Round to persist (must be valid schema v2).
   */
  async archiveRound(round: Round): Promise<void> {
    const parsed = roundSchema.parse(round)
    await this.options.archiveAdapter.write(parsed.id, parsed)
  }

  /**
   * Lists all archived rounds, newest first.
   * Invalid records are skipped defensively (never crash history on one
   * corrupt row).
   *
   * @returns Validated, time-descending rounds.
   */
  async listArchivedRounds(): Promise<Round[]> {
    const raw = await this.options.archiveAdapter.list(ROUNDS_STORE)
    const rounds: Round[] = []
    for (const item of raw) {
      const parsed = roundSchema.safeParse(item)
      if (parsed.success) rounds.push(parsed.data)
    }
    return rounds.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
  }

  /** Deletes one archived round by id. */
  async deleteArchivedRound(id: string): Promise<void> {
    await this.options.archiveAdapter.delete(id)
  }

  /**
   * Replaces the entire archive (used by backup import).
   *
   * @param rounds - Rounds to store; invalid rounds are rejected up front.
   */
  async replaceAllArchivedRounds(rounds: Round[]): Promise<void> {
    const validated = rounds.map((r) => roundSchema.parse(r))
    await this.options.archiveAdapter.clear(ROUNDS_STORE)
    for (const round of validated) {
      await this.archiveRound(round)
    }
  }

  /**
   * One-time migration of legacy v7.1 data into schema v2. Safe to call on
   * every boot: the migration flag makes it idempotent, and legacy keys are
   * removed only after a successful conversion.
   *
   * Legacy values are read defensively: the old app stored some keys as
   * plain strings (not JSON), so a read failure simply means "nothing to
   * migrate" — never a boot crash.
   *
   * @returns `true` when legacy data was migrated, `false` when nothing to do
   *          or already done.
   */
  async migrateLegacyIfNeeded(): Promise<boolean> {
    const flag = await this.options.activeAdapter.read(STORAGE_KEYS.migrationDone)
    if (flag === true) return false

    // Reads a legacy key, tolerating raw/non-JSON values and corruption:
    // JSON values are parsed, plain strings pass through untouched.
    const readLegacy = async (key: string): Promise<unknown> => {
      const raw = await this.options.activeAdapter.readRaw(key)
      if (raw === null) return null
      try {
        return JSON.parse(raw) as unknown
      } catch {
        return raw
      }
    }

    let migrated = false

    // 1) Active round from the full tracker (v7 shots take precedence).
    if ((await this.hydrateActiveRound()) === null) {
      const v7ShotsRaw = await readLegacy(LEGACY_STORAGE_KEYS.shots)
      if (Array.isArray(v7ShotsRaw) && v7ShotsRaw.length > 0) {
        const parsRaw = await readLegacy(LEGACY_STORAGE_KEYS.pars)
        const courseRaw = await readLegacy(LEGACY_STORAGE_KEYS.courseName)
        const round = buildRoundFromLegacy(
          v7ShotsRaw as LegacyV7Shot[],
          (parsRaw ?? {}) as Record<string, number>,
          typeof courseRaw === 'string' ? courseRaw : '',
          convertLegacyV7Shot
        )
        await this.persistActiveRound(createActiveRoundState(round))
        await this.options.activeAdapter.delete(LEGACY_STORAGE_KEYS.shots)
        await this.options.activeAdapter.delete(LEGACY_STORAGE_KEYS.pars)
        migrated = true
      } else {
        // 2) Active round from the minimal tracker.
        const minimalShotsRaw = await readLegacy(LEGACY_STORAGE_KEYS.minimalShots)
        if (Array.isArray(minimalShotsRaw) && minimalShotsRaw.length > 0) {
          const round = buildRoundFromLegacy(
            minimalShotsRaw as LegacyMinimalShot[],
            {},
            '',
            convertLegacyMinimalShot
          )
          await this.persistActiveRound(createActiveRoundState(round))
          await this.options.activeAdapter.delete(LEGACY_STORAGE_KEYS.minimalShots)
          migrated = true
        }
      }
    }

    // 3) Archived rounds from the legacy IndexedDB (deduplicated by id).
    if (this.options.idbFactory) {
      const legacyAdapter = new IndexedDBAdapter(
        this.options.idbFactory,
        LEGACY_DB_NAME,
        LEGACY_ROUNDS_STORE
      )
      const legacyRounds = await legacyAdapter.list(LEGACY_ROUNDS_STORE)
      if (legacyRounds.length > 0) {
        const existing = await this.listArchivedRounds()
        const existingIds = new Set(existing.map((r) => r.id))
        for (const record of legacyRounds) {
          const round = convertLegacyArchivedRound(record as LegacyArchivedRound)
          if (!existingIds.has(round.id)) {
            await this.archiveRound(round)
            migrated = true
          }
        }
      }
    }

    await this.options.activeAdapter.write(STORAGE_KEYS.migrationDone, true)
    return migrated
  }
}
