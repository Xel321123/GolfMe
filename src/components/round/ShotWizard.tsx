/**
 * ShotWizard — the six-step shot-recording flow.
 *
 * Steps (ported from legacy v7.1):
 * START -> CLUB_QUALITY -> LANDING -> NEXT_ACTION -> (CHIP | GREEN) -> end hole.
 *
 * The component is purely presentational: it renders based on
 * `state.activeStep` + `state.selections` and calls actions from the session
 * hook. No domain mutation happens here.
 */
import type { ActiveRoundState } from '../../domain/models/roundSession'
import { RoundStep } from '../../domain/enums/golf'
import {
  CHIP_CLUB_LINEUP,
  CLUB_LINEUP,
  CLUB_LABELS,
  PUTT_DISTANCE_LABELS,
  QUALITY_LABELS,
  RESULT_LABELS,
} from '../../lib/labels'
import type { RoundSessionActions } from '../../hooks/useRoundSession'
import { Button } from '../common/Button'
import { Section } from '../common/Section'
import { PuttDistance, ShotQuality, ShotResult } from '../../domain/enums/golf'

interface ShotWizardProps {
  state: ActiveRoundState
  actions: RoundSessionActions
  gpsBusy: boolean
}

const QUALITY_OPTIONS: ShotQuality[] = [
  ShotQuality.GOOD,
  ShotQuality.THIN,
  ShotQuality.SLICE,
  ShotQuality.HOOK,
]

const LANDING_OPTIONS: Array<{ result: ShotResult; label: string; wide?: boolean; danger?: boolean }> = [
  { result: ShotResult.FAIRWAY, label: 'Fairway', wide: true },
  { result: ShotResult.GREEN, label: 'Green', wide: true },
  { result: ShotResult.LEFT_ROUGH, label: 'Left Rough', wide: true },
  { result: ShotResult.RIGHT_ROUGH, label: 'Right Rough', wide: true },
  { result: ShotResult.BUNKER, label: 'Bunker', wide: true },
  { result: ShotResult.OUT_OF_BOUNDS, label: 'OoB (+1 penalty)', wide: true, danger: true },
  { result: ShotResult.WATER, label: 'Water (+1 penalty)', wide: true, danger: true },
]

const CHIP_RESULT_OPTIONS: Array<{ result: ShotResult; label: string }> = [
  { result: ShotResult.ON_GREEN, label: 'On Green' },
  { result: ShotResult.IN_BUNKER, label: 'In Bunker' },
  { result: ShotResult.IN_ROUGH, label: 'In Rough' },
]

const PUTT_DISTANCE_OPTIONS: PuttDistance[] = [
  PuttDistance.UNDER_2M,
  PuttDistance.TWO_TO_4M,
  PuttDistance.FIVE_TO_8M,
  PuttDistance.OVER_8M,
]

