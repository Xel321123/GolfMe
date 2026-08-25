/**
 * Round wizard actions — pure state transitions for the shot-recording flow.
 *
 * Every function takes a session state and returns a NEW session state
 * (immutable update; nothing is persisted here). The React hook layer calls
 * these and then persists the result, which gives us a clean separation:
 * actions are unit-testable without storage, and persistence is a thin
 * wrapper around them.
 *
 * The flow mirrors the legacy v7.1 wizard:
 * START -> CLUB_QUALITY -> LANDING -> NEXT_ACTION -> (CHIP | GREEN) -> END HOLE
 */
import { createShot, createHoleScore } from '../../domain/models/entities'
import type { LatLng, Round, Shot } from '../../domain/models/entities'
import { RoundStatus } from '../../domain/enums/golf'
import type { ActiveRoundState, StepSelections } from '../../domain/models/roundSession'
import {
  Club,
  PenaltyType,
  PuttDistance,
  RoundStep as RoundStepEnum,
  ShotQuality,
  ShotResult,
} from '../../domain/enums/golf'
import {
  clampHoleNumber,
  computeAllHoleScores,
  isPuttRecord,
} from '../../domain/rules/scoring'
import { haversineDistanceMeters } from '../../domain/utils/geo'

/** Default putt counter value shown by the wizard. */
export const DEFAULT_PUTTS = 2

/** Fresh selection state used when a hole/step is (re)entered. */
export function freshSelections(): StepSelections {
  return { putts: DEFAULT_PUTTS }
}

/** Rebuilds every hole score from the raw shot log, preserving par choices. */
function refreshHoles(round: Round): Round {
  const parMap = new Map(round.holes.map((h) => [h.holeNumber, h.par]))
  const holes = computeAllHoleScores(round.shots, parMap)
  return { ...round, holes }
}

/** Last non-putt shot on a hole (the shot currently being processed). */
function lastOpenShot(state: ActiveRoundState): Shot | undefined {
  const holeShots = state.round.shots
    .filter((s) => s.holeNumber === state.currentHole && !isPuttRecord(s))
    .sort((a, b) => a.shotNumber - b.shotNumber)
  return holeShots[holeShots.length - 1]
}

/** Sets the course name (empty string clears it). */
export function setCourseName(state: ActiveRoundState, name: string): ActiveRoundState {
  return { ...state, round: { ...state.round, courseName: name.trim() } }
}

/**
 * Selects the par for the current hole. Creating the hole record here keeps
 * `round.holes` authoritative for par choices.
 */
export function setParForHole(state: ActiveRoundState, par: number): ActiveRoundState {
  const existing = state.round.holes.find((h) => h.holeNumber === state.currentHole)
  const updatedHoles = existing
    ? state.round.holes.map((h) => (h.holeNumber === state.currentHole ? { ...h, par } : h))
    : [...state.round.holes, createHoleScore(state.currentHole, par)]
  const round = refreshHoles({ ...state.round, holes: updatedHoles })
  return { ...state, round }
}

/**
 * Records the start of a new shot (tee or after locking the previous shot's
 * landing position). Requires a par to have been selected for the hole.
 *
 * @throws {Error} When no par is selected for the current hole.
 */
export function startShot(state: ActiveRoundState, start: LatLng): ActiveRoundState {
  if (!state.round.holes.some((h) => h.holeNumber === state.currentHole)) {
    throw new Error('Select the hole par before recording a shot.')
  }
  const shotNumber =
    state.round.shots.filter((s) => s.holeNumber === state.currentHole && !isPuttRecord(s)).length + 1
  const shot = createShot({
    holeNumber: state.currentHole,
    shotNumber,
    start,
  })
  const round = refreshHoles({ ...state.round, shots: [...state.round.shots, shot] })
  return { ...state, round, activeStep: RoundStepEnum.CLUB_QUALITY, selections: freshSelections() }
}

/** Selects the club for the in-progress shot. */
export function selectClub(state: ActiveRoundState, club: Club): ActiveRoundState {
  return { ...state, selections: { ...state.selections, club } }
}

/** Selects the shot-quality for the in-progress shot. */
export function selectQuality(state: ActiveRoundState, quality: ShotQuality): ActiveRoundState {
  return { ...state, selections: { ...state.selections, quality } }
}

/**
 * Applies club + quality to the in-progress shot and advances to LANDING.
 * Missing selections fall back to sensible defaults (club: undefined stays
 * undefined; quality defaults to GOOD).
 */
