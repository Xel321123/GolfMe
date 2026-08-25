/**
 * Numeric helpers shared by the analytics engine and domain rules.
 * All functions are pure and total (never throw on degenerate input).
 */

/**
 * Computes a percentage with a safe fallback for an empty denominator.
 *
 * @param part - Number of successful outcomes (must be >= 0).
 * @param whole - Total number of attempts (must be >= 0).
 * @returns Percentage rounded to one decimal (e.g. `66.7`), or `null` when
 *          `whole` is zero — callers must render `null` as a dash, never as
 *          a misleading `0%`.
 */
export function safePercentage(part: number, whole: number): number | null {
  if (!Number.isFinite(part) || !Number.isFinite(whole)) return null
  if (whole <= 0) return null
  const ratio = part / whole
  if (ratio < 0 || ratio > 1) return null
  return Math.round(ratio * 1000) / 10
}

/**
 * Rounds a value to a fixed number of decimal places, avoiding floating-point
 * artifacts (e.g. `1.005` -> `1.01`, never `1.00`).
 *
 * @param value - The number to round.
 * @param decimals - Number of decimal places (0-10).
 * @returns The rounded number.
 */
export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** Math.min(Math.max(decimals, 0), 10)
  return Math.round((value + Number.EPSILON) * factor) / factor
}

/**
 * Clamps a value into the inclusive `[min, max]` range.
 *
 * @param value - The value to clamp.
 * @param min - Lower bound.
 * @param max - Upper bound (must be >= min).
 * @returns `min` if `value < min`, `max` if `value > max`, else `value`.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
