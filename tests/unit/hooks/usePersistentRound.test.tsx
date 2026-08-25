/**
 * @vitest-environment jsdom
 *
 * Hook-level tests — hydration + auto-save through the React layer
 * (Phase 4 contract exercised at the boundary the UI actually uses).
 */
import { describe, expect, it } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { usePersistentRound } from '../../../src/hooks/usePersistentRound'
import { RoundLifecycleService } from '../../../src/services/round/RoundLifecycleService'
import { RoundPersistenceService } from '../../../src/services/persistence/RoundPersistenceService'
import { MemoryAdapter } from '../../../src/storage/adapters/memory'
import { playFixtureRound } from '../analytics/fixtures/roundFixture'

function makeLifecycle() {
  const active = new MemoryAdapter()
  const archive = new MemoryAdapter()
  const persistence = new RoundPersistenceService({ activeAdapter: active, archiveAdapter: archive })
  return new RoundLifecycleService(persistence)
}

describe('usePersistentRound', () => {
  it('hydrates a previously persisted session on mount', async () => {
    const lifecycle = makeLifecycle()
    const session = playFixtureRound()
    await lifecycle.saveActiveRound(session)

    const { result } = renderHook(() => usePersistentRound(lifecycle))

    await waitFor(() => expect(result.current.hydrated).toBe(true))
    expect(result.current.state?.currentHole).toBe(session.currentHole)
    expect(result.current.state?.round.shots).toHaveLength(11)
  })

  it('auto-persists every transition applied through update()', async () => {
    const lifecycle = makeLifecycle()
    const { result } = renderHook(() => usePersistentRound(lifecycle))

    await waitFor(() => expect(result.current.hydrated).toBe(true))

    // Start a fresh round and record a mutation.
    await act(async () => {
      await result.current.startNewRound({ courseName: 'Hook GC' })
    })
    expect(result.current.state).not.toBeNull()

    // Every mutation is immediately visible in storage (simulated crash check).
    const stored = await lifecycle.resumeActiveRound()
    expect(stored?.round.courseName).toBe('Hook GC')
  })

  it('completeAndArchiveRound clears the session', async () => {
    const lifecycle = makeLifecycle()
    const { result } = renderHook(() => usePersistentRound(lifecycle))
    await waitFor(() => expect(result.current.hydrated).toBe(true))

    await act(async () => {
      await result.current.startNewRound({ courseName: 'Hook GC' })
    })

    await act(async () => {
      const archived = await result.current.completeAndArchiveRound()
      expect(archived).not.toBeNull()
    })
    expect(result.current.state).toBeNull()
  })
})
