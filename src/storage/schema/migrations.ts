/**
 * Legacy data migration (schema v1 -> v2).
 *
 * The legacy v7.1 HTML app persisted two incompatible shapes:
 * - `golf_v7_shots` / `golf_v7_pars` / `golf_course_name` (localStorage) —
 *   the full tracker's *active* round.
 * - `GolfTrackerDB/rounds` (IndexedDB) — archived rounds.
 * - `golf_shots` (localStorage) — the minimal tracker's active round.
 *
 * This module converts all three into schema v2 entities so no historical
 * data is lost during the consolidation. The conversion is lossy only where
 * the legacy app never captured the data (e.g. course rating/slope).
 */
import {
  Club,
  PenaltyType,
  PuttDistance,
  RoundStatus,
  ShotQuality,
  ShotResult,
} from '../../domain/enums/golf'
import type { Round, Shot } from '../../domain/models/entities'
import { computeAllHoleScores } from '../../domain/rules/scoring'
import { generateId } from '../../domain/utils/ids'

/** Raw shape of a legacy v7.1 shot (full tracker). */
export interface LegacyV7Shot {
  course?: string
  hole: number
  par?: number
  shotNum: number
  startLat?: number
  startLon?: number
  startAcc?: number
  endLat?: number
  endLon?: number
  endAcc?: number
  calculatedDistance?: number
  club?: string
  quality?: string
  result?: string
  putts?: number
  puttDist?: string
}

/** Raw shape of a legacy minimal-tracker shot. */
export interface LegacyMinimalShot {
  hole: number
  shotNum: number
  club?: string
  lat?: number
  lon?: number
  calculatedDistance?: number
  result?: string
  quality?: string
  putts?: number
  puttDist?: string
}

/** Raw shape of a legacy archived round record. */
export interface LegacyArchivedRound {
  id: number
  date: string
  course: string
  data: LegacyV7Shot[]
  pars: Record<string, number>
}

const CLUB_MAP: Record<string, Club> = {
  D: Club.DRIVER,
  '3W': Club.WOOD_3,
  '4H': Club.HYBRID_4,
  '5i': Club.IRON_5,
  '6i': Club.IRON_6,
  '7i': Club.IRON_7,
  '8i': Club.IRON_8,
  '9i': Club.IRON_9,
  PW: Club.PITCHING_WEDGE,
  GW: Club.GAP_WEDGE,
  SW: Club.SAND_WEDGE,
  LW: Club.LOB_WEDGE,
  Putter: Club.PUTTER,
}

const QUALITY_MAP: Record<string, ShotQuality> = {
  '🔥 Bra': ShotQuality.GOOD,
  '💩 Tunn': ShotQuality.THIN,
  '↪️ Slice': ShotQuality.SLICE,
  '↩️ Hook': ShotQuality.HOOK,
  Plikt: ShotQuality.PENALTY,
  Närspel: ShotQuality.CHIP,
  Puttning: ShotQuality.PUTTING,
}

const RESULT_MAP: Record<string, ShotResult> = {
  Fairway: ShotResult.FAIRWAY,
  Green: ShotResult.GREEN,
  'Rough Vänster': ShotResult.LEFT_ROUGH,
  'Rough Höger': ShotResult.RIGHT_ROUGH,
  Bunker: ShotResult.BUNKER,
  '🚨 Out of Bounds': ShotResult.OUT_OF_BOUNDS,
  '💧 Plikt/Hinder': ShotResult.WATER,
  '🟢 Till Green': ShotResult.ON_GREEN,
  '🏖️ I Bunker': ShotResult.IN_BUNKER,
  '🌲 I Rough': ShotResult.IN_ROUGH,
}

const PUTT_DISTANCE_MAP: Record<string, PuttDistance> = {
  '<2m': PuttDistance.UNDER_2M,
  '2-4m': PuttDistance.TWO_TO_4M,
  '5-8m': PuttDistance.FIVE_TO_8M,
  '8m+': PuttDistance.OVER_8M,
}

function mapClub(club: string | undefined): Club | undefined {
  if (!club) return undefined
  return CLUB_MAP[club]
}

function mapQuality(quality: string | undefined): ShotQuality | undefined {
  if (!quality) return undefined
  return QUALITY_MAP[quality]
}

function mapResult(result: string | undefined): ShotResult | undefined {
  if (!result) return undefined
  return RESULT_MAP[result]
}

function mapPuttDistance(value: string | undefined): PuttDistance | undefined {
  if (!value) return undefined
  return PUTT_DISTANCE_MAP[value]
}

/**
 * Converts one legacy v7.1 shot into a schema v2 shot.
 *
 * Classification order matters:
 * 1. `PLIKT (…)` club -> penalty stroke (flagged, still counts as a stroke).
 * 2. `Chip (…)` club -> chip shot (counts as a stroke, tagged CHIP quality).
 * 3. `putts` present -> hole-closing putt record (not an extra stroke).
 * 4. otherwise -> ordinary full-swing shot.
 */
