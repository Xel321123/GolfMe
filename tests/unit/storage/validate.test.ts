/**
 * Unit tests — schema validation, envelope handling, and corruption
 * quarantine (Phase 4 "zero data loss" guarantees).
 */
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { MemoryAdapter } from '../../../src/storage/adapters/memory'
import { QUARANTINE_PREFIX, readValidated, readValidatedEnvelope } from '../../../src/storage/types'
import { roundSchema } from '../../../src/domain/models/entities'

const sampleSchema = z.object({ name: z.string() })

describe('readValidated', () => {
  it('returns the payload when valid', async () => {
    const adapter = new MemoryAdapter()
    await adapter.write('k', { name: 'ok' })
    expect(await readValidated(adapter, 'k', sampleSchema)).toEqual({ name: 'ok' })
  })

  it('returns null for a missing key', async () => {
    expect(await readValidated(new MemoryAdapter(), 'missing', sampleSchema)).toBeNull()
  })

  it('quarantines a schema-invalid payload and removes the original', async () => {
    const adapter = new MemoryAdapter()
    await adapter.write('k', { name: 42 }) // wrong type
    expect(await readValidated(adapter, 'k', sampleSchema)).toBeNull()
    expect(await adapter.read('k')).toBeNull()
    const quarantined = await adapter.read(`${QUARANTINE_PREFIX}.k`)
    expect(quarantined).not.toBeNull()
    expect((quarantined as { reason: string }).reason).toContain('Expected string')
  })
})

describe('readValidatedEnvelope', () => {
  it('accepts a matching envelope', async () => {
    const adapter = new MemoryAdapter()
    await adapter.write('k', { schemaVersion: 2, kind: 'round', payload: { name: 'x' } })
    expect(await readValidatedEnvelope(adapter, 'k', sampleSchema, 'round')).toEqual({ name: 'x' })
  })

  it('quarantines a wrong-kind envelope', async () => {
    const adapter = new MemoryAdapter()
    await adapter.write('k', { schemaVersion: 2, kind: 'other', payload: { name: 'x' } })
    expect(await readValidatedEnvelope(adapter, 'k', sampleSchema, 'round')).toBeNull()
    expect(await adapter.read(`${QUARANTINE_PREFIX}.k`)).not.toBeNull()
  })

  it('quarantines a future schema version instead of misreading it', async () => {
    const adapter = new MemoryAdapter()
    await adapter.write('k', { schemaVersion: 3, kind: 'round', payload: { name: 'x' } })
    expect(await readValidatedEnvelope(adapter, 'k', sampleSchema, 'round')).toBeNull()
  })

  it('quarantines malformed JSON-shaped garbage', async () => {
    const adapter = new MemoryAdapter()
    await adapter.write('k', 'just a string')
    expect(await readValidatedEnvelope(adapter, 'k', sampleSchema, 'round')).toBeNull()
  })
})

describe('round schema round-trip', () => {
  it('validates a real persisted round document', () => {
    const round = {
      id: 'r1',
      courseName: 'Test',
      startedAt: '2026-08-25T12:00:00.000Z',
      status: 'COMPLETED',
      players: [{ id: 'p1', name: 'Golfer' }],
      holes: [
        { holeNumber: 1, par: 4, strokes: 4, putts: 2, greenInRegulation: true, status: 'COMPLETED' },
      ],
      shots: [],
      schemaVersion: 2,
    }
    expect(roundSchema.safeParse(round).success).toBe(true)
  })

  it('rejects schema violations (wrong version, bad par)', () => {
    const bad = {
      id: 'r1',
      courseName: 'Test',
      startedAt: '2026-08-25T12:00:00.000Z',
      status: 'COMPLETED',
      players: [],
      holes: [{ holeNumber: 1, par: 9, strokes: 4, putts: 2, status: 'COMPLETED' }],
      shots: [],
      schemaVersion: 1,
    }
    expect(roundSchema.safeParse(bad).success).toBe(false)
  })
})