export function confirmClubAndQuality(state: ActiveRoundState): ActiveRoundState {
  const last = lastOpenShot(state)
  if (!last) return state
  const updatedShots = state.round.shots.map((s) =>
    s.id === last.id
      ? {
          ...s,
          club: state.selections.club,
          quality: state.selections.quality ?? ShotQuality.GOOD,
        }
      : s
  )
  return {
    ...state,
    round: refreshHoles({ ...state.round, shots: updatedShots }),
    activeStep: RoundStepEnum.LANDING,
    selections: freshSelections(),
  }
}

/** Selects the landing result for the in-progress shot. */
export function selectResult(state: ActiveRoundState, result: ShotResult): ActiveRoundState {
  return { ...state, selections: { ...state.selections, result } }
}

/**
 * Applies the landing result to the in-progress shot. Out-of-bounds and
 * water hazards append a one-stroke penalty shot (flagged, not a "real"
 * swing). Landing on the green jumps straight to the putting view.
 */
export function confirmLanding(state: ActiveRoundState): ActiveRoundState {
  const last = lastOpenShot(state)
  if (!last) return state

  const result = state.selections.result ?? ShotResult.FAIRWAY
  let updatedShots = state.round.shots.map((s) => (s.id === last.id ? { ...s, result } : s))

  let penalty: PenaltyType | undefined
  if (result === ShotResult.OUT_OF_BOUNDS) penalty = PenaltyType.OUT_OF_BOUNDS
  else if (result === ShotResult.WATER) penalty = PenaltyType.WATER_HAZARD

  if (penalty !== undefined) {
    const shotNumber =
      updatedShots.filter((s) => s.holeNumber === state.currentHole && !isPuttRecord(s)).length + 1
    updatedShots = [
      ...updatedShots,
      createShot({
        holeNumber: state.currentHole,
        shotNumber,
        penalty,
        quality: ShotQuality.PENALTY,
        start: last.start,
        distanceMeters: 0,
      }),
    ]
  }

  const nextStep =
    result === ShotResult.GREEN ? RoundStepEnum.GREEN : RoundStepEnum.NEXT_ACTION

  return {
    ...state,
    round: refreshHoles({ ...state.round, shots: updatedShots }),
    activeStep: nextStep,
    selections: freshSelections(),
  }
}

/**
 * Closes the in-progress shot's landing position (GPS point + computed
 * distance), leaving the wizard state otherwise unchanged.
 */
export function closeLastShotDistance(state: ActiveRoundState, end: LatLng): ActiveRoundState {
  const last = lastOpenShot(state)
  if (!last || !last.start) return state
  const distanceMeters = haversineDistanceMeters(last.start, end)
  const updatedShots = state.round.shots.map((s) =>
    s.id === last.id ? { ...s, end, distanceMeters } : s
  )
  return { ...state, round: refreshHoles({ ...state.round, shots: updatedShots }) }
}

/**
 * Locks the in-progress shot's landing position AND starts the next shot
 * from that same position (the "lock next position" flow).
 */
export function lockNextPosition(state: ActiveRoundState, position: LatLng): ActiveRoundState {
  const closed = closeLastShotDistance(state, position)
  return startShot(closed, position)
}

/**
 * Closes the in-progress shot's landing position and enters the chipping
 * editor (used when the player walks to the ball instead of hitting next).
 */
export function switchToChipMode(state: ActiveRoundState, position: LatLng): ActiveRoundState {
  const closed = closeLastShotDistance(state, position)
  return { ...closed, activeStep: RoundStepEnum.CHIP, selections: freshSelections() }
}

/**
 * Closes the in-progress shot's landing position and enters the putting
 * view (used when the ball is on or next to the green).
 */
export function switchToGreenMode(state: ActiveRoundState, position: LatLng): ActiveRoundState {
  const closed = closeLastShotDistance(state, position)
  return { ...closed, activeStep: RoundStepEnum.GREEN, selections: freshSelections() }
}

/**
 * Adds a chip/pitch shot (entered manually in the chipping editor).
 *
 * @param club - Club used for the chip.
 * @param result - Where the chip ended (e.g. ON_GREEN, IN_BUNKER, IN_ROUGH).
 */
export function addChipShot(
  state: ActiveRoundState,
  club: Club,
  result: ShotResult
): ActiveRoundState {
  const shotNumber =
    state.round.shots.filter((s) => s.holeNumber === state.currentHole && !isPuttRecord(s)).length + 1
  const chip = createShot({
    holeNumber: state.currentHole,
    shotNumber,
    club,
    quality: ShotQuality.CHIP,
    result,
    distanceMeters: 0,
  })
  return {
    ...state,
    round: refreshHoles({ ...state.round, shots: [...state.round.shots, chip] }),
    selections: { ...freshSelections(), chipClub: club, chipResult: result },
  }
}

