/**
 * HistoryList — archived rounds with per-round CSV export and delete.
 */
import { useState } from 'react'
import type { Round } from '../../domain/models/entities'
import { Button } from '../common/Button'
import { ConfirmDialog } from '../common/ConfirmDialog'
import './History.css'

interface HistoryListProps {
  rounds: Round[]
  onDelete: (id: string) => void
  onExportCsv: (round: Round) => void
}

export function HistoryList({ rounds, onDelete, onExportCsv }: HistoryListProps) {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const pendingRound = rounds.find((r) => r.id === pendingDeleteId) ?? null

  if (rounds.length === 0) {
    return (
      <p style={{ color: '#777', fontSize: 13 }}>No saved rounds yet. Complete a round to archive it here.</p>
    )
  }

  return (
    <>
      {rounds.map((round) => (
        <div key={round.id} className="gm-history-item">
          <div>
            <strong>{round.startedAt.slice(0, 10)}</strong>
            <br />
            <span style={{ color: '#aaa', fontSize: 12 }}>{round.courseName}</span>
          </div>
          <div className="gm-history-item__actions">
            <Button variant="ghost" onClick={() => onExportCsv(round)} style={{ padding: '6px 10px', fontSize: 12 }}>
              CSV
            </Button>
            <Button
              variant="danger"
              onClick={() => setPendingDeleteId(round.id)}
              style={{ padding: '6px 10px', fontSize: 12 }}
            >
              🗑
            </Button>
          </div>
        </div>
      ))}
      {pendingRound !== null && (
        <ConfirmDialog
          title="Delete round"
          message={`Permanently delete the round from "${pendingRound.courseName}" (${pendingRound.startedAt.slice(0, 10)})?`}
          confirmLabel="Delete"
          danger
          onConfirm={() => {
            onDelete(pendingRound.id)
            setPendingDeleteId(null)
          }}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}
    </>
  )
}
