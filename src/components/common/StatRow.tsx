/**
 * StatRow — label/value pair used by dashboards and scorecards.
 */
import type { ReactNode } from 'react'
import './StatRow.css'

interface StatRowProps {
  label: string
  value: ReactNode
  /** Highlights the value with the accent color. */
  highlight?: boolean
}

export function StatRow({ label, value, highlight = false }: StatRowProps) {
  return (
    <div className="gm-stat-row">
      <span className="gm-stat-row__label">{label}</span>
      <span className={highlight ? 'gm-stat-row__value gm-stat-row__value--highlight' : 'gm-stat-row__value'}>
        {value}
      </span>
    </div>
  )
}
