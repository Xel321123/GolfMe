/**
 * Round lifecycle service — the four canonical actions exposed to the UI:
 * resume, save, complete-and-archive, discard. Backed by the persistence
 * service; framework agnostic (safe to call from React Native).
 */
import { RoundStatus } from '../../domain/enums/golf'
import type { Round } from '../../domain/models/entities'
import { createRound } from '../../domain/models/entities'
import type { ActiveRoundState } from '../../domain/models/roundSession'
import { createActiveRoundState } from '../../domain/models/roundSession'
import { computeAllHoleScores } from '../../domain/rules/scoring'
import { RoundPersistenceService } from '../persistence/RoundPersistenceService'

export class RoundLifecycleService {
  constructor(private readonly persistence: RoundPersistenceService) {}

  /**
   * Restores the in-progress round after a reload/crash, running any pending
   * legacy migration first.
   *
   * @returns The restored session, or `null` when no active round exists.
   */
  async resumeActiveRound(): Promise<ActiveRoundState | null> {
    await this.persistence.migrateLegacyIfNeeded()
    return this.persistence.hydrateActiveRound()
  }

  /**
   * Persists the current session snapshot (auto-save on every mutation).
   *
   * @param state - Session state to persist.
   */
  async saveActiveRound(state: ActiveRoundState): Promise<void> {
    await this.persistence.persistActiveRound(state)
  }

  /**
   * Finalizes and archives the round, then clears the active snapshot.
   * Hole scores are recomputed from the raw shot log so the archive is always
   * consistent with the latest rules.
   *
   * @param state - Session to complete.
   * @returns The finalized (archived) round.
   */
  async completeAndArchiveRound(state: ActiveRoundState): Promise<Round> {
    const parMap = new Map(state.round.holes.map((h) => [h.holeNumber, h.par]))
    const finalized: Round = {
      ...state.round,
      status: RoundStatus.COMPLETED,
      completedAt: new Date().toISOString(),
      holes: computeAllHoleScores(state.round.shots, parMap),
    }
    await this.persistence.archiveRound(finalized)
    await this.persistence.clearActiveRound()
    return finalized
  }

  /**
   * Abandons the active round without archiving (irreversible).
   */
  async discardRound(): Promise<void> {
    await this.persistence.clearActiveRound()
  }

  /**
   * Starts a brand-new round and persists it immediately.
   *
   * @param input - Course name (required) and player name (default `Golfer`).
   * @returns The persisted session state.
   */
  async startNewRound(input: { courseName: string; playerName?: string }): Promise<ActiveRoundState> {
    const round = createRound({ courseName: input.courseName, playerName: input.playerName ?? 'Golfer' })
    const state = createActiveRoundState(round)
    await this.persistence.persistActiveRound(state)
    return state
  }
}
