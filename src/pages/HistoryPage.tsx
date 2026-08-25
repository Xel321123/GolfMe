/**
 * HistoryPage — archived rounds, backup export/import, CSV exports.
 */
import { useState } from 'react'
import { RoundPersistenceService } from '../services/persistence/RoundPersistenceService'
import { useRoundHistory } from '../hooks/useRoundHistory'
import { HistoryList } from '../components/history/HistoryList'
import { BackupControls } from '../components/history/BackupControls'
import { Section } from '../components/common/Section'
import { ErrorBanner } from '../components/common/ErrorBanner'

interface HistoryPageProps {
  persistence: RoundPersistenceService
}

export function HistoryPage({ persistence }: HistoryPageProps) {
  const { rounds, loading, error, clearError, deleteRound, importRounds, exportJson, exportCsv } =
    useRoundHistory(persistence)
  const [notice, setNotice] = useState<string | null>(null)

  const handleImport = async (text: string) => {
    const count = await importRounds(text)
    if (count > 0) setNotice(`Backup imported: ${count} round(s).`)
  }

  if (loading) {
    return <p style={{ color: 'var(--muted)' }}>Loading history…</p>
  }

  return (
    <>
      {error !== null && <ErrorBanner message={error} onDismiss={clearError} />}
      {notice !== null && <ErrorBanner message={notice} onDismiss={() => setNotice(null)} />}
      <Section title="Saved rounds (IndexedDB)">
        <HistoryList rounds={rounds} onDelete={(id) => void deleteRound(id)} onExportCsv={exportCsv} />
        <BackupControls
          onExportJson={exportJson}
          onImportJson={(text) => void handleImport(text)}
          onExportAllCsv={() => {
            if (rounds.length === 0) {
              setNotice('Nothing to export yet.')
              return
            }
            rounds.forEach((round) => exportCsv(round))
            setNotice(`Exported ${rounds.length} CSV file(s).`)
          }}
        />
      </Section>
    </>
  )
}
