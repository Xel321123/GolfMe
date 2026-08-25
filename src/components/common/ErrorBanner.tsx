/**
 * ErrorBanner — dismissible inline error notice.
 */
import { Button } from './Button'

interface ErrorBannerProps {
  message: string
  onDismiss: () => void
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      style={{
        background: 'rgba(244, 67, 54, 0.15)',
        border: '1px solid var(--danger)',
        color: '#ff8a80',
        borderRadius: 10,
        padding: '8px 10px',
        marginBottom: 10,
        fontSize: 13,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
      }}
    >
      <span>{message}</span>
      <Button variant="ghost" onClick={onDismiss} style={{ padding: '2px 10px', fontSize: 12 }}>
        Dismiss
      </Button>
    </div>
  )
}
