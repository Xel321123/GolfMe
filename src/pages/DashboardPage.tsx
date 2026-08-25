/**
 * DashboardPage — historical analytics: multi-round aggregates + deep dive.
 */
import { useMemo, useState } from 'react'
import { RoundPersistenceService } from '../services/persistence/RoundPersistenceService'
import { useRoundHistory } from '../hooks/useRoundHistory'
import { useAnalytics } from '../hooks/useAnalytics'
import type { RoundSelection } from '../analytics/selectors/roundSelection'
import { RoundSelector } from '../components/history/RoundSelector'
import { AggregatePanel } from '../components/dashboard/AggregatePanel'
import { DeepDivePanel } from '../components/dashboard/DeepDivePanel'
import { Section } from '../components/common/Section'
import { ErrorBanner } from '../components/common/ErrorBanner'

interface DashboardPageProps {
  persistence: RoundPersistenceService
}

export function DashboardPage({ persistence }: DashboardPageProps) {
  const { rounds, loading, error, clearError } = useRoundHistory(persistence)
  const [selection, setSelection] = useState<RoundSelection>({ mode: 'all' })
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null)

  // Keep the deep-dive selection valid as rounds change (deletions/imports).
  const effectiveSelectedId = useMemo(() => {
    if (selectedRoundId !== null && rounds.some((r) => r.id === selectedRoundId)) {
      return selectedRoundId
    }
    return rounds.length > 0 ? (rounds[0]?.id ?? null) : null
  }, [rounds, selectedRoundId])

  const { aggregates, deepDive, selectedRound } = useAnalytics(
    rounds,
    selection,
    effectiveSelectedId
  )

  if (loading) {
    return <p style={{ color: 'var(--muted)' }}>Loading analytics…</p>
  }

  return (
    <>
      {error !== null && <ErrorBanner message={error} onDismiss={clearError} />}
      {rounds.length === 0 ? (
        <Section title="Dashboard">
          <p style={{ color: '#777', fontSize: 13 }}>
            No archived rounds yet. Finish a round to see aggregated analytics here.
          </p>
        </Section>
      ) : (
        <>
          <RoundSelector rounds={rounds} selection={selection} onChange={setSelection} />

          <Section title="Highlighted round" accent="green">
            <select
              className="gm-setup__input"
              value={effectiveSelectedId ?? ''}
              onChange={(event) => setSelectedRoundId(event.target.value || null)}
            >
              {rounds.map((round) => (
                <option key={round.id} value={round.id}>
                  {round.startedAt.slice(0, 10)} — {round.courseName}
                </option>
              ))}
            </select>
          </Section>

          <AggregatePanel stats={aggregates} />
          {deepDive !== null && selectedRound !== null && (
            <>
              <Section title="Selected round" accent="green">
                <p style={{ margin: 0, fontSize: 13, color: '#bbb' }}>
                  {selectedRound.startedAt.slice(0, 10)} — {selectedRound.courseName}
                  {selectedRound.courseSlope !== undefined && selectedRound.courseRating !== undefined
                    ? ` (R ${selectedRound.courseRating} / S ${selectedRound.courseSlope})`
                    : ''}
                </p>
              </Section>
              <DeepDivePanel dive={deepDive} />
            </>
          )}
        </>
      )}
    </>
  )
}
