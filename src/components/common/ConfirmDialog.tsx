/**
 * ConfirmDialog — accessible replacement for `window.confirm`.
 *
 * Renders a modal overlay with Confirm/Cancel buttons; focus is trapped on
 * the dialog while open (ESC cancels). Use instead of blocking alerts so the
 * UI stays testable and keyboard-accessible.
 */
import { useEffect, useRef } from 'react'
import { Button } from './Button'
import './ConfirmDialog.css'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    confirmRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="gm-dialog-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="gm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="gm-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="gm-dialog-title" className="gm-dialog__title">
          {title}
        </h3>
        <p className="gm-dialog__message">{message}</p>
        <div className="gm-dialog__actions">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            ref={confirmRef}
            variant={danger ? 'danger' : 'primary'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
