/**
 * PlayPage — the active-round view (setup, wizard, live dashboard).
 */
import { useState } from 'react'
import { usePersistentRound } from '../hooks/usePersistentRound'
import { useRoundSession } from '../hooks/useRoundSession'
import { RoundLifecycleService } from '../services/round/RoundLifecycleService'
import type { GeolocationProvider } from '../services/geolocation/types'
import { CourseSetup } from '../components/round/CourseSetup'
import { HoleNavigation } from '../components/round/HoleNavigation'
import { GpsStatus } from '../components/round/GpsStatus'
import { ParSelector } from '../components/round/ParSelector'
import { ShotWizard } from '../components/round/ShotWizard'
import { RoundLog } from '../components/round/RoundLog'
import { LiveDashboard } from '../components/round/LiveDashboard'
import { Button } from '../components/common/Button'
import { ErrorBanner } from '../components/common/ErrorBanner'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { Section } from '../components/common/Section'

interface PlayPageProps {
  lifecycle: RoundLifecycleService
  geolocation: GeolocationProvider
}

export function PlayPage({ lifecycle, geolocation }: PlayPageProps) {
  const persistent = usePersistentRound(lifecycle)
  const { state, hydrated, error, clearError } = persistent
  const { actions, gpsBusy, gpsError, clearGpsError } = useRoundSession(persistent, geolocation)

  const [confirmingArchive, setConfirmingArchive] = useState(false)
  const [confirmingClear, setConfirmingClear] = useState(false)
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  if (!hydrated) {
    return <p style={{ color: 'var(--muted)' }}>Restoring your round…</p>
  }

  if (state === null) {
    return (
      <>
        {error !== null && <ErrorBanner message={error} onDismiss={clearError} />}
        <Section title="New round">
          <CourseSetup
            defaultCourseName=""
            onStart={(courseName, playerName) => {
              void persistent.startNewRound({ courseName, playerName })
            }}
          />
        </Section>
      </>
    )
  }

  const { round, currentHole } = state
  const selectedPar =
    round.holes.find((h) => h.holeNumber === currentHole)?.par ?? null

  return (
    <>
      {error !== null && <ErrorBanner message={error} onDismiss={clearError} />}
      {gpsError !== null && <ErrorBanner message={gpsError} onDismiss={clearGpsError} />}
      {notice !== null && <ErrorBanner message={notice} onDismiss={() => setNotice(null)} />}

      <Section title="Course">
        <input
          className="gm-setup__input"
          type="text"
          value={round.courseName}
          placeholder="Course name"
          onChange={(event) => actions.setCourseName(event.target.value)}
        />
      </Section>

      <HoleNavigation holeNumber={currentHole} onChangeHole={actions.changeHole} />
      <GpsStatus />

      <Section title="Select hole par">
        <ParSelector selectedPar={selectedPar} onSelectPar={actions.selectPar} />
      </Section>

      <ShotWizard state={state} actions={actions} gpsBusy={gpsBusy} />
      <RoundLog state={state} actions={actions} onRequestClear={() => setConfirmingClear(true)} />
      <LiveDashboard round={round} />

      <div className="gm-wizard-actions">
        <Button variant="primary" full onClick={() => setConfirmingArchive(true)}>
          💾 Save & Finish Round
        </Button>
        <Button variant="ghost" full onClick={() => setConfirmingDiscard(true)}>
          Discard Round
        </Button>
      </div>

      {confirmingArchive && (
        <ConfirmDialog
          title="Finish round"
          message={`Archive the round on "${round.courseName}"? It will be available in History and Dashboard.`}
          confirmLabel="Archive"
          onConfirm={() => {
            void persistent.completeAndArchiveRound().then((archived) => {
              setConfirmingArchive(false)
              if (archived !== null) setNotice('Round archived successfully.')
            })
          }}
          onCancel={() => setConfirmingArchive(false)}
        />
      )}

      {confirmingClear && (
        <ConfirmDialog
          title="Clear round"
          message="Delete every shot and hole of the current round? This cannot be undone."
          confirmLabel="Clear"
          danger
          onConfirm={() => {
            actions.clearRound()
            setConfirmingClear(false)
          }}
          onCancel={() => setConfirmingClear(false)}
        />
      )}

      {confirmingDiscard && (
        <ConfirmDialog
          title="Discard round"
          message="Abandon this round entirely? It will NOT be archived."
          confirmLabel="Discard"
          danger
          onConfirm={() => {
            void persistent.discardRound()
            setConfirmingDiscard(false)
          }}
          onCancel={() => setConfirmingDiscard(false)}
        />
      )}
    </>
  )
}
