/**
 * usePersistentRound — owns the active-round session state and its
 * persistence lifecycle.
 *
 * Guarantees (Phase 4 contract):
 * - Hydration: the persisted snapshot is restored automatically on mount.
 * - Auto-save: every mutation applied through `update` is persisted
 *   immediately (synchronous write kick-off, so a crash right after a
 *   stroke cannot lose it).
 * - Lifecycle: exposes resume / save / complete-and-archive / discard.
 * - Resilience: storage failures surface as an error string instead of
 *   crashing the tree.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ActiveRoundState } from '../domain/models/roundSession'
import type { Round } from '../domain/models/entities'
import { RoundLifecycleService } from '../services/round/RoundLifecycleService'

/** Errors as human-readable strings (never raw objects). */
function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Return shape of {@link usePersistentRound}. */
export interface UsePersistentRoundReturn {
  /** Current session state, or null before hydration / after completion. */
  state: ActiveRoundState | null
  /** False until the first hydration attempt has finished. */
  hydrated: boolean
  /** Last persistence error message, or null when all is well. */
  error: string | null
  /** Applies a pure state transition and auto-persists the result. */
  update: (transition: (current: ActiveRoundState) => ActiveRoundState) => void
  resumeActiveRound: () => Promise<ActiveRoundState | null>
  startNewRound: (input: { courseName: string; playerName?: string }) => Promise<ActiveRoundState | null>
  completeAndArchiveRound: () => Promise<Round | null>
  discardRound: () => Promise<boolean>
  clearError: () => void
}

/**
 * @param lifecycle - The round lifecycle service (from the composition root).
 */
export function usePersistentRound(lifecycle: RoundLifecycleService): UsePersistentRoundReturn {
  const [state, setState] = useState<ActiveRoundState | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Ref mirror of `state` so `update` can compute the next state outside the
  // React updater (avoiding StrictMode double-invoke side effects).
  const stateRef = useRef<ActiveRoundState | null>(null)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const clearError = useCallback(() => setError(null), [])

  /**
   * Applies a pure transition to the current session state and persists the
   * result immediately. No-op when no session is active.
   */
  const update = useCallback(
    (transition: (current: ActiveRoundState) => ActiveRoundState) => {
      const current = stateRef.current
      if (current === null) return
      const next = transition(current)
      stateRef.current = next
      setState(next)
      void lifecycle.saveActiveRound(next).catch((e: unknown) => setError(toMessage(e)))
    },
    [lifecycle]
  )

  /** Restores the persisted session (runs legacy migration first). */
  const resumeActiveRound = useCallback(async (): Promise<ActiveRoundState | null> => {
    try {
      const restored = await lifecycle.resumeActiveRound()
      stateRef.current = restored
      setState(restored)
      return restored
    } catch (e) {
      setError(toMessage(e))
      return null
    } finally {
      setHydrated(true)
    }
  }, [lifecycle])

  /** Creates and persists a brand-new round session. */
  const startNewRound = useCallback(
    async (input: { courseName: string; playerName?: string }): Promise<ActiveRoundState | null> => {
      try {
        const next = await lifecycle.startNewRound(input)
        stateRef.current = next
        setState(next)
        return next
      } catch (e) {
        setError(toMessage(e))
        return null
      }
    },
    [lifecycle]
  )

  /** Finalizes, archives, and clears the active session. */
  const completeAndArchiveRound = useCallback(async (): Promise<Round | null> => {
    const current = stateRef.current
    if (current === null) return null
    try {
      const archived = await lifecycle.completeAndArchiveRound(current)
      stateRef.current = null
      setState(null)
      return archived
    } catch (e) {
      setError(toMessage(e))
      return null
    }
  }, [lifecycle])

  /** Discards the active session (irreversible). */
  const discardRound = useCallback(async (): Promise<boolean> => {
    try {
      await lifecycle.discardRound()
      stateRef.current = null
      setState(null)
      return true
    } catch (e) {
      setError(toMessage(e))
      return false
    }
  }, [lifecycle])

  // Boot hydration.
  useEffect(() => {
    void resumeActiveRound()
  }, [resumeActiveRound])

  return {
    state,
    hydrated,
    error,
    update,
    resumeActiveRound,
    startNewRound,
    completeAndArchiveRound,
    discardRound,
    clearError,
  }
}
