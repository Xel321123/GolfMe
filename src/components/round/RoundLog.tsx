/**
 * RoundLog — per-hole shot log with undo/clear controls.
 */
import type { ActiveRoundState } from '../../domain/models/roundSession'
import { CLUB_LABELS, PUTT_DISTANCE_LABELS, QUALITY_LABELS, RESULT_LABELS } from '../../lib/labels'
import type { RoundSessionActions } from '../../hooks/useRoundSession'
import type { Shot } from '../../domain/models/entities'
import { Button } from '../common/Button'
import { Section } from '../common/Section'

interface RoundLogProps {
  state: ActiveRoundState
  actions: RoundSessionActions
  onRequestClear: () => void
}

/** Renders one shot line for the log. */
function renderShotLine(shot: Shot): string {
  const parts: string[] = []
  if (shot.isPutt === true) {
    parts.push(`#${shot.shotNumber}: ${shot.putts} putts`)
    if (shot.puttDistance !== undefined) parts.push(`(${PUTT_DISTANCE_LABELS[shot.puttDistance]})`)
  } else if (shot.penalty !== undefined) {
    parts.push(`#${shot.shotNumber}: Penalty (${shot.penalty.replaceAll('_', ' ')})`)
  } else {
    parts.push(`#${shot.shotNumber}: ${shot.club ? CLUB_LABELS[shot.club] : 'In progress…'}`)
    if (shot.quality !== undefined) parts.push(`(${QUALITY_LABELS[shot.quality]})`)
    if (shot.distanceMeters !== undefined && shot.distanceMeters > 0) {
      parts.push(`→ ${shot.distanceMeters}m`)
    }
    if (shot.result !== undefined) parts.push(`[${RESULT_LABELS[shot.result]}]`)
  }
  return parts.join(' ')
}

export function RoundLog({ state, actions, onRequestClear }: RoundLogProps) {
  const holeShots = state.round.shots
    .filter((s) => s.holeNumber === state.currentHole)
    .sort((a, b) => a.shotNumber - b.shotNumber)
  const par = state.round.holes.find((h) => h.holeNumber === state.currentHole)?.par

  return (
    <Section title="Round log">
      <div className="gm-log" role="log" aria-live="polite">
        <strong>
          Hole {state.currentHole} {par !== undefined ? `(Par ${par})` : '(no par selected)'}
        </strong>
        {holeShots.length === 0 ? (
          <div style={{ color: '#777', fontSize: 12 }}>No shots saved on this hole yet.</div>
        ) : (
          holeShots.map((shot) => <div key={shot.id}>{renderShotLine(shot)}</div>)
        )}
      </div>
      <div className="gm-grid gm-grid--2">
        <Button variant="ghost" onClick={() => actions.undo()}>
          ↩ Undo / Back
        </Button>
        <Button variant="danger" onClick={onRequestClear}>
          🗑 Clear Round
        </Button>
      </div>
    </Section>
  )
}