/** Exits the chipping editor and enters the putting view. */
export function finishChipping(state: ActiveRoundState): ActiveRoundState {
  return { ...state, activeStep: RoundStepEnum.GREEN, selections: freshSelections() }
}

/** Adjusts the putt counter (clamped at zero). */
export function adjustPutts(state: ActiveRoundState, delta: number): ActiveRoundState {
  const putts = Math.max(0, state.selections.putts + delta)
  return { ...state, selections: { ...state.selections, putts } }
}

/** Selects the first-putt distance bucket. */
export function selectPuttDistance(state: ActiveRoundState, distance: PuttDistance): ActiveRoundState {
  return { ...state, selections: { ...state.selections, puttDistance: distance } }
}

/**
 * Completes the current hole: appends the putt record, recomputes the hole
 * score, advances to the next hole, and resets the wizard.
 */
export function endHole(state: ActiveRoundState): ActiveRoundState {
  const shotNumber =
    state.round.shots.filter((s) => s.holeNumber === state.currentHole && !isPuttRecord(s)).length + 1
  const puttRecord = createShot({
    holeNumber: state.currentHole,
    shotNumber,
    club: Club.PUTTER,
    quality: ShotQuality.PUTTING,
    isPutt: true,
    putts: state.selections.putts,
    puttDistance: state.selections.puttDistance,
  })
  const round = refreshHoles({ ...state.round, shots: [...state.round.shots, puttRecord] })
  return {
    ...state,
    round,
    currentHole: clampHoleNumber(state.currentHole + 1),
    activeStep: RoundStepEnum.START,
    selections: freshSelections(),
  }
}

/**
 * Steps the wizard backwards (legacy "undo" behavior):
 * - CLUB_QUALITY -> START, removing the just-started (unfinished) shot.
 * - LANDING -> CLUB_QUALITY.
 * - NEXT_ACTION -> LANDING.
 * - CHIP/GREEN -> LANDING.
 * - START -> removes the last shot of the round (caller confirms in UI).
 */
export function undoAction(state: ActiveRoundState): ActiveRoundState {
  const { activeStep } = state

  if (activeStep !== RoundStepEnum.START) {
    let nextStep = RoundStepEnum.START
    if (activeStep === RoundStepEnum.LANDING) nextStep = RoundStepEnum.CLUB_QUALITY
    else if (activeStep === RoundStepEnum.NEXT_ACTION) nextStep = RoundStepEnum.LANDING
    else if (activeStep === RoundStepEnum.CHIP || activeStep === RoundStepEnum.GREEN) {
      nextStep = RoundStepEnum.LANDING
    }

    let shots = state.round.shots
    if (nextStep === RoundStepEnum.START) {
      const last = lastOpenShot(state)
      if (last && last.end === undefined) {
        shots = shots.filter((s) => s.id !== last.id)
      }
    }
    return {
      ...state,
      round: refreshHoles({ ...state.round, shots }),
      activeStep: nextStep,
      selections: freshSelections(),
    }
  }

  if (state.round.shots.length === 0) return state
  const last = state.round.shots[state.round.shots.length - 1]
  if (last === undefined) return state
  return {
    ...state,
    round: refreshHoles({ ...state.round, shots: state.round.shots.filter((s) => s.id !== last.id) }),
  }
}

/** Navigates to an adjacent hole (clamped 1-18), resetting the wizard. */
export function changeHole(state: ActiveRoundState, delta: number): ActiveRoundState {
  return {
    ...state,
    currentHole: clampHoleNumber(state.currentHole + delta),
    activeStep: RoundStepEnum.START,
    selections: freshSelections(),
  }
}

/** Clears every shot and hole record from the active round. */
export function clearRoundShots(state: ActiveRoundState): ActiveRoundState {
  return {
    ...state,
    round: { ...state.round, shots: [], holes: [] },
    currentHole: 1,
    activeStep: RoundStepEnum.START,
    selections: freshSelections(),
  }
}

/** Marks the round as completed in-memory (used before archiving). */
export function markRoundCompleted(round: Round): Round {
  return {
    ...round,
    status: RoundStatus.COMPLETED,
    completedAt: new Date().toISOString(),
  }
}
