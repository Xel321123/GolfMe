/**
 * BackupControls — JSON backup export/import + CSV-all export.
 */
import { useRef } from 'react'
import { Button } from '../common/Button'

interface BackupControlsProps {
  onExportJson: () => void
  onImportJson: (text: string) => void
  onExportAllCsv: () => void
}

export function BackupControls({ onExportJson, onImportJson, onExportAllCsv }: BackupControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') onImportJson(reader.result)
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  return (
    <>
      <div className="gm-backup-grid">
        <Button variant="ghost" onClick={onExportJson}>
          📥 Download Backup
        </Button>
        <Button variant="ghost" onClick={() => fileInputRef.current?.click()}>
          📤 Load Backup
        </Button>
        <Button variant="ghost" onClick={onExportAllCsv}>
          📊 Export All CSV
        </Button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={handleFile}
      />
    </>
  )
}
