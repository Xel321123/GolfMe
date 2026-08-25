/**
 * Core domain entities and their zod validation schemas.
 *
 * These schemas are the single source of truth for the persisted data
 * contract (schema v2). Every payload read from storage is validated against
 * them; every entity created in memory is validated by its factory. The
 * schema keeps the app resilient to corrupted cache and acts as the migration
 * baseline for future schema versions.
 */
import { z } from 'zod'
import {
  Club,
  HoleStatus,
  PenaltyType,
  PuttDistance,
  RoundStatus,
  ShotQuality,
  ShotResult,
} from '../enums/golf'
import { generateId } from '../utils/ids'

/** GPS coordinate pair with optional reported accuracy. */
export const latLngSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().int().nonnegative().optional(),
})
export type LatLng = z.infer<typeof latLngSchema>

/**
 * A single recorded shot (or stroke-accounting record) within a round.
 *
 * Semantics:
 * - Full swings carry `club`, `quality`, `result` and optional GPS start/end.
 * - Penalty strokes carry `penalty` and are included in the stroke count but
 *   excluded from FIR/GIR statistics.
 * - The hole-closing putt record is a shot with `isPutt: true` whose `putts`
 *   field holds the total number of putts taken on the hole. It is NOT
 *   counted as an extra stroke (the putts value represents the strokes).
 */
export const shotSchema = z.object({
  id: z.string().min(1),
  holeNumber: z.number().int().min(1).max(18),
  shotNumber: z.number().int().min(1),
  club: z.nativeEnum(Club).optional(),
  quality: z.nativeEnum(ShotQuality).optional(),
  result: z.nativeEnum(ShotResult).optional(),
  start: latLngSchema.optional(),
  end: latLngSchema.optional(),
  distanceMeters: z.number().int().nonnegative().optional(),
  penalty: z.nativeEnum(PenaltyType).optional(),
  isPutt: z.boolean().optional(),
  putts: z.number().int().min(0).optional(),
  puttDistance: z.nativeEnum(PuttDistance).optional(),
  createdAt: z.string().datetime(),
})
export type Shot = z.infer<typeof shotSchema>

/** Aggregated scoring result for a single hole. */
export const holeScoreSchema = z.object({
  holeNumber: z.number().int().min(1).max(18),
  par: z.number().int().min(3).max(5),
  strokes: z.number().int().nonnegative(),
  putts: z.number().int().min(0),
  firstPuttDistance: z.nativeEnum(PuttDistance).optional(),
  /** `true` = fairway hit, `false` = missed, `undefined` = N/A (par 3) or unrecorded. */
  fairwayHit: z.boolean().optional(),
  greenInRegulation: z.boolean().optional(),
  sandSave: z.boolean().optional(),
  scramble: z.boolean().optional(),
  status: z.nativeEnum(HoleStatus),
})
export type HoleScore = z.infer<typeof holeScoreSchema>

/** Course metadata. Rating/slope are optional because legacy data lacks them. */
export const courseSchema = z.object({
  name: z.string().trim().min(1, 'Course name is required'),
  rating: z.number().positive().optional(),
  slope: z.number().int().min(55).max(155).optional(),
})
export type Course = z.infer<typeof courseSchema>

/** A golfer participating in a round (multi-player ready). */
export const playerSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, 'Player name is required'),
})
export type Player = z.infer<typeof playerSchema>

/** A complete round: course context, hole results and raw shot log. */
export const roundSchema = z.object({
  id: z.string().min(1),
  courseName: z.string().trim().min(1, 'Course name is required'),
  courseRating: z.number().positive().optional(),
  courseSlope: z.number().int().min(55).max(155).optional(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  status: z.nativeEnum(RoundStatus),
  players: z.array(playerSchema).min(1),
  holes: z.array(holeScoreSchema),
  shots: z.array(shotSchema),
  schemaVersion: z.literal(2),
})
export type Round = z.infer<typeof roundSchema>

/** Creates a shot with sane defaults; throws on invalid input. */
export function createShot(input: {
  holeNumber: number
  shotNumber: number
  club?: Club
  quality?: ShotQuality
  result?: ShotResult
  start?: LatLng
  end?: LatLng
  distanceMeters?: number
  penalty?: PenaltyType
  isPutt?: boolean
  putts?: number
  puttDistance?: PuttDistance
}): Shot {
  return shotSchema.parse({
    id: generateId(),
    holeNumber: input.holeNumber,
    shotNumber: input.shotNumber,
    club: input.club,
    quality: input.quality,
    result: input.result,
    start: input.start,
    end: input.end,
    distanceMeters: input.distanceMeters,
    penalty: input.penalty,
    isPutt: input.isPutt,
    putts: input.putts,
    puttDistance: input.puttDistance,
    createdAt: new Date().toISOString(),
  })
}

/** Creates a hole-score record; throws on invalid input. */
export function createHoleScore(holeNumber: number, par: number): HoleScore {
  return holeScoreSchema.parse({
    holeNumber,
    par,
    strokes: 0,
    putts: 0,
    status: HoleStatus.IN_PROGRESS,
  })
}

/** Creates a player; throws on invalid input. */
export function createPlayer(name: string): Player {
  return playerSchema.parse({ id: generateId(), name })
}

/** Creates a round; throws on invalid input. */
export function createRound(input: { courseName: string; playerName: string }): Round {
  return roundSchema.parse({
    id: generateId(),
    courseName: input.courseName,
    startedAt: new Date().toISOString(),
    status: RoundStatus.IN_PROGRESS,
    players: [createPlayer(input.playerName)],
    holes: [],
    shots: [],
    schemaVersion: 2,
  })
}
