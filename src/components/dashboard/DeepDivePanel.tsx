/**
 * DeepDivePanel — single-round deep dive + hole-by-hole momentum.
 */
import type { RoundDeepDive } from '../../analytics/singleRound/roundDeepDive'
import { SCORE_CATEGORY_LABELS } from '../../lib/labels'
import { Section } from '../common/Section'
import { StatRow } from '../common/StatRow'
import { PercentStat } from '../common/PercentStat'

interface DeepDivePanelProps {
  dive: RoundDeepDive
}

export function DeepDivePanel({ dive }: DeepDivePanelProps) {
  return (
    <Section title="Round deep dive" accent="green">
      <StatRow label="Score vs par" value={`${dive.scoreText} (Par ${dive.totalPar})`} highlight />
      <StatRow label="Total strokes" value={dive.totalStrokes} />
      <StatRow
        label="Putts"
        value={
          dive.putts.perHole === null
            ? `${dive.putts.total}`
            : `${dive.putts.total} (${dive.putts.perHole.toFixed(1)}/hole)`
        }
      />
      <PercentStat label="Fairways (FIR)" stat={dive.fairway} />
      <PercentStat label="Greens (GIR)" stat={dive.gir} />
      <PercentStat label="Scrambling" stat={dive.scramble} />
      <PercentStat label="Sand saves" stat={dive.sandSaves} />

      <h4 className="gm-wizard-subtitle" style={{ marginTop: 10 }}>
        Hole-by-hole momentum
      </h4>
      <div className="gm-momentum">
        {dive.momentum.map((m) => (
          <div
            key={m.holeNumber}
            className="gm-momentum__cell"
            title={SCORE_CATEGORY_LABELS[m.category]}
          >
            <span className="gm-momentum__hole">{m.holeNumber}</span>
            <span className="gm-momentum__score">{m.scoreVsPar > 0 ? `+${m.scoreVsPar}` : m.scoreVsPar}</span>
          </div>
        ))}
        {dive.momentum.length === 0 && (
          <span style={{ color: '#777', fontSize: 12 }}>No completed holes yet.</span>
        )}
      </div>

      <h4 className="gm-wizard-subtitle" style={{ marginTop: 10 }}>
        Performance distribution
      </h4>
      <div className="gm-distribution">
        {(
          [
            ['eagles', 'Eagle+'],
            ['birdies', 'Birdie'],
            ['pars', 'Par'],
            ['bogeys', 'Bogey'],
            ['doubleBogeys', 'Double'],
            ['worse', 'Worse'],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="gm-distribution__row">
            <span className="gm-distribution__label">{label}</span>
            <span className="gm-distribution__count">{dive.distribution[key]}</span>
          </div>
        ))}
      </div>
    </Section>
  )
}
