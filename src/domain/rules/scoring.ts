/**
 * Golf scoring rules — pure, total functions.
 *
 * Everything here is deterministic and side-effect free, which makes the
 * rules trivially unit-testable and safe to reuse verbatim in React Native.
 *
 * Terminology / decisions (documented because several correct the legacy
 * implementation):
 * - Strokes per hole = full-swing/penalty/chip shots + putts. The closing
 *   putt *record* (`isPutt: true`) is not itself an extra stroke — its
 *   `putts` field carries the stroke count.
 * - GIR requires *evidence* that the ball reached the green within
 *   `par - 2` strokes (`ShotResult.GREEN` or `ShotResult.ON_GREEN`). The
 *   legacy app incorrectly credited GIR whenever the stroke count was low
 *   enough, even if the ball was never on the green.
 * - Penalty strokes count toward the score but never count as green/fairway
 *   evidence.
 * - Scramble and sand-save are only computed for completed holes and are
 *   `undefined` (not `false`) when the situation never arose, so aggregates
 *   can distinguish "0 for N" from "not applicable".
 */
import { ScoreCategory, HoleStatus, RoundStatus, ShotResult } from '../enums/golf'
import type { HoleScore, Round, Shot } from '../models/entities'

/**
 * Returns the score relative to par (e.g. `-1` for a birdie, `+2` for a
 * double bogey, `0` for par).
 *
 * @param strokes - Total strokes taken on the hole/round.
 * @param par - Course par for the hole/round.
 * @returns `strokes - par`.
 */
export function scoreVsPar(strokes: number, par: number): number {
  return strokes - par
}

/**
 * Maps a score vs par to its {@link ScoreCategory}.
 *
 * @param scoreDiff - Value from {@link scoreVsPar}.
 * @returns The matching category; anything below -1 (eagle or better) and
 *          anything above +2 (worse than double bogey) are collapsed.
 */
export function categorizeScore(scoreDiff: number): ScoreCategory {
  if (scoreDiff <= -2) return ScoreCategory.EAGLE_OR_BETTER
  if (scoreDiff === -1) return ScoreCategory.BIRDIE
  if (scoreDiff === 0) return ScoreCategory.PAR
  if (scoreDiff === 1) return ScoreCategory.BOGEY
  if (scoreDiff === 2) return ScoreCategory.DOUBLE_BOGEY
  return ScoreCategory.WORSE
}

/** Returns `true` when the shot is a flagged penalty stroke. */
export function isPenaltyShot(shot: Shot): boolean {
  return shot.penalty !== undefined
}

/** Returns `true` when the shot is the hole-closing putt record. */
export function isPuttRecord(shot: Shot): boolean {
  return shot.isPutt === true
}

/** Returns `true` when the shot is a chip/pitch (short-game) shot. */
export function isChipShot(shot: Shot): boolean {
  return shot.quality === 'CHIP'
}

/**
 * Counts the total strokes for a hole from its raw shot log.
 *
 * @param shots - All shots in the round (filtering happens internally).
 * @param holeNumber - The hole to count.
 * @returns Total strokes including penalties and putts; `0` for empty holes.
 */
export function strokesForHole(shots: readonly Shot[], holeNumber: number): number {
  const holeShots = shots.filter((s) => s.holeNumber === holeNumber)
  const fullSwings = holeShots.filter((s) => !isPuttRecord(s)).length
  const putts = holeShots.find((s) => isPuttRecord(s))?.putts ?? 0
  return fullSwings + putts
}

/**
 * Determines whether the ball reached the green within regulation strokes.
 *
 * @param shots - All shots in the round.
 * @param holeNumber - Hole to evaluate.
 * @param par - Par of the hole.
 * @returns `true` when a non-penalty shot with result `GREEN`/`ON_GREEN`
 *          exists at stroke number <= `par - 2`; `false` otherwise.
 */
export function isGreenInRegulation(
  shots: readonly Shot[],
  holeNumber: number,
  par: number
): boolean {
  const regulationLimit = par - 2
  if (regulationLimit <= 0) return false
  const holeShots = shots
    .filter((s) => s.holeNumber === holeNumber && !isPenaltyShot(s) && !isPuttRecord(s))
    .sort((a, b) => a.shotNumber - b.shotNumber)
  return holeShots.some(
    (s) =>
      (s.result === ShotResult.GREEN || s.result === ShotResult.ON_GREEN) &&
      s.shotNumber <= regulationLimit
  )
}

/**
 * Determines the fairway outcome for the hole's tee shot.
 *
 * @param shots - All shots in the round.
 * @param holeNumber - Hole to evaluate.
 * @param par - Par of the hole.
 * @returns `true` for a hit fairway, `false` for a miss; `undefined` when the
 *          hole is a par 3 (fairway not applicable) or the tee-shot landing
 *          was never recorded (so it cannot be credited).
 */
