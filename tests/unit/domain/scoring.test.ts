/**
 * Unit tests — domain scoring rules + wizard flow integration.
 */
import { describe, expect, it } from 'vitest'
import { ScoreCategory, RoundStatus } from '../../../src/domain/enums/golf'
import { createRound } from '../../../src/domain/models/entities'
import type { Shot } from '../../../src/domain/models/entities'
import { createActiveRoundState } from '../../../src/domain/models/roundSession'
import {
  categorizeScore,
  computeHoleScore,
  fairwayOutcome,
  isGreenInRegulation,
  scoreVsPar,
  strokesForHole,
} from '../../../src/domain/rules/scoring'
import * as actions from '../../../src/services/round/roundActions'
import { Club, PenaltyType, ShotQuality, ShotResult } from '../../../src/domain/enums/golf'
import { playFixtureRound } from '../analytics/fixtures/roundFixture'

describe('scoreVsPar', () => {
  it('computes the score delta correctly', () => {
    expect(scoreVsPar(4, 4)).toBe(0)
    expect(scoreVsPar(3, 4)).toBe(-1)
    expect(scoreVsPar(6, 4)).toBe(2)
  })
})

describe('categorizeScore', () => {
  it('maps every delta to the right category', () => {
    expect(categorizeScore(-3)).toBe(ScoreCategory.EAGLE_OR_BETTER)
    expect(categorizeScore(-2)).toBe(ScoreCategory.EAGLE_OR_BETTER)
    expect(categorizeScore(-1)).toBe(ScoreCategory.BIRDIE)
    expect(categorizeScore(0)).toBe(ScoreCategory.PAR)
    expect(categorizeScore(1)).toBe(ScoreCategory.BOGEY)
    expect(categorizeScore(2)).toBe(ScoreCategory.DOUBLE_BOGEY)
    expect(categorizeScore(5)).toBe(ScoreCategory.WORSE)
  })
})

