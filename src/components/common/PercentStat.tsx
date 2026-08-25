/**
 * PercentStat — renders an attempt/success rate with a safe dash fallback.
 */
import type { RateStat } from '../../analytics/singleRound/roundDeepDive'

interface PercentStatProps {
  label: string
  stat: RateStat
}

export function PercentStat({ label, stat }: PercentStatProps) {
  const display = stat.percentage === null ? '-' : `${stat.percentage}%`
  const detail = `${stat.successes}/${stat.attempts}`
  return (
    <div className="gm-stat-row">
      <span className="gm-stat-row__label">{label}</span>
      <span className="gm-stat-row__value">
        {display} <span style={{ color: '#aaa', fontWeight: 'normal' }}>({detail})</span>
      </span>
    </div>
  )
}
