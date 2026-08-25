/**
 * Shared test fixture — a three-hole round played through the real wizard.
 *
 * Kept in its own module so analytics tests and service tests reuse the same
 * golden dataset (single source of truth for expected values).
 */
import { createRound } from '../../../../src/domain/models/entities'
import { createActiveRoundState } from '../../../../src/domain/models/roundSession'
import * as actions from '../../../../src/services/round/roundActions'
import { Club, PuttDistance, ShotQuality, ShotResult } from '../../../../src/domain/enums/golf'

export function playFixtureRound() {
  const round = createRound({ courseName: 'Test Course', playerName: 'Golfer' })
  let state = createActiveRoundState(round)

  const P1 = { latitude: 59.329, longitude: 18.068 }
  const P2 = { latitude: 59.33, longitude: 18.07 }
  const P3 = { latitude: 59.331, longitude: 18.072 }
  const P4 = { latitude: 59.332, longitude: 18.074 }

  // --- Hole 1 (par 4): fairway, on in 2, 2 putts -> Par ---
  state = actions.setParForHole(state, 4)
  state = actions.startShot(state, P1)
  state = actions.selectClub(state, Club.DRIVER)
  state = actions.selectQuality(state, ShotQuality.GOOD)
  state = actions.confirmClubAndQuality(state)
  state = actions.selectResult(state, ShotResult.FAIRWAY)
  state = actions.confirmLanding(state)
  state = actions.lockNextPosition(state, P2)
  state = actions.selectClub(state, Club.IRON_7)
  state = actions.confirmClubAndQuality(state)
  state = actions.selectResult(state, ShotResult.GREEN)
  state = actions.confirmLanding(state)
  state = actions.adjustPutts(state, 0)
  state = actions.selectPuttDistance(state, PuttDistance.TWO_TO_4M)
  state = actions.endHole(state)

  // --- Hole 2 (par 3): tee into rough, chip on, 2 putts -> Bogey ---
  state = actions.setParForHole(state, 3)
  state = actions.startShot(state, P1)
  state = actions.selectClub(state, Club.IRON_8)
  state = actions.confirmClubAndQuality(state)
  state = actions.selectResult(state, ShotResult.LEFT_ROUGH)
  state = actions.confirmLanding(state)
  state = actions.switchToChipMode(state, P2)
  state = actions.addChipShot(state, Club.PITCHING_WEDGE, ShotResult.ON_GREEN)
  state = actions.finishChipping(state)
  state = actions.adjustPutts(state, 0)
  state = actions.endHole(state)

  // --- Hole 3 (par 5): rough, fairway, bunker, chip on, 1 putt -> Par ---
  state = actions.setParForHole(state, 5)
  state = actions.startShot(state, P1)
  state = actions.selectClub(state, Club.DRIVER)
  state = actions.confirmClubAndQuality(state)
  state = actions.selectResult(state, ShotResult.LEFT_ROUGH)
  state = actions.confirmLanding(state)
  state = actions.lockNextPosition(state, P2)
  state = actions.selectClub(state, Club.IRON_5)
  state = actions.confirmClubAndQuality(state)
  state = actions.selectResult(state, ShotResult.FAIRWAY)
  state = actions.confirmLanding(state)
  state = actions.lockNextPosition(state, P3)
  state = actions.selectClub(state, Club.SAND_WEDGE)
  state = actions.confirmClubAndQuality(state)
  state = actions.selectResult(state, ShotResult.BUNKER)
  state = actions.confirmLanding(state)
  state = actions.switchToChipMode(state, P4)
  state = actions.addChipShot(state, Club.SAND_WEDGE, ShotResult.ON_GREEN)
  state = actions.finishChipping(state)
  state = actions.adjustPutts(state, -1)
  state = actions.endHole(state)

  return state
}

/**
 * A second, smaller round used by aggregate tests:
 *   Hole 1 (par 4): fairway, GIR on 2, 1 putt  -> Birdie (3 strokes)
 *   Hole 2 (par 4): fairway, missed green, chip, 2 putts -> Bogey (5 strokes)
 * Total: 8 strokes over par 8 (E).
 */
export function buildSecondRound() {
  const round = createRound({ courseName: 'Second Course', playerName: 'Golfer' })
  let state = createActiveRoundState(round)

  const P1 = { latitude: 59.1, longitude: 18.1 }
  const P2 = { latitude: 59.101, longitude: 18.102 }
  const P3 = { latitude: 59.102, longitude: 18.104 }

  state = actions.setParForHole(state, 4)
  state = actions.startShot(state, P1)
  state = actions.selectClub(state, Club.DRIVER)
  state = actions.confirmClubAndQuality(state)
  state = actions.selectResult(state, ShotResult.FAIRWAY)
  state = actions.confirmLanding(state)
  state = actions.lockNextPosition(state, P2)
  state = actions.selectClub(state, Club.IRON_7)
  state = actions.confirmClubAndQuality(state)
  state = actions.selectResult(state, ShotResult.GREEN)
  state = actions.confirmLanding(state)
  state = actions.adjustPutts(state, -1) // 1 putt
  state = actions.endHole(state)

  state = actions.setParForHole(state, 4)
  state = actions.startShot(state, P1)
  state = actions.selectClub(state, Club.DRIVER)
  state = actions.confirmClubAndQuality(state)
  state = actions.selectResult(state, ShotResult.FAIRWAY)
  state = actions.confirmLanding(state)
  state = actions.lockNextPosition(state, P2)
  state = actions.selectClub(state, Club.IRON_7)
  state = actions.confirmClubAndQuality(state)
  state = actions.selectResult(state, ShotResult.LEFT_ROUGH)
  state = actions.confirmLanding(state)
  state = actions.switchToChipMode(state, P3)
  state = actions.addChipShot(state, Club.PITCHING_WEDGE, ShotResult.ON_GREEN)
  state = actions.finishChipping(state)
  state = actions.adjustPutts(state, 0)
  state = actions.endHole(state)

  return state
}
