/**
 * Unit tests — single-round deep dive analytics (golden values).
 *
 * The fixture round is produced by the real wizard flow (see
 * tests/unit/domain/scoring.test.ts):
 *   Hole 1 (par 4): FIR hit, GIR on 2, 2 putts          -> Par    (4 strokes)
 *   Hole 2 (par 3): no FIR (N/A), no GIR, chip, 2 putts -> Bogey  (4 strokes)
 *   Hole 3 (par 5): FIR miss, no GIR, bunker, chip, 1   -> Par    (5 strokes)
 * All expected numbers below are hand-computed.
 */
import { describe, expect, it } from 'vitest'
import { computeRoundDeepDive, formatScoreDiff } from '../../../src/analytics/singleRound/roundDeepDive'
import { playFixtureRound } from './fixtures/roundFixture'

describe('computeRoundDeepDive', () => {
  const round = playFixtureRound().round
  const dive = computeRoundDeepDive(round)

  it('computes totals and score text', () => {
    expect(dive.holesPlayed).toBe(3)
    expect(dive.totalStrokes).toBe(13)
    expect(dive.totalPar).toBe(12)
    expect(dive.scoreVsPar).toBe(1)
    expect(dive.scoreText).toBe('+1')
  })

  it('computes FIR: 1 of 2 attempts (par 3 excluded)', () => {
    expect(dive.fairway.attempts).toBe(2)
    expect(dive.fairway.successes).toBe(1)
    expect(dive.fairway.percentage).toBe(50)
  })

  it('computes GIR: 1 of 3 (chip-in-regulation rule enforced)', () => {
    expect(dive.gir.attempts).toBe(3)
    expect(dive.gir.successes).toBe(1)
    expect(dive.gir.percentage).toBe(33.3)
  })

  it('computes putts: 5 total across 3 holes', () => {
    expect(dive.putts.total).toBe(5)
    expect(dive.putts.holesCounted).toBe(3)
    expect(dive.putts.perHole).toBeCloseTo(1.6667, 3)
  })

  it('computes scramble 1/2 and sand saves 1/1', () => {
    expect(dive.scramble.attempts).toBe(2)
    expect(dive.scramble.successes).toBe(1)
    expect(dive.scramble.percentage).toBe(50)
    expect(dive.sandSaves.attempts).toBe(1)
    expect(dive.sandSaves.successes).toBe(1)
    expect(dive.sandSaves.percentage).toBe(100)
  })

  it('computes the performance distribution', () => {
    expect(dive.distribution).toEqual({
      eagles: 0,
      birdies: 0,
      pars: 2,
      bogeys: 1,
      doubleBogeys: 0,
      worse: 0,
      total: 3,
    })
  })

  it('builds hole-by-hole momentum', () => {
    expect(dive.momentum).toHaveLength(3)
    expect(dive.momentum[0]).toMatchObject({ holeNumber: 1, scoreVsPar: 0 })
    expect(dive.momentum[1]).toMatchObject({ holeNumber: 2, scoreVsPar: 1 })
    expect(dive.momentum[2]).toMatchObject({ holeNumber: 3, scoreVsPar: 0 })
  })
})

describe('computeRoundDeepDive — degenerate inputs', () => {
  it('returns neutral values for an empty round (never NaN)', () => {
    const empty = playFixtureRound()
    empty.round.shots = []
    empty.round.holes = []
    const dive = computeRoundDeepDive(empty.round)
    expect(dive.holesPlayed).toBe(0)
    expect(dive.totalStrokes).toBe(0)
    expect(dive.scoreText).toBe('E')
    expect(dive.fairway.percentage).toBeNull()
    expect(dive.gir.percentage).toBeNull()
    expect(dive.putts.perHole).toBeNull()
    expect(dive.scramble.percentage).toBeNull()
    expect(dive.distribution.total).toBe(0)
  })
})

describe('formatScoreDiff', () => {
  it('formats E / negative / positive', () => {
    expect(formatScoreDiff(0)).toBe('E')
    expect(formatScoreDiff(-3)).toBe('-3')
    expect(formatScoreDiff(5)).toBe('+5')
  })
})
