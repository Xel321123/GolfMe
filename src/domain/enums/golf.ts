/**
 * GolfMe domain enumerations.
 *
 * Every enum lives in this single module so that UI labels, storage
 * serialization, and analytics can all reference the same canonical keys.
 * Values are stable string codes (not numeric indices) so persisted payloads
 * survive reordering of members across schema versions.
 */

/** Clubs supported by the tracker, from driver to putter. */
export enum Club {
  DRIVER = 'DRIVER',
  WOOD_3 = 'WOOD_3',
  HYBRID_4 = 'HYBRID_4',
  IRON_5 = 'IRON_5',
  IRON_6 = 'IRON_6',
  IRON_7 = 'IRON_7',
  IRON_8 = 'IRON_8',
  IRON_9 = 'IRON_9',
  PITCHING_WEDGE = 'PITCHING_WEDGE',
  GAP_WEDGE = 'GAP_WEDGE',
  SAND_WEDGE = 'SAND_WEDGE',
  LOB_WEDGE = 'LOB_WEDGE',
  PUTTER = 'PUTTER',
}

/** Qualitative description of how a full swing was struck. */
export enum ShotQuality {
  GOOD = 'GOOD',
  THIN = 'THIN',
  SLICE = 'SLICE',
  HOOK = 'HOOK',
  PENALTY = 'PENALTY',
  CHIP = 'CHIP',
  PUTTING = 'PUTTING',
}

/**
 * Where a shot ended up. `ON_GREEN`, `IN_BUNKER` and `IN_ROUGH` describe the
 * outcome of short-game (chip/pitch) shots; the remaining values describe
 * full-swing landings. Kept as one enum so analytics can treat "reached the
 * green" uniformly (`GREEN` or `ON_GREEN`).
 */
export enum ShotResult {
  FAIRWAY = 'FAIRWAY',
  GREEN = 'GREEN',
  LEFT_ROUGH = 'LEFT_ROUGH',
  RIGHT_ROUGH = 'RIGHT_ROUGH',
  BUNKER = 'BUNKER',
  OUT_OF_BOUNDS = 'OUT_OF_BOUNDS',
  WATER = 'WATER',
  ON_GREEN = 'ON_GREEN',
  IN_BUNKER = 'IN_BUNKER',
  IN_ROUGH = 'IN_ROUGH',
}

/**
 * One-stroke penalty types. Penalty strokes are real strokes (they count in
 * the score) but are flagged so analytics can exclude them from statistics
 * such as FIR/GIR attempts.
 */
export enum PenaltyType {
  OUT_OF_BOUNDS = 'OUT_OF_BOUNDS',
  WATER_HAZARD = 'WATER_HAZARD',
}

/** Coarse bucket for the length of the first putt on a hole. */
export enum PuttDistance {
  UNDER_2M = 'UNDER_2M',
  TWO_TO_4M = 'TWO_TO_4M',
  FIVE_TO_8M = 'FIVE_TO_8M',
  OVER_8M = 'OVER_8M',
}

/** Steps of the per-shot recording wizard (ported from legacy v7.1 flow). */
export enum RoundStep {
  START = 'START',
  CLUB_QUALITY = 'CLUB_QUALITY',
  LANDING = 'LANDING',
  NEXT_ACTION = 'NEXT_ACTION',
  CHIP = 'CHIP',
  GREEN = 'GREEN',
}

/** Lifecycle status of a round. */
export enum RoundStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

/** Lifecycle status of an individual hole. */
export enum HoleStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

/**
 * Score category of a hole relative to par. `EAGLE_OR_BETTER` covers eagles,
 * albatrosses and holes-in-one; `WORSE` covers anything above double bogey.
 * Distribution analytics group holes by this category.
 */
export enum ScoreCategory {
  EAGLE_OR_BETTER = 'EAGLE_OR_BETTER',
  BIRDIE = 'BIRDIE',
  PAR = 'PAR',
  BOGEY = 'BOGEY',
  DOUBLE_BOGEY = 'DOUBLE_BOGEY',
  WORSE = 'WORSE',
}