export function fairwayOutcome(
  shots: readonly Shot[],
  holeNumber: number,
  par: number
): boolean | undefined {
  if (par <= 3) return undefined
  const teeShot = shots.find(
    (s) => s.holeNumber === holeNumber && s.shotNumber === 1 && !isPenaltyShot(s)
  )
  if (!teeShot || teeShot.result === undefined) return undefined
  return teeShot.result === ShotResult.FAIRWAY
}

/**
 * Whether the player reached the green from sand at any point on the hole.
 *
 * @param shots - All shots in the round.
 * @param holeNumber - Hole to evaluate.
 * @returns `true` when any non-penalty shot landed in a bunker.
 */
export function holeSawBunker(shots: readonly Shot[], holeNumber: number): boolean {
  return shots.some(
    (s) =>
      s.holeNumber === holeNumber &&
      !isPenaltyShot(s) &&
      (s.result === ShotResult.BUNKER || s.result === ShotResult.IN_BUNKER)
  )
}

/**
 * Computes the aggregated {@link HoleScore} for one hole.
 *
 * @param shots - All shots in the round.
 * @param holeNumber - Hole to evaluate.
 * @param par - Par of the hole.
 * @returns A fully populated hole score. `scramble`/`sandSave` are `undefined`
 *          when the situation never arose; `fairwayHit` is `undefined` for
 *          par 3s and unrecorded tee shots; `status` is `COMPLETED` once a
 *          putt record exists for the hole.
 */
export function computeHoleScore(
  shots: readonly Shot[],
  holeNumber: number,
  par: number
): HoleScore {
  const holeShots = shots.filter((s) => s.holeNumber === holeNumber)
  const puttRecord = holeShots.find((s) => isPuttRecord(s))
  const strokes = strokesForHole(shots, holeNumber)
  const gir = isGreenInRegulation(shots, holeNumber, par)
  const fir = fairwayOutcome(shots, holeNumber, par)
  const completed = puttRecord !== undefined

  let scramble: boolean | undefined
  let sandSave: boolean | undefined
  if (completed) {
    if (!gir) scramble = strokes <= par
    if (holeSawBunker(shots, holeNumber)) sandSave = strokes <= par
  }

  return {
    holeNumber,
    par,
    strokes,
    putts: puttRecord?.putts ?? 0,
    firstPuttDistance: puttRecord?.puttDistance,
    fairwayHit: fir,
    greenInRegulation: gir,
    sandSave,
    scramble,
    status: completed ? HoleStatus.COMPLETED : HoleStatus.IN_PROGRESS,
  }
}

/**
 * Recomputes the hole-score table for the entire round.
 *
 * @param shots - The round's raw shot log.
 * @param holePars - Map of hole number -> par (missing holes are treated as
 *                   par 4 and marked with the hole's actual strokes).
 * @returns An array of hole scores for every hole referenced in `holePars`,
 *          ordered by hole number.
 */
export function computeAllHoleScores(
  shots: readonly Shot[],
  holePars: ReadonlyMap<number, number>
): HoleScore[] {
  const scores: HoleScore[] = []
  for (const [holeNumber, par] of [...holePars.entries()].sort((a, b) => a[0] - b[0])) {
    scores.push(computeHoleScore(shots, holeNumber, par))
  }
  return scores
}

/**
 * Sums the par of all holes that have at least one recorded shot.
 *
 * @param round - The round.
 * @returns Total par, or `0` when no holes are recorded.
 */
export function totalParOfPlayedHoles(round: Round): number {
  const played = round.holes.filter((h) => h.strokes > 0 || h.status === HoleStatus.COMPLETED)
  return played.reduce((sum, h) => sum + h.par, 0)
}

/** Returns `true` when the round is still in progress. */
export function isRoundInProgress(round: Round): boolean {
  return round.status === RoundStatus.IN_PROGRESS
}

/**
 * Clamps a hole number into the valid 1-18 range.
 *
 * @param holeNumber - Requested hole number.
 * @returns A hole number between 1 and 18 inclusive.
 */
export function clampHoleNumber(holeNumber: number): number {
  return Math.min(Math.max(Math.trunc(holeNumber), 1), 18)
}

/**
 * Builds a par lookup for a hole, preferring an existing hole record and
 * falling back to a sane default.
 *
 * @param round - The round.
 * @param holeNumber - Hole to look up.
 * @param fallbackPar - Par to use when the hole has no record (default 4).
 * @returns The hole's par.
 */
export function parForHole(round: Round, holeNumber: number, fallbackPar = 4): number {
  return round.holes.find((h) => h.holeNumber === holeNumber)?.par ?? fallbackPar
}
