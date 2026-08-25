/**
 * Single-round deep-dive analytics.
 *
 * All functions are pure: they take a validated {@link Round} and return
 * computed statistics. Empty or partial rounds degrade to neutral values
 * (`null` percentages, zero counts) instead of throwing or producing `NaN`.
 */
import { ScoreCategory } from '../../domain/enums/golf'
import type { Round } from '../../domain/models/entities'
import { categorizeScore, scoreVsPar } from '../../domain/rules/scoring'
import { safePercentage } from '../../domain/utils/numbers'

/** Attempt/success pair with a safe percentage (null when no attempts). */
export interface RateStat {
  attempts: number
  successes: number
  percentage: number | null
}

/** Per-hole score momentum used for hole-by-hole trend charts. */
export interface HoleMomentum {
  holeNumber: number
  scoreVsPar: number
  category: ScoreCategory
}

/** Count of holes per score category. */
export interface ScoreDistribution {
  eagles: number
  birdies: number
  pars: number
  bogeys: number
  doubleBogeys: number
  worse: number
  total: number
}

/** Full statistical profile of a single round. */
export interface RoundDeepDive {
  holesPlayed: number
  totalStrokes: number
  totalPar: number
  scoreVsPar: number
  /** Human-readable score vs par: `E`, `-3`, `+5`. */
  scoreText: string
  fairway: RateStat
  gir: RateStat
  putts: {
    total: number
    holesCounted: number
    /** Average putts per counted hole, or null when none. */
    perHole: number | null
  }
  scramble: RateStat
  sandSaves: RateStat
  momentum: HoleMomentum[]
  distribution: ScoreDistribution
}

/**
 * Formats a score-vs-par delta for display.
 *
 * @param diff - Score delta (see {@link scoreVsPar}).
 * @returns `'E'` for par, `'-3'` for three under, `'+5'` for five over.
 */
export function formatScoreDiff(diff: number): string {
  if (diff === 0) return 'E'
  return diff > 0 ? `+${diff}` : `${diff}`
}

/** Holes that count as played (any stroke recorded or completed). */
function playedHoles(round: Round) {
  return round.holes.filter((h) => h.strokes > 0 || h.status === 'COMPLETED')
}

/** Builds a RateStat from a per-hole boolean-or-undefined field. */
function rateFromHoles(
  holes: Round['holes'],
  pick: (hole: Round['holes'][number]) => boolean | undefined
): RateStat {
  let attempts = 0
  let successes = 0
  for (const hole of holes) {
    const value = pick(hole)
    if (value === undefined) continue
    attempts += 1
    if (value) successes += 1
  }
  return { attempts, successes, percentage: safePercentage(successes, attempts) }
}

/**
 * Computes the full deep-dive profile for one round.
 *
 * @param round - Validated round (any completion state).
 * @returns The deep-dive statistics object.
 */
export function computeRoundDeepDive(round: Round): RoundDeepDive {
  const holes = playedHoles(round)
  const totalStrokes = holes.reduce((sum, h) => sum + h.strokes, 0)
  const totalPar = holes.reduce((sum, h) => sum + h.par, 0)
  const diff = scoreVsPar(totalStrokes, totalPar)

  const puttHoles = holes.filter((h) => h.putts > 0)
  const totalPutts = puttHoles.reduce((sum, h) => sum + h.putts, 0)

  const distribution: ScoreDistribution = {
    eagles: 0,
    birdies: 0,
    pars: 0,
    bogeys: 0,
    doubleBogeys: 0,
    worse: 0,
    total: holes.length,
  }
  const momentum: HoleMomentum[] = holes.map((h) => {
    const holeDiff = scoreVsPar(h.strokes, h.par)
    const category = categorizeScore(holeDiff)
    if (category === ScoreCategory.EAGLE_OR_BETTER) distribution.eagles += 1
    else if (category === ScoreCategory.BIRDIE) distribution.birdies += 1
    else if (category === ScoreCategory.PAR) distribution.pars += 1
    else if (category === ScoreCategory.BOGEY) distribution.bogeys += 1
    else if (category === ScoreCategory.DOUBLE_BOGEY) distribution.doubleBogeys += 1
    else distribution.worse += 1
    return { holeNumber: h.holeNumber, scoreVsPar: holeDiff, category }
  })

  return {
    holesPlayed: holes.length,
    totalStrokes,
    totalPar,
    scoreVsPar: diff,
    scoreText: formatScoreDiff(diff),
    fairway: rateFromHoles(holes, (h) => h.fairwayHit),
    gir: rateFromHoles(holes, (h) => h.greenInRegulation),
    putts: {
      total: totalPutts,
      holesCounted: puttHoles.length,
      perHole: puttHoles.length > 0 ? totalPutts / puttHoles.length : null,
    },
    scramble: rateFromHoles(holes, (h) => h.scramble),
    sandSaves: rateFromHoles(holes, (h) => h.sandSave),
    momentum,
    distribution,
  }
}
