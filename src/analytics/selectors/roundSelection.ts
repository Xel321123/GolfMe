/**
 * Round selection helpers for multi-round analytics.
 *
 * The dashboard lets the user pick specific rounds, or "All Rounds". These
 * pure helpers translate that UI concept into concrete round lists without
 * coupling the analytics engine to any component.
 */
import type { Round } from '../../domain/models/entities'

/** Selection modes understood by the aggregation engine. */
export interface RoundSelection {
  mode: 'all' | 'ids'
  /** Round ids to include (required when mode is `ids`). */
  ids?: string[]
}

/** Returns only completed rounds (analytics ignores in-progress data). */
export function selectCompletedRounds(rounds: readonly Round[]): Round[] {
  return rounds.filter((r) => r.status === 'COMPLETED')
}

/**
 * Applies a selection to a round list.
 *
 * @param rounds - All available rounds.
 * @param selection - `all` returns every round; `ids` filters by id.
 * @returns The selected rounds (empty when no ids match).
 */
export function applySelection(rounds: readonly Round[], selection: RoundSelection): Round[] {
  if (selection.mode === 'all') return [...rounds]
  const ids = new Set(selection.ids ?? [])
  return rounds.filter((r) => ids.has(r.id))
}
