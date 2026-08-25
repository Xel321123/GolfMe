/**
 * Central registry of storage keys, database names, and store names.
 *
 * Keeping every magic string in one module prevents drift between the
 * persistence layer and the UI layer, and makes the future React Native
 * migration a one-file change (the same keys can back AsyncStorage).
 */

/** Application database name (IndexedDB / future SQLite/MMKV namespace). */
export const DB_NAME = 'GolfMeDB'

/** Object store holding archived (completed) rounds. */
export const ROUNDS_STORE = 'rounds'

/** Legacy database name used by the v7.1 HTML app (migration source). */
export const LEGACY_DB_NAME = 'GolfTrackerDB'

/** Legacy object store name used by the v7.1 HTML app. */
export const LEGACY_ROUNDS_STORE = 'rounds'

/** Storage keys used by the application itself. */
export const STORAGE_KEYS = {
  /** Snapshot of the in-progress round session (schema v2 envelope). */
  activeRound: 'golfme.activeRound.v2',
  /** Course name typed into the setup field (kept for continuity). */
  courseName: 'golfme.courseName',
  /** Flag set once legacy data has been migrated (idempotency guard). */
  migrationDone: 'golfme.migration.v1.complete',
} as const

/** Legacy localStorage keys written by the v7.1 HTML app (migration source). */
export const LEGACY_STORAGE_KEYS = {
  shots: 'golf_v7_shots',
  pars: 'golf_v7_pars',
  courseName: 'golf_course_name',
  minimalShots: 'golf_shots',
} as const