/** Minimal shot builder for rule-level tests. */
function shot(overrides: Partial<Shot>): Shot {
  return {
    id: `s-${Math.random()}`,
    holeNumber: 1,
    shotNumber: 1,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('strokesForHole', () => {
  it('counts swings + penalties + putts, but not the putt record itself', () => {
    const shots: Shot[] = [
      shot({ shotNumber: 1, club: Club.DRIVER }),
      shot({ shotNumber: 2, penalty: PenaltyType.OUT_OF_BOUNDS, quality: ShotQuality.PENALTY }),
      shot({ shotNumber: 3, club: Club.SAND_WEDGE, result: ShotResult.GREEN }),
      shot({ shotNumber: 4, isPutt: true, putts: 2 }),
    ]
    // 3 swings (incl. penalty) + 2 putts = 5
    expect(strokesForHole(shots, 1)).toBe(5)
  })

  it('returns 0 for an empty hole', () => {
    expect(strokesForHole([], 3)).toBe(0)
  })
})

describe('isGreenInRegulation', () => {
  it('credits GIR when the ball reaches the green within par - 2', () => {
    const shots: Shot[] = [
      shot({ shotNumber: 1, club: Club.DRIVER }),
      shot({ shotNumber: 2, club: Club.IRON_7, result: ShotResult.GREEN }),
    ]
    expect(isGreenInRegulation(shots, 1, 4)).toBe(true)
  })

  it('does NOT credit GIR when the green is reached after regulation strokes', () => {
    const shots: Shot[] = [
      shot({ shotNumber: 1, club: Club.DRIVER, result: ShotResult.FAIRWAY }),
      shot({ shotNumber: 2, club: Club.IRON_5, result: ShotResult.LEFT_ROUGH }),
      shot({ shotNumber: 3, club: Club.SAND_WEDGE, result: ShotResult.ON_GREEN }),
    ]
    // Par 4: regulation = 2 strokes; green reached on stroke 3.
    expect(isGreenInRegulation(shots, 1, 4)).toBe(false)
  })

  it('credits chip-onto-green (ON_GREEN) within regulation', () => {
    const shots: Shot[] = [
      shot({ shotNumber: 1, club: Club.DRIVER, result: ShotResult.FAIRWAY }),
      shot({ shotNumber: 2, club: Club.PITCHING_WEDGE, quality: ShotQuality.CHIP, result: ShotResult.ON_GREEN }),
    ]
    expect(isGreenInRegulation(shots, 1, 4)).toBe(true)
  })

  it('never counts penalty strokes as green evidence', () => {
    const shots: Shot[] = [
      shot({ shotNumber: 1, penalty: PenaltyType.WATER_HAZARD, quality: ShotQuality.PENALTY }),
      shot({ shotNumber: 2, club: Club.IRON_7, result: ShotResult.GREEN }),
    ]
    // Par 3: regulation = 1 stroke; green reached on stroke 2.
    expect(isGreenInRegulation(shots, 1, 3)).toBe(false)
  })
})

describe('fairwayOutcome', () => {
  it('returns undefined for par 3 holes', () => {
    const shots: Shot[] = [shot({ shotNumber: 1, result: ShotResult.FAIRWAY })]
    expect(fairwayOutcome(shots, 1, 3)).toBeUndefined()
  })

  it('returns true/false based on the tee shot result', () => {
    const hit: Shot[] = [shot({ shotNumber: 1, result: ShotResult.FAIRWAY })]
    const miss: Shot[] = [shot({ shotNumber: 1, result: ShotResult.LEFT_ROUGH })]
    expect(fairwayOutcome(hit, 1, 4)).toBe(true)
    expect(fairwayOutcome(miss, 1, 4)).toBe(false)
  })

  it('returns undefined when the tee landing was never recorded', () => {
    const shots: Shot[] = [shot({ shotNumber: 1 })]
    expect(fairwayOutcome(shots, 1, 4)).toBeUndefined()
  })
})

describe('computeHoleScore — full hole semantics', () => {
  it('marks a hole completed with a scramble and sand save when up-and-down', () => {
    const shots: Shot[] = [
      shot({ holeNumber: 5, shotNumber: 1, result: ShotResult.LEFT_ROUGH }),
      shot({ holeNumber: 5, shotNumber: 2, result: ShotResult.FAIRWAY }),
      shot({ holeNumber: 5, shotNumber: 3, result: ShotResult.BUNKER }),
      shot({ holeNumber: 5, shotNumber: 4, quality: ShotQuality.CHIP, result: ShotResult.ON_GREEN }),
      shot({ holeNumber: 5, shotNumber: 5, isPutt: true, putts: 1 }),
    ]
    const score = computeHoleScore(shots, 5, 5)
    expect(score.strokes).toBe(5)
    expect(score.putts).toBe(1)
    expect(score.greenInRegulation).toBe(false)
    expect(score.scramble).toBe(true) // 5 <= par 5 without GIR
    expect(score.sandSave).toBe(true) // bunker seen, 5 <= par 5
    expect(score.status).toBe('COMPLETED')
  })

  it('leaves scramble/sandSave undefined when the situation never arose', () => {
    const shots: Shot[] = [
      shot({ shotNumber: 1, result: ShotResult.FAIRWAY }),
      shot({ shotNumber: 2, result: ShotResult.GREEN }),
      shot({ shotNumber: 3, isPutt: true, putts: 2 }),
    ]
    const score = computeHoleScore(shots, 1, 4)
    expect(score.greenInRegulation).toBe(true) // on in 2
    expect(score.scramble).toBeUndefined() // GIR achieved — no scramble situation
    expect(score.sandSave).toBeUndefined() // no bunker
    expect(score.status).toBe('COMPLETED')
  })
})

describe('round wizard flow (integration)', () => {
  it('plays three holes with correct strokes, par, GIR, scramble and sand save', () => {
    const state = playFixtureRound()
    const { round } = state

    expect(round.shots).toHaveLength(11) // 2+2+4 swings + 3 putt records
    expect(round.holes).toHaveLength(3)

    const [h1, h2, h3] = round.holes
    expect(h1).toBeDefined()
    expect(h2).toBeDefined()
    expect(h3).toBeDefined()
    expect(h1!.strokes).toBe(4) // par 4
    expect(h1!.greenInRegulation).toBe(true)
    expect(h1!.fairwayHit).toBe(true)
    expect(h1!.scramble).toBeUndefined()

    expect(h2!.strokes).toBe(4) // par 3 + 1
    expect(h2!.greenInRegulation).toBe(false) // chip on stroke 2 > limit 1
    expect(h2!.fairwayHit).toBeUndefined() // par 3
    expect(h2!.scramble).toBe(false) // 4 > 3

    expect(h3!.strokes).toBe(5) // par 5
    expect(h3!.greenInRegulation).toBe(false)
    expect(h3!.fairwayHit).toBe(false)
    expect(h3!.scramble).toBe(true) // up-and-down
    expect(h3!.sandSave).toBe(true)

    // Current hole advanced to 4 and wizard reset.
    expect(state.currentHole).toBe(4)
    expect(state.round.status).toBe(RoundStatus.IN_PROGRESS)
  })

  it('persists the wizard position so a reload can restore it', () => {
    const state = playFixtureRound()
    const before = JSON.parse(JSON.stringify(state))
    expect(before.currentHole).toBe(4)
    expect(before.activeStep).toBe('START')
  })

  it('startShot throws when no par has been selected', () => {
    const round = createRound({ courseName: 'X', playerName: 'Golfer' })
    const state = createActiveRoundState(round)
    expect(() => actions.startShot(state, { latitude: 0, longitude: 0 })).toThrow(
      /Select the hole par/
    )
  })
})
