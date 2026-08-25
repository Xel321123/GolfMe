/**
 * useRoundHistory — archived rounds + backup/export operations.
 */
import { useCallback, useEffect, useState } from 'react'
import type { Round } from '../domain/models/entities'
import { RoundPersistenceService } from '../services/persistence/RoundPersistenceService'
import { parseRoundsFromJson, roundToCsv, serializeRoundsToJson } from '../services/backup/backupService'
import { downloadTextFile } from '../lib/download'

/** Errors as human-readable strings. */
function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Return shape of {@link useRoundHistory}. */
export interface UseRoundHistoryReturn {
  rounds: Round[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  deleteRound: (id: string) => Promise<void>
  /** Imports a backup document; returns the number of imported rounds. */
  importRounds: (text: string) => Promise<number>
  /** Downloads a JSON backup of all archived rounds. */
  exportJson: () => void
  /** Downloads a CSV export of one round. */
  exportCsv: (round: Round) => void
  clearError: () => void
}

/**
 * @param persistence - Persistence service (from the composition root).
 */
export function useRoundHistory(persistence: RoundPersistenceService): UseRoundHistoryReturn {
  const [rounds, setRounds] = useState<Round[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setRounds(await persistence.listArchivedRounds())
    } catch (e) {
      setError(toMessage(e))
    } finally {
      setLoading(false)
    }
  }, [persistence])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const deleteRound = useCallback(
    async (id: string) => {
      try {
        await persistence.deleteArchivedRound(id)
        await refresh()
      } catch (e) {
        setError(toMessage(e))
      }
    },
    [persistence, refresh]
  )

  const importRounds = useCallback(
    async (text: string): Promise<number> => {
      try {
        const parsed = parseRoundsFromJson(text)
        await persistence.replaceAllArchivedRounds(parsed)
        await refresh()
        return parsed.length
      } catch (e) {
        setError(toMessage(e))
        return 0
      }
    },
    [persistence, refresh]
  )

  const exportJson = useCallback(() => {
    downloadTextFile(
      `golfme_backup_${new Date().toISOString().slice(0, 10)}.json`,
      serializeRoundsToJson(rounds),
      'application/json'
    )
  }, [rounds])

  const exportCsv = useCallback((round: Round) => {
    downloadTextFile(
      `golf_${round.courseName.replace(/[^a-z0-9]+/gi, '_')}_${round.startedAt.slice(0, 10)}.csv`,
      roundToCsv(round),
      'text/csv'
    )
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return { rounds, loading, error, refresh, deleteRound, importRounds, exportJson, exportCsv, clearError }
}
