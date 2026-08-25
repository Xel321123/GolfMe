/**
 * Unit tests — multi-round aggregation engine (golden values).
 *
 * Round A (fixture): 3 holes, 13 strokes, par 12 (+1).
 * Round B (second):  2 holes, 7 strokes, par 8 (-1).
 * All expected values hand-computed.
 */
import { describe, expect, it } from 'vitest'
import { HoleStatus, RoundStatus } from '../../../src/domain/enums/golf'
import { computeAggregateStats, emptyAggregateStats } from '../../../src/analytics/aggregates/aggregateStats'
import { buildSecondRound, playFixtureRound } from './fixtures/roundFixture'
import { computeHandicapSummary, handicapDifferential } from '../../../src/analytics/handicap/differential'

function completedRounds() {
  const a = playFixtureRound().round
  const b = buildSecondRound().round
  return [
    { ...a, status: RoundStatus.COMPLETED, completedAt: new Date().toISOString() },
    { ...b, status: RoundStatus.COMPLETED, completedAt: new Date().toISOString() },
  ]
}

describe('computeAggregateStats', () => {
  const rounds = completedRounds()
  const stats = computeAggregateStats(rounds, { mode: 'all' })

  it('counts rounds and holes', () => {
    expect(stats.roundCount).toBe(2)
    expect(stats.holeCount).toBe(5)
  })

  it('computes scoring average and extremes', () => {
    expect(stats.scoringAverage).toBe(10.5) // (13 + 8) / 2
    expect(stats.scoreVsParAverage).toBe(0.5) // (+1 + 0) / 2
    expect(stats.bestRound).toBe(8)
    expect(stats.worstRound).toBe(13)
  })

  it('aggregates FIR 3/4 and GIR 2/5', () => {
    expect(stats.fairway).toEqual({ attempts: 4, successes: 3, percentage: 75 })
    expect(stats.gir).toEqual({ attempts: 5, successes: 2, percentage: 40 })
  })

  it('aggregates putts', () => {
    expect(stats.puttsPerHole).toBe(1.6) // 8 putts / 5 holes
    expect(stats.puttsPerRound).toBe(4) // 8 putts / 2 rounds
  })

  it('aggregates scramble 1/3 and sand saves 1/1', () => {
    // Scramble attempts: A h2 (fail), A h3 (success), B h2 (fail).
    expect(stats.scramble).toEqual({ attempts: 3, successes: 1, percentage: 33.3 })
    expect(stats.sandSaves).toEqual({ attempts: 1, successes: 1, percentage: 100 })
  })

  it('sums the performance distribution', () => {
    expect(stats.distribution).toEqual({
      eagles: 0,
      birdies: 1,
      pars: 2,
      bogeys: 2,
      doubleBogeys: 0,
      worse: 0,
      total: 5,
    })
  })

  it('filters by explicit round ids', () => {
    const [a, b] = rounds
    expect(a).toBeDefined()
    expect(b).toBeDefined()
    const onlyB = computeAggregateStats(rounds, { mode: 'ids', ids: [b!.id] })
    expect(onlyB.roundCount).toBe(1)
    expect(onlyB.scoringAverage).toBe(8)
    expect(onlyB.bestRound).toBe(8)

    const onlyA = computeAggregateStats(rounds, { mode: 'ids', ids: [a!.id] })
    expect(onlyA.scoringAverage).toBe(13)
  })

  it('ignores in-progress rounds', () => {
    const mixed = [rounds[0]!, { ...rounds[1]!, status: RoundStatus.IN_PROGRESS }]
    const stats2 = computeAggregateStats(mixed, { mode: 'all' })
    expect(stats2.roundCount).toBe(1)
  })

  it('returns neutral values for an empty selection', () => {
    expect(computeAggregateStats([], { mode: 'all' })).toEqual(emptyAggregateStats())
  })
})

describe('handicap', () => {
  it('computes a single differential with the WHS formula', () => {
    // (90 - 72) * 113 / 130 = 15.646... -> 15.6
    expect(handicapDifferential(90, 72, 130)).toBe(15.6)
    // Neutral defaults: (80 - 72) * 113 / 113 = 8
    expect(handicapDifferential(80, 72, 113)).toBe(8)
  })

  it('returns null index with fewer than 3 rounds', () => {
    const [a] = completedRounds()
    const summary = computeHandicapSummary([a!])
    expect(summary.current).toBeNull()
    expect(summary.differentials).toHaveLength(1)
  })

  it('averages the best differentials across 3+ rounds', () => {
    const base = completedRounds()[0]!
    const mk = (id: string, gross: number) => ({
      ...base,
      id,
      courseRating: 72,
      courseSlope: 113,
      holes: [{ holeNumber: 1, par: 72, strokes: gross, putts: 36, status: HoleStatus.COMPLETED }],
    })
    // Round 1: gross 90 -> diff 18; Round 2: gross 85 -> diff 13; Round 3: gross 80 -> diff 8
    const r1 = mk('r1', 90)
    const r2 = mk('r2', 85)
    const r3 = mk('r3', 80)
    const summary = computeHandicapSummary([r1, r2, r3])
    expect(summary.current).toBeCloseTo((18 + 13 + 8) / 3, 1)
    expect(summary.estimated).toBe(false)
  })

  it('flags estimated when rating/slope are missing', () => {
    const [a, b, c] = [completedRounds()[0], completedRounds()[1], completedRounds()[0]]
    const summary = computeHandicapSummary([
      { ...a!, id: 'x1' },
      { ...b!, id: 'x2' },
      { ...c!, id: 'x3' },
    ])
    expect(summary.estimated).toBe(true)
    expect(summary.current).not.toBeNull()
  })
})
