/**
 * Multi-round (historical) aggregation engine.
 *
 * Aggregates any set of rounds — a filtered multi-selection or "All Rounds"
 * — into a single statistical profile. Pure functions, unit-testable with
 * golden fixtures; empty inputs produce neutral values, never `NaN`/throws.
 */
import type { Round } from '../../domain/models/entities'
import { computeHandicapSummary } from '../handicap/differential'
import type { HandicapSummary } from '../handicap/differential'
import { applySelection, selectCompletedRounds } from '../selectors/roundSelection'
import type { RoundSelection } from '../selectors/roundSelection'
import type { RateStat, ScoreDistribution } from '../singleRound/roundDeepDive'
import { safePercentage } from '../../domain/utils/numbers'

/** Aggregated statistics across multiple rounds. */
export interface AggregateStats {
  roundCount: number
  holeCount: number
  /** Average total strokes per round (scoring average). */
  scoringAverage: number | null
  /** Average score-vs-par across rounds. */
  scoreVsParAverage: number | null
  /** Lowest (best) total strokes among the selected rounds. */
  bestRound: number | null
  /** Highest (worst) total strokes among the selected rounds. */
  worstRound: number | null
  fairway: RateStat
  gir: RateStat
  puttsPerHole: number | null
  puttsPerRound: number | null
  sandSaves: RateStat
  scramble: RateStat
  distribution: ScoreDistribution
  handicap: HandicapSummary
}

/** Empty aggregate used as a neutral baseline. */
export function emptyAggregateStats(): AggregateStats {
  return {
    roundCount: 0,
    holeCount: 0,
    scoringAverage: null,
    scoreVsParAverage: null,
    bestRound: null,
    worstRound: null,
    fairway: { attempts: 0, successes: 0, percentage: null },
    gir: { attempts: 0, successes: 0, percentage: null },
    puttsPerHole: null,
    puttsPerRound: null,
    sandSaves: { attempts: 0, successes: 0, percentage: null },
    scramble: { attempts: 0, successes: 0, percentage: null },
    distribution: { eagles: 0, birdies: 0, pars: 0, bogeys: 0, doubleBogeys: 0, worse: 0, total: 0 },
    handicap: { current: null, differentials: [], estimated: false },
  }
}

/**
 * Computes aggregate statistics for the selected rounds.
 *
 * @param rounds - Candidate rounds (in-progress rounds are ignored).
 * @param selection - Which rounds to include (`all` or by ids).
 * @returns Aggregated statistics; never throws.
 */
export function computeAggregateStats(
  rounds: readonly Round[],
  selection: RoundSelection = { mode: 'all' }
): AggregateStats {
  const selected = applySelection(selectCompletedRounds(rounds), selection)
  if (selected.length === 0) return emptyAggregateStats()

  let holeCount = 0
  let totalStrokes = 0
  let totalPar = 0
  let totalPutts = 0
  let puttHoleCount = 0
  let fairwayAttempts = 0
  let fairwaySuccesses = 0
  let girAttempts = 0
  let girSuccesses = 0
  let scrambleAttempts = 0
  let scrambleSuccesses = 0
  let sandAttempts = 0
  let sandSuccesses = 0
  const distribution: ScoreDistribution = {
    eagles: 0,
    birdies: 0,
    pars: 0,
    bogeys: 0,
    doubleBogeys: 0,
    worse: 0,
    total: 0,
  }
  const roundTotals: number[] = []

  for (const round of selected) {
    let roundStrokes = 0
    for (const hole of round.holes) {
      if (hole.strokes <= 0 && hole.status !== 'COMPLETED') continue
      holeCount += 1
      roundStrokes += hole.strokes
      totalPar += hole.par
      totalPutts += hole.putts
      if (hole.putts > 0) puttHoleCount += 1

      if (hole.fairwayHit !== undefined) {
        fairwayAttempts += 1
        if (hole.fairwayHit) fairwaySuccesses += 1
      }
      if (hole.greenInRegulation !== undefined) {
        girAttempts += 1
        if (hole.greenInRegulation) girSuccesses += 1
      }
      if (hole.scramble !== undefined) {
        scrambleAttempts += 1
        if (hole.scramble) scrambleSuccesses += 1
      }
      if (hole.sandSave !== undefined) {
        sandAttempts += 1
        if (hole.sandSave) sandSuccesses += 1
      }

      const diff = hole.strokes - hole.par
      distribution.total += 1
      if (diff <= -2) distribution.eagles += 1
      else if (diff === -1) distribution.birdies += 1
      else if (diff === 0) distribution.pars += 1
      else if (diff === 1) distribution.bogeys += 1
      else if (diff === 2) distribution.doubleBogeys += 1
      else distribution.worse += 1
    }
    totalStrokes += roundStrokes
    if (roundStrokes > 0) roundTotals.push(roundStrokes)
  }

  const scoreVsParTotal = totalStrokes - totalPar
  const scoredRounds = roundTotals.length

  return {
    roundCount: selected.length,
    holeCount,
    scoringAverage:
      scoredRounds > 0 ? totalStrokes / scoredRounds : null,
    scoreVsParAverage:
      scoredRounds > 0 ? scoreVsParTotal / scoredRounds : null,
    bestRound: scoredRounds > 0 ? Math.min(...roundTotals) : null,
    worstRound: scoredRounds > 0 ? Math.max(...roundTotals) : null,
    fairway: {
      attempts: fairwayAttempts,
      successes: fairwaySuccesses,
      percentage: safePercentage(fairwaySuccesses, fairwayAttempts),
    },
    gir: {
      attempts: girAttempts,
      successes: girSuccesses,
      percentage: safePercentage(girSuccesses, girAttempts),
    },
    puttsPerHole: puttHoleCount > 0 ? totalPutts / puttHoleCount : null,
    puttsPerRound: scoredRounds > 0 ? totalPutts / scoredRounds : null,
    sandSaves: {
      attempts: sandAttempts,
      successes: sandSuccesses,
      percentage: safePercentage(sandSuccesses, sandAttempts),
    },
    scramble: {
      attempts: scrambleAttempts,
      successes: scrambleSuccesses,
      percentage: safePercentage(scrambleSuccesses, scrambleAttempts),
    },
    distribution,
    handicap: computeHandicapSummary(selected),
  }
}
