/**
 * RoundSelector — pick specific rounds for aggregation, or "All Rounds".
 */
import { useState } from 'react'
import type { Round } from '../../domain/models/entities'
import type { RoundSelection } from '../../analytics/selectors/roundSelection'
import { Button } from '../common/Button'
import { Section } from '../common/Section'

interface RoundSelectorProps {
  rounds: Round[]
  selection: RoundSelection
  onChange: (selection: RoundSelection) => void
}

export function RoundSelector({ rounds, selection, onChange }: RoundSelectorProps) {
  const [expanded, setExpanded] = useState(false)
  const allSelected = selection.mode === 'all'

  const toggleRound = (id: string) => {
    const ids = new Set(selection.mode === 'ids' ? selection.ids ?? [] : [])
    if (ids.has(id)) ids.delete(id)
    else ids.add(id)
    onChange(ids.size > 0 ? { mode: 'ids', ids: [...ids] } : { mode: 'all' })
  }

  return (
    <Section title="Round selection" accent="blue">
      <Button variant={allSelected ? 'primary' : 'ghost'} full selected={allSelected} onClick={() => onChange({ mode: 'all' })}>
        All Rounds ({rounds.length})
      </Button>
      <Button variant="ghost" full onClick={() => setExpanded((e) => !e)} style={{ marginTop: 6 }}>
        {expanded ? 'Hide round list' : 'Choose specific rounds…'}
      </Button>
      {expanded && (
        <div style={{ marginTop: 8 }}>
          {rounds.map((round) => {
            const checked = selection.mode === 'ids' && (selection.ids ?? []).includes(round.id)
            return (
              <label key={round.id} className="gm-selector-row">
                <input type="checkbox" checked={checked} onChange={() => toggleRound(round.id)} />
                <span>
                  {round.startedAt.slice(0, 10)} — {round.courseName}
                </span>
              </label>
            )
          })}
        </div>
      )}
    </Section>
  )
}
