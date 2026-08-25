/**
 * LiveDashboard — real-time stats for the active round.
 *
 * Delegates all math to the pure analytics engine; this component only
 * formats and displays. Recomputes via `useMemo` on round identity change.
 */
import { useMemo } from 'react'
import type { Round } from '../../domain/models/entities'
import { computeRoundDeepDive } from '../../analytics/singleRound/roundDeepDive'
import { Section } from '../common/Section'
import { StatRow } from '../common/StatRow'
import { PercentStat } from '../common/PercentStat'

interface LiveDashboardProps {
  round: Round
}

export function LiveDashboard({ round }: LiveDashboardProps) {
  const stats = useMemo(() => computeRoundDeepDive(round), [round])

  return (
    <Section title="Live dashboard" accent="blue">
      <StatRow label="Holes played" value={stats.holesPlayed} />
      <StatRow label="Score vs par" value={`${stats.scoreText} (Par: ${stats.totalPar})`} highlight />
      <StatRow label="Total strokes" value={stats.totalStrokes} />
      <StatRow
        label="Putts"
        value={
          stats.putts.perHole === null
            ? `${stats.putts.total}`
            : `${stats.putts.total} (avg ${stats.putts.perHole.toFixed(1)})`
        }
      />
      <PercentStat label="Fairways (FIR)" stat={stats.fairway} />
      <PercentStat label="Greens (GIR)" stat={stats.gir} />
      <PercentStat label="Scrambling" stat={stats.scramble} />
      <PercentStat label="Sand saves" stat={stats.sandSaves} />
    </Section>
  )
}