export function ShotWizard({ state, actions, gpsBusy }: ShotWizardProps) {
  const { activeStep, selections } = state
  const parSelected = state.round.holes.some((h) => h.holeNumber === state.currentHole)

  if (!parSelected) {
    return (
      <Section title="Par required" accent="orange">
        <p style={{ color: '#bbb', fontSize: 13, margin: '4px 0 0' }}>
          Select the par for this hole before recording shots.
        </p>
      </Section>
    )
  }

  if (activeStep === RoundStep.START) {
    return (
      <Section title="Shot recording">
        <Button
          variant="primary"
          full
          onClick={() => void actions.startShot()}
          disabled={gpsBusy}
        >
          {gpsBusy ? 'Acquiring GPS…' : '📍 Here I Strike (lock position)'}
        </Button>
      </Section>
    )
  }

  if (activeStep === RoundStep.CLUB_QUALITY) {
    return (
      <Section title="After the shot">
        <h4 className="gm-wizard-subtitle">1. Which club did you just hit?</h4>
        <div className="gm-grid">
          {CLUB_LINEUP.map((club) => (
            <Button key={club} selected={selections.club === club} onClick={() => actions.selectClub(club)}>
              {CLUB_LABELS[club]}
            </Button>
          ))}
        </div>
        <h4 className="gm-wizard-subtitle">2. How was the contact?</h4>
        <div className="gm-grid">
          {QUALITY_OPTIONS.map((quality) => (
            <Button key={quality} selected={selections.quality === quality} onClick={() => actions.selectQuality(quality)}>
              {QUALITY_LABELS[quality]}
            </Button>
          ))}
        </div>
        <div className="gm-wizard-actions">
          <Button variant="primary" onClick={() => actions.confirmClubAndQuality()}>
            Save Club & Contact →
          </Button>
          <Button variant="ghost" onClick={() => actions.undo()}>
            ↩ Back
          </Button>
        </div>
      </Section>
    )
  }

  if (activeStep === RoundStep.LANDING) {
    return (
      <Section title="Where did the ball land?">
        <div className="gm-grid">
          {LANDING_OPTIONS.map(({ result, label, wide, danger }) => (
            <Button
              key={result}
              className={wide ? 'gm-wide' : undefined}
              variant={danger ? 'danger' : 'default'}
              selected={selections.result === result}
              onClick={() => actions.selectResult(result)}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="gm-wizard-actions">
          <Button variant="primary" onClick={() => actions.confirmLanding()}>
            Save Landing →
          </Button>
          <Button variant="ghost" onClick={() => actions.undo()}>
            ↩ Back
          </Button>
        </div>
      </Section>
    )
  }

  if (activeStep === RoundStep.NEXT_ACTION) {
    return (
      <Section title="What do you do now?" accent="green">
        <div className="gm-wizard-actions">
          <Button variant="primary" full onClick={() => void actions.lockNextPosition()} disabled={gpsBusy}>
            {gpsBusy ? 'Acquiring GPS…' : '📍 Lock Next Position (hit)'}
          </Button>
          <Button variant="accent" onClick={() => void actions.switchToChipMode()} disabled={gpsBusy}>
            📐 Chip / Pitch Mode
          </Button>
          <Button variant="ghost" onClick={() => void actions.switchToGreenMode()} disabled={gpsBusy}>
            ⛳ Green / Putt Mode
          </Button>
          <Button variant="ghost" onClick={() => actions.undo()}>
            ↩ Back
          </Button>
        </div>
      </Section>
    )
  }

  if (activeStep === RoundStep.CHIP) {
    const chips = state.round.shots.filter(
      (s) => s.holeNumber === state.currentHole && s.quality === ShotQuality.CHIP
    )
    return (
      <Section title="Short game (enter after the fact)" accent="orange">
        {chips.length === 0 ? (
          <p style={{ color: '#777', fontSize: 12, margin: '4px 0' }}>No chips recorded yet.</p>
        ) : (
          chips.map((chip) => (
            <div key={chip.id} className="gm-chip-item">
              Chip #{chip.shotNumber}: {chip.club ? CLUB_LABELS[chip.club] : '?'} →{' '}
              {chip.result ? RESULT_LABELS[chip.result] : '?'}
            </div>
          ))
        )}
        <h4 className="gm-wizard-subtitle">Add a chip / pitch:</h4>
        <div className="gm-grid">
          {CHIP_CLUB_LINEUP.map((club) => (
            <Button key={club} selected={selections.chipClub === club} onClick={() => actions.selectChipClub(club)}>
              {CLUB_LABELS[club]}
            </Button>
          ))}
        </div>
        <div className="gm-grid gm-grid--3">
          {CHIP_RESULT_OPTIONS.map(({ result, label }) => (
            <Button key={result} selected={selections.chipResult === result} onClick={() => actions.selectChipResult(result)}>
              {label}
            </Button>
          ))}
        </div>
        <div className="gm-wizard-actions">
          <Button onClick={() => actions.addChipShot()}>➕ Add Chip</Button>
          <Button variant="primary" onClick={() => actions.finishChipping()}>
            ⛳ Done — Go to Green
          </Button>
          <Button variant="ghost" onClick={() => actions.undo()}>
            ↩ Back
          </Button>
        </div>
      </Section>
    )
  }

  // GREEN
  return (
    <Section title="Putting">
      <div className="gm-counter">
        <Button onClick={() => actions.adjustPutts(-1)} aria-label="Fewer putts">
          −
        </Button>
        <span className="gm-counter__value" aria-live="polite">
          {selections.putts}
        </span>
        <Button onClick={() => actions.adjustPutts(1)} aria-label="More putts">
          +
        </Button>
      </div>
      <h4 className="gm-wizard-subtitle">First putt length</h4>
      <div className="gm-grid">
        {PUTT_DISTANCE_OPTIONS.map((distance) => (
          <Button key={distance} selected={selections.puttDistance === distance} onClick={() => actions.selectPuttDistance(distance)}>
            {PUTT_DISTANCE_LABELS[distance]}
          </Button>
        ))}
      </div>
      <div className="gm-wizard-actions">
        <Button variant="accent" full onClick={() => actions.endHole()}>
          🏁 Finish Hole
        </Button>
        <Button variant="ghost" onClick={() => actions.undo()}>
          ↩ Back
        </Button>
      </div>
    </Section>
  )
}
