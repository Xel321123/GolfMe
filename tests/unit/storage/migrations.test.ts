/**
 * Unit tests — legacy v7.1 migration (Swedish UI strings, dual schemas).
 */
import { describe, expect, it } from 'vitest'
import {
  convertLegacyArchivedRound,
  convertLegacyMinimalShot,
  convertLegacyV7Shot,
} from '../../../src/storage/schema/migrations'
import type { LegacyV7Shot } from '../../../src/storage/schema/migrations'
import { PenaltyType, ShotQuality, ShotResult } from '../../../src/domain/enums/golf'

const T = '2026-01-01T12:00:00.000Z'

describe('convertLegacyV7Shot', () => {
  it('maps a normal full swing (Swedish labels -> enums)', () => {
    const shot = convertLegacyV7Shot(
      {
        hole: 1,
        shotNum: 1,
        club: 'D',
        quality: '🔥 Bra',
        result: 'Fairway',
        startLat: 59.3,
        startLon: 18.0,
        startAcc: 5,
        calculatedDistance: 210,
      },
      T
    )
    expect(shot.club).toBe('DRIVER')
    expect(shot.quality).toBe(ShotQuality.GOOD)
    expect(shot.result).toBe(ShotResult.FAIRWAY)
    expect(shot.start).toEqual({ latitude: 59.3, longitude: 18.0, accuracyMeters: 5 })
    expect(shot.distanceMeters).toBe(210)
  })

  it('maps out-of-bounds penalty rows to flagged penalty strokes', () => {
    const shot = convertLegacyV7Shot(
      { hole: 2, shotNum: 2, club: 'PLIKT (OoB)', quality: 'Plikt' },
      T
    )
    expect(shot.penalty).toBe(PenaltyType.OUT_OF_BOUNDS)
    expect(shot.quality).toBe(ShotQuality.PENALTY)
    expect(shot.club).toBeUndefined()
  })

  it('maps water-hazard penalty rows', () => {
    const shot = convertLegacyV7Shot(
      { hole: 2, shotNum: 3, club: 'PLIKT (Hinder)', quality: 'Plikt' },
      T
    )
    expect(shot.penalty).toBe(PenaltyType.WATER_HAZARD)
  })

  it('maps chip rows (Chip (PW)) to chip shots', () => {
    const shot = convertLegacyV7Shot({ hole: 3, shotNum: 4, club: 'Chip (PW)', result: '🟢 Till Green' }, T)
    expect(shot.club).toBe('PITCHING_WEDGE')
    expect(shot.quality).toBe(ShotQuality.CHIP)
    expect(shot.result).toBe(ShotResult.ON_GREEN)
  })

  it('maps the putt record (putts present) to an isPutt record', () => {
    const shot = convertLegacyV7Shot(
      { hole: 3, shotNum: 5, club: 'Putter', putts: 2, puttDist: '2-4m' },
      T
    )
    expect(shot.isPutt).toBe(true)
    expect(shot.putts).toBe(2)
    expect(shot.puttDistance).toBe('TWO_TO_4M')
  })
})

describe('convertLegacyMinimalShot', () => {
  it('maps position-of-play to start coordinates', () => {
    const shot = convertLegacyMinimalShot(
      { hole: 1, shotNum: 1, club: 'D', lat: 59.3, lon: 18.0, calculatedDistance: 180 },
      T
    )
    expect(shot.club).toBe('DRIVER')
    expect(shot.start).toEqual({ latitude: 59.3, longitude: 18.0 })
  })

  it('maps minimal putt records', () => {
    const shot = convertLegacyMinimalShot({ hole: 1, shotNum: 2, putts: 3, puttDist: '8m+' }, T)
    expect(shot.isPutt).toBe(true)
    expect(shot.putts).toBe(3)
    expect(shot.puttDistance).toBe('OVER_8M')
  })
})

describe('convertLegacyArchivedRound', () => {
  it('preserves id/date/course and derives holes', () => {
    const round = convertLegacyArchivedRound({
      id: 12345,
      date: '2025-06-01',
      course: 'Test GC',
      pars: { 1: 4 },
      data: [
        { hole: 1, par: 4, shotNum: 1, club: 'D', result: 'Fairway' } as LegacyV7Shot,
        { hole: 1, par: 4, shotNum: 2, club: '7i', result: 'Green' } as LegacyV7Shot,
        { hole: 1, par: 4, shotNum: 3, club: 'Putter', putts: 2, puttDist: '<2m' } as LegacyV7Shot,
      ],
    })
    expect(round.id).toBe('12345')
    expect(round.courseName).toBe('Test GC')
    expect(round.status).toBe('COMPLETED')
    expect(round.holes).toHaveLength(1)
    expect(round.holes[0]?.strokes).toBe(4) // 2 swings + 2 putts
    expect(round.holes[0]?.greenInRegulation).toBe(true)
    expect(round.holes[0]?.fairwayHit).toBe(true)
    expect(round.shots).toHaveLength(3)
  })
})
