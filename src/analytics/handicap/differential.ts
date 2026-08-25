/**
 * Handicap index calculation (simplified WHS approximation).
 *
 * Differential formula (World Handicap System):
 *   differential = (grossAdjusted - courseRating) * 113 / slope
 *
 * The legacy data carries no course rating/slope, so callers may supply
 * neutral defaults (72 / 113). When any default is used the summary is
 * flagged `estimated: true` so the UI can disclaim precision.
 *
 * The index is the average of the best (lowest) differentials — simplified
 * to "best 8 of the last 20" without the 20-round window, requiring at least
 * 3 rounds to produce a value.
 */
import type { Round } from '../../domain/models/entities'
import { roundTo } from '../../domain/utils/numbers'

/** One round's differential contribution. */
export interface DifferentialResult {
  roundId: string
  grossScore: number
  rating: number
  slope: number
  differential: number
  /** `true` when neutral defaults were substituted for missing course data. */
  estimated: boolean
}

/** Handicap summary for a set of rounds. */
export interface HandicapSummary {
  /** Current index, or null when fewer than 3 rounds are available. */
  current: number | null
  differentials: DifferentialResult[]
  /** `true` when any differential relied on default rating/slope. */
  estimated: boolean
}

/** Default course rating used when a round has none recorded. */
export const DEFAULT_COURSE_RATING = 72

/** Default slope used when a round has none recorded. */
export const DEFAULT_SLOPE = 113

/** Minimum number of rounds required to produce a handicap index. */
export const MIN_ROUNDS_FOR_INDEX = 3

/** Number of best differentials averaged for the index. */
export const BEST_DIFFERENTIALS_COUNT = 8

/**
 * Computes a single round's handicap differential.
 *
 * @param grossScore - Total strokes for the round.
 * @param rating - Course rating (must be > 0).
 * @param slope - Course slope (must be > 0).
 * @returns The differential rounded to one decimal.
 */
export function handicapDifferential(grossScore: number, rating: number, slope: number): number {
  if (!Number.isFinite(grossScore) || rating <= 0 || slope <= 0) return 0
  return roundTo(((grossScore - rating) * 113) / slope, 1)
}

/**
 * Computes differentials and a current index for a set of completed rounds.
 *
 * @param rounds - Completed rounds (in-progress rounds are ignored).
 * @param options - Optional default rating/slope overrides.
 * @returns The handicap summary (never throws; empty input -> null index).
 */
export function computeHandicapSummary(
  rounds: readonly Round[],
  options: { defaultRating?: number; defaultSlope?: number } = {}
): HandicapSummary {
  const defaultRating = options.defaultRating ?? DEFAULT_COURSE_RATING
  const defaultSlope = options.defaultSlope ?? DEFAULT_SLOPE

  const differentials: DifferentialResult[] = []
  for (const round of rounds) {
    if (round.status !== 'COMPLETED') continue
    const grossScore = round.holes.reduce((sum, h) => sum + h.strokes, 0)
    if (grossScore <= 0) continue

    const rating = round.courseRating ?? defaultRating
    const slope = round.courseSlope ?? defaultSlope
    const estimated = round.courseRating === undefined || round.courseSlope === undefined

    differentials.push({
      roundId: round.id,
      grossScore,
      rating,
      slope,
      differential: handicapDifferential(grossScore, rating, slope),
      estimated,
    })
  }

  if (differentials.length < MIN_ROUNDS_FOR_INDEX) {
    return { current: null, differentials, estimated: differentials.some((d) => d.estimated) }
  }

  const best = [...differentials]
    .sort((a, b) => a.differential - b.differential)
    .slice(0, BEST_DIFFERENTIALS_COUNT)
  const current = roundTo(
    best.reduce((sum, d) => sum + d.differential, 0) / best.length,
    1
  )

  return {
    current,
    differentials: [...differentials].sort((a, b) => b.differential - a.differential),
    estimated: differentials.some((d) => d.estimated),
  }
}
