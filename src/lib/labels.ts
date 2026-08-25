/**
 * English UI label maps for domain enums.
 *
 * The domain layer stores canonical enum codes; the UI layer translates them
 * for display. Keeping labels here (instead of in the domain) preserves the
 * framework-agnostic core and makes localization a single-file change.
 */
import {
  Club,
  PuttDistance,
  ScoreCategory,
  ShotQuality,
  ShotResult,
} from '../domain/enums/golf'

export const CLUB_LABELS: Record<Club, string> = {
  [Club.DRIVER]: 'Driver',
  [Club.WOOD_3]: '3 Wood',
  [Club.HYBRID_4]: '4 Hybrid',
  [Club.IRON_5]: '5 Iron',
  [Club.IRON_6]: '6 Iron',
  [Club.IRON_7]: '7 Iron',
  [Club.IRON_8]: '8 Iron',
  [Club.IRON_9]: '9 Iron',
  [Club.PITCHING_WEDGE]: 'PW',
  [Club.GAP_WEDGE]: 'GW',
  [Club.SAND_WEDGE]: 'SW',
  [Club.LOB_WEDGE]: 'LW',
  [Club.PUTTER]: 'Putter',
}

export const QUALITY_LABELS: Record<ShotQuality, string> = {
  [ShotQuality.GOOD]: 'Good',
  [ShotQuality.THIN]: 'Thin',
  [ShotQuality.SLICE]: 'Slice',
  [ShotQuality.HOOK]: 'Hook',
  [ShotQuality.PENALTY]: 'Penalty',
  [ShotQuality.CHIP]: 'Chip',
  [ShotQuality.PUTTING]: 'Putting',
}

export const RESULT_LABELS: Record<ShotResult, string> = {
  [ShotResult.FAIRWAY]: 'Fairway',
  [ShotResult.GREEN]: 'Green',
  [ShotResult.LEFT_ROUGH]: 'Rough (Left)',
  [ShotResult.RIGHT_ROUGH]: 'Rough (Right)',
  [ShotResult.BUNKER]: 'Bunker',
  [ShotResult.OUT_OF_BOUNDS]: 'Out of Bounds',
  [ShotResult.WATER]: 'Water Hazard',
  [ShotResult.ON_GREEN]: 'On Green',
  [ShotResult.IN_BUNKER]: 'In Bunker',
  [ShotResult.IN_ROUGH]: 'In Rough',
}

export const PUTT_DISTANCE_LABELS: Record<PuttDistance, string> = {
  [PuttDistance.UNDER_2M]: '<2m',
  [PuttDistance.TWO_TO_4M]: '2-4m',
  [PuttDistance.FIVE_TO_8M]: '5-8m',
  [PuttDistance.OVER_8M]: '8m+',
}

export const SCORE_CATEGORY_LABELS: Record<ScoreCategory, string> = {
  [ScoreCategory.EAGLE_OR_BETTER]: 'Eagle+',
  [ScoreCategory.BIRDIE]: 'Birdie',
  [ScoreCategory.PAR]: 'Par',
  [ScoreCategory.BOGEY]: 'Bogey',
  [ScoreCategory.DOUBLE_BOGEY]: 'Double Bogey',
  [ScoreCategory.WORSE]: 'Worse',
}

/** Standard club lineup shown in the club pickers. */
export const CLUB_LINEUP: Club[] = [
  Club.DRIVER,
  Club.WOOD_3,
  Club.HYBRID_4,
  Club.IRON_5,
  Club.IRON_6,
  Club.IRON_7,
  Club.IRON_8,
  Club.IRON_9,
  Club.PITCHING_WEDGE,
  Club.GAP_WEDGE,
  Club.SAND_WEDGE,
  Club.LOB_WEDGE,
]

/** Short-game clubs available in the chipping editor. */
export const CHIP_CLUB_LINEUP: Club[] = [
  Club.PITCHING_WEDGE,
  Club.GAP_WEDGE,
  Club.SAND_WEDGE,
  Club.LOB_WEDGE,
  Club.IRON_8,
  Club.PUTTER,
]