export function convertLegacyV7Shot(shot: LegacyV7Shot, createdAt: string): Shot {
  const hasStart =
    typeof shot.startLat === 'number' && typeof shot.startLon === 'number'
  const hasEnd = typeof shot.endLat === 'number' && typeof shot.endLon === 'number'
  const clubLabel = shot.club ?? ''

  if (clubLabel.startsWith('PLIKT')) {
    const penalty = clubLabel.includes('OoB')
      ? PenaltyType.OUT_OF_BOUNDS
      : PenaltyType.WATER_HAZARD
    return {
      id: generateId(),
      holeNumber: shot.hole,
      shotNumber: shot.shotNum,
      quality: ShotQuality.PENALTY,
      penalty,
      start: hasStart
        ? { latitude: shot.startLat!, longitude: shot.startLon!, accuracyMeters: shot.startAcc }
        : undefined,
      end: hasEnd
        ? { latitude: shot.endLat!, longitude: shot.endLon!, accuracyMeters: shot.endAcc }
        : undefined,
      distanceMeters: shot.calculatedDistance,
      createdAt,
    }
  }

  if (clubLabel.startsWith('Chip')) {
    // Legacy format is "Chip (PW)": strip the 6-character "Chip (" prefix
    // and the closing parenthesis.
    const inner = clubLabel.slice(6, -1).trim()
    return {
      id: generateId(),
      holeNumber: shot.hole,
      shotNumber: shot.shotNum,
      club: mapClub(inner),
      quality: ShotQuality.CHIP,
      result: mapResult(shot.result),
      distanceMeters: shot.calculatedDistance,
      createdAt,
    }
  }

  if (shot.putts !== undefined) {
    return {
      id: generateId(),
      holeNumber: shot.hole,
      shotNumber: shot.shotNum,
      club: Club.PUTTER,
      quality: ShotQuality.PUTTING,
      isPutt: true,
      putts: shot.putts,
      puttDistance: mapPuttDistance(shot.puttDist),
      createdAt,
    }
  }

  return {
    id: generateId(),
    holeNumber: shot.hole,
    shotNumber: shot.shotNum,
    club: mapClub(clubLabel),
    quality: mapQuality(shot.quality),
    result: mapResult(shot.result),
    start: hasStart
      ? { latitude: shot.startLat!, longitude: shot.startLon!, accuracyMeters: shot.startAcc }
      : undefined,
    end: hasEnd
      ? { latitude: shot.endLat!, longitude: shot.endLon!, accuracyMeters: shot.endAcc }
      : undefined,
    distanceMeters: shot.calculatedDistance,
    createdAt,
  }
}

/**
 * Converts a legacy minimal-tracker shot. In that app each record stored the
 * position where the shot was *played from*, so `lat/lon` becomes the shot's
 * `start` coordinate.
 */
export function convertLegacyMinimalShot(shot: LegacyMinimalShot, createdAt: string): Shot {
  if (shot.putts !== undefined) {
    return {
      id: generateId(),
      holeNumber: shot.hole,
      shotNumber: shot.shotNum,
      club: Club.PUTTER,
      quality: ShotQuality.PUTTING,
      isPutt: true,
      putts: shot.putts,
      puttDistance: mapPuttDistance(shot.puttDist),
      createdAt,
    }
  }
  return {
    id: generateId(),
    holeNumber: shot.hole,
    shotNumber: shot.shotNum,
    club: mapClub(shot.club),
    quality: mapQuality(shot.quality),
    result: mapResult(shot.result),
    start:
      typeof shot.lat === 'number' && typeof shot.lon === 'number'
        ? { latitude: shot.lat, longitude: shot.lon }
        : undefined,
    distanceMeters: shot.calculatedDistance,
    createdAt,
  }
}

/**
 * Builds a schema v2 round from legacy active-round data.
 *
 * @param shots - Legacy shot array (either tracker's shape).
 * @param pars - Map of hole number -> par (may be empty).
 * @param courseName - Course name (may be empty).
 * @param convertShot - Converter matching the shot shape being migrated.
 * @returns An in-progress schema v2 round.
 */
export function buildRoundFromLegacy<T>(
  shots: T[],
  pars: Record<string, number>,
  courseName: string,
  convertShot: (shot: T, createdAt: string) => Shot
): Round {
  const createdAt = new Date().toISOString()
  const convertedShots = shots.map((s) => convertShot(s, createdAt))
  const holeNumbers = new Set<number>([...Object.keys(pars).map(Number), ...convertedShots.map((s) => s.holeNumber)])
  const holePars = new Map<number, number>()
  for (const hole of holeNumbers) {
    holePars.set(hole, pars[String(hole)] ?? 4)
  }

  return {
    id: generateId(),
    courseName: courseName.trim() || 'Unnamed course',
    startedAt: createdAt,
    status: RoundStatus.IN_PROGRESS,
    players: [{ id: generateId(), name: 'Golfer' }],
    holes: computeAllHoleScores(convertedShots, holePars),
    shots: convertedShots,
    schemaVersion: 2,
  }
}

/**
 * Converts a legacy archived round record (GolfTrackerDB) into a schema v2
 * completed round, preserving the original id and date.
 */
export function convertLegacyArchivedRound(record: LegacyArchivedRound): Round {
  const startedAt = `${record.date}T12:00:00.000Z`
  const convertedShots = record.data.map((s) => convertLegacyV7Shot(s, startedAt))
  const holePars = new Map<number, number>()
  // Prefer the per-shot par recorded in the legacy log (most reliable), then
  // the legacy pars map, then a neutral par-4 fallback.
  for (const rawShot of record.data) {
    if (rawShot.par !== undefined) holePars.set(rawShot.hole, rawShot.par)
  }
  for (const [hole, par] of Object.entries(record.pars ?? {})) {
    if (!holePars.has(Number(hole))) holePars.set(Number(hole), Number(par))
  }
  for (const shot of convertedShots) {
    if (!holePars.has(shot.holeNumber)) holePars.set(shot.holeNumber, 4)
  }

  return {
    id: String(record.id),
    courseName: record.course?.trim() || 'Unnamed course',
    startedAt,
    completedAt: startedAt,
    status: RoundStatus.COMPLETED,
    players: [{ id: generateId(), name: 'Golfer' }],
    holes: computeAllHoleScores(convertedShots, holePars),
    shots: convertedShots,
    schemaVersion: 2,
  }
}
