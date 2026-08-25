/**
 * Unit tests — geo (haversine) and numeric utilities.
 */
import { describe, expect, it } from 'vitest'
import { haversineDistanceMeters, isValidLatLng } from '../../../src/domain/utils/geo'
import { clamp, roundTo, safePercentage } from '../../../src/domain/utils/numbers'

describe('haversineDistanceMeters', () => {
  it('returns 0 for identical points', () => {
    expect(haversineDistanceMeters({ latitude: 59.329, longitude: 18.068 }, { latitude: 59.329, longitude: 18.068 })).toBe(0)
  })

  it('matches a known reference distance (approx 1 degree of latitude ~ 111.2 km)', () => {
    const from = { latitude: 0, longitude: 0 }
    const to = { latitude: 1, longitude: 0 }
    const meters = haversineDistanceMeters(from, to)
    // 1 degree of latitude is 110.574-111.694 km depending on the model;
    // our spherical approximation lands near 111.19 km.
    expect(meters).toBeGreaterThan(110_000)
    expect(meters).toBeLessThan(112_000)
  })

  it('computes an equatorial longitude degree (~111.19 km at the equator)', () => {
    const from = { latitude: 0, longitude: 0 }
    const to = { latitude: 0, longitude: 1 }
    expect(haversineDistanceMeters(from, to)).toBeGreaterThan(110_000)
    expect(haversineDistanceMeters(from, to)).toBeLessThan(112_000)
  })

  it('returns 0 for invalid coordinates (defensive)', () => {
    expect(
      haversineDistanceMeters({ latitude: NaN, longitude: 0 }, { latitude: 0, longitude: 0 })
    ).toBe(0)
    expect(
      haversineDistanceMeters({ latitude: 91, longitude: 0 }, { latitude: 0, longitude: 0 })
    ).toBe(0)
  })

  it('handles near-antipodal points without NaN', () => {
    const a = { latitude: 0, longitude: 0 }
    const b = { latitude: 0, longitude: 179.999 }
    const meters = haversineDistanceMeters(a, b)
    expect(Number.isFinite(meters)).toBe(true)
    expect(meters).toBeGreaterThan(19_000_000)
  })
})

describe('isValidLatLng', () => {
  it('validates bounds and finiteness', () => {
    expect(isValidLatLng({ latitude: 59.3, longitude: 18.0 })).toBe(true)
    expect(isValidLatLng({ latitude: 91, longitude: 0 })).toBe(false)
    expect(isValidLatLng({ latitude: 0, longitude: 181 })).toBe(false)
    expect(isValidLatLng({ latitude: 'x', longitude: 0 })).toBe(false)
    expect(isValidLatLng(null)).toBe(false)
  })
})

describe('safePercentage', () => {
  it('computes percentages rounded to one decimal', () => {
    expect(safePercentage(2, 3)).toBe(66.7)
    expect(safePercentage(1, 2)).toBe(50)
    expect(safePercentage(0, 5)).toBe(0)
  })

  it('returns null for zero/negative/invalid denominators', () => {
    expect(safePercentage(1, 0)).toBeNull()
    expect(safePercentage(1, -1)).toBeNull()
    expect(safePercentage(1, NaN)).toBeNull()
    expect(safePercentage(2, 1)).toBeNull() // part > whole is invalid
  })
})

describe('roundTo / clamp', () => {
  it('rounds without floating-point artifacts', () => {
    expect(roundTo(1.005, 2)).toBe(1.01)
    expect(roundTo(15.646, 1)).toBe(15.6)
  })

  it('clamps into range', () => {
    expect(clamp(0, 1, 18)).toBe(1)
    expect(clamp(22, 1, 18)).toBe(18)
    expect(clamp(7, 1, 18)).toBe(7)
  })
})
