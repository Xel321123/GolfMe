/**
 * AggregatePanel — multi-round aggregated statistics + handicap.
 */
import type { AggregateStats } from '../../analytics/aggregates/aggregateStats'
import { Section } from '../common/Section'
import { StatRow } from '../common/StatRow'
import { PercentStat } from '../common/PercentStat'
import './Dashboard.css'

interface AggregatePanelProps {
  stats: AggregateStats
}

export function AggregatePanel({ stats }: AggregatePanelProps) {
  const fmt = (value: number | null, digits = 1): string =>
    value === null ? '-' : value.toFixed(digits)

  return (
    <Section title="Aggregates" accent="blue">
      <StatRow label="Rounds analyzed" value={stats.roundCount} />
      <StatRow label="Holes played" value={stats.holeCount} />
      <StatRow label="Scoring average" value={fmt(stats.scoringAverage)} highlight />
      <StatRow label="Avg vs par" value={fmt(stats.scoreVsParAverage)} />
      <StatRow label="Best round" value={stats.bestRound === null ? '-' : stats.bestRound} />
      <StatRow label="Worst round" value={stats.worstRound === null ? '-' : stats.worstRound} />
      <PercentStat label="Driving accuracy" stat={stats.fairway} />
      <PercentStat label="Greens (GIR)" stat={stats.gir} />
      <StatRow label="Putts / hole" value={fmt(stats.puttsPerHole)} />
      <StatRow label="Putts / round" value={fmt(stats.puttsPerRound)} />
      <PercentStat label="Sand saves" stat={stats.sandSaves} />
      <PercentStat label="Scrambling" stat={stats.scramble} />

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
        ).map(([key, label]) => {
          const count = stats.distribution[key]
          const pct = stats.distribution.total > 0 ? (count / stats.distribution.total) * 100 : 0
          return (
            <div key={key} className="gm-distribution__row">
              <span className="gm-distribution__label">{label}</span>
              <span className="gm-distribution__bar-track">
                <span
                  className="gm-distribution__bar"
                  style={{ width: `${pct}%` }}
                  aria-hidden="true"
                />
              </span>
              <span className="gm-distribution__count">
                {count} ({pct.toFixed(0)}%)
              </span>
            </div>
          )
        })}
      </div>

      <h4 className="gm-wizard-subtitle" style={{ marginTop: 10 }}>
        Handicap
      </h4>
      <StatRow
        label="Index"
        value={
          stats.handicap.current === null
            ? '— (needs 3+ rounds)'
            : `${stats.handicap.current.toFixed(1)}${stats.handicap.estimated ? ' (est.)' : ''}`
        }
      />
      <StatRow
        label="Differentials"
        value={
          stats.handicap.differentials.length > 0
            ? stats.handicap.differentials.map((d) => d.differential.toFixed(1)).join(', ')
            : '-'
        }
      />
    </Section>
  )
}
