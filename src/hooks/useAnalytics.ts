/**
 * useAnalytics — memoized analytics queries for the dashboard.
 *
 * Keeps the analytics engine (pure functions in `src/analytics`) out of the
 * render path; results are recomputed only when their inputs change.
 */
import { useMemo } from 'react'
import type { Round } from '../domain/models/entities'
import { computeAggregateStats } from '../analytics/aggregates/aggregateStats'
import type { AggregateStats } from '../analytics/aggregates/aggregateStats'
import type { RoundSelection } from '../analytics/selectors/roundSelection'
import { computeRoundDeepDive } from '../analytics/singleRound/roundDeepDive'
import type { RoundDeepDive } from '../analytics/singleRound/roundDeepDive'

/** Return shape of {@link useAnalytics}. */
export interface UseAnalyticsReturn {
  /** Aggregates over the selected multi-round set (or all rounds). */
  aggregates: AggregateStats
  /** Deep-dive for a single highlighted round, or null when none selected. */
  deepDive: RoundDeepDive | null
  /** The highlighted round object, or null. */
  selectedRound: Round | null
}

/**
 * @param rounds - Archived rounds (typically from {@link useRoundHistory}).
 * @param selection - Which rounds to aggregate over.
 * @param selectedRoundId - Id of the round shown in the deep-dive panel.
 */
export function useAnalytics(
  rounds: Round[],
  selection: RoundSelection,
  selectedRoundId: string | null
): UseAnalyticsReturn {
  const aggregates = useMemo(() => computeAggregateStats(rounds, selection), [rounds, selection])
  const selectedRound = useMemo(
    () => rounds.find((r) => r.id === selectedRoundId) ?? null,
    [rounds, selectedRoundId]
  )
  const deepDive = useMemo(
    () => (selectedRound !== null ? computeRoundDeepDive(selectedRound) : null),
    [selectedRound]
  )

  return { aggregates, deepDive, selectedRound }
}
