/**
 * Geospatial helpers (pure math — no geolocation APIs).
 *
 * These functions only operate on explicit coordinate inputs, so they are
 * fully portable: the UI layer is responsible for obtaining coordinates from
 * the platform's geolocation provider (browser `navigator.geolocation` today,
 * `react-native-geolocation-service` after the mobile migration).
 */
import type { LatLng } from '../models/entities'

/** Mean Earth radius in meters (WGS-84 ellipsoid approximation). */
const EARTH_RADIUS_METERS = 6_371_000

/** Degrees-to-radians conversion factor. */
const DEG_TO_RAD = Math.PI / 180

/**
 * Validates that a value is a plausible GPS coordinate pair.
 *
 * @param value - Arbitrary value to test.
 * @returns `true` when `value` has finite latitude in [-90, 90] and finite
 *          longitude in [-180, 180].
 */
export function isValidLatLng(value: unknown): value is LatLng {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  const { latitude, longitude } = candidate
  return (
    typeof latitude === 'number' &&
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    typeof longitude === 'number' &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180
  )
}

/**
 * Computes the great-circle distance between two coordinates using the
 * Haversine formula.
 *
 * Edge cases handled:
 * - Identical points return `0` (avoids `NaN` from `Math.atan2(0, 0)`).
 * - Antipodal points are computed correctly (near half the Earth's
 *   circumference) rather than overflowing `acos` domain errors.
 * - Non-finite or out-of-range inputs return `0` (defensive; callers should
 *   validate with {@link isValidLatLng} beforehand).
 *
 * @param from - Starting coordinate.
 * @param to - Ending coordinate.
 * @returns Distance in meters, rounded to the nearest whole meter.
 */
export function haversineDistanceMeters(from: LatLng, to: LatLng): number {
  if (!isValidLatLng(from) || !isValidLatLng(to)) return 0

  const phi1 = from.latitude * DEG_TO_RAD
  const phi2 = to.latitude * DEG_TO_RAD
  const deltaPhi = (to.latitude - from.latitude) * DEG_TO_RAD
  const deltaLambda = (to.longitude - from.longitude) * DEG_TO_RAD

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2)

  // Clamp to [0, 1] to protect against floating-point drift pushing `a`
  // slightly above 1 for near-antipodal pairs.
  const clampedA = Math.min(Math.max(a, 0), 1)
  const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA))

  return Math.round(EARTH_RADIUS_METERS * c)
}
