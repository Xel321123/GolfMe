/**
 * GpsStatus — live GPS accuracy indicator (browser `watchPosition`).
 *
 * The provider stays behind the injected {@link GeolocationProvider} for
 * acquisitions; this status pill additionally subscribes to continuous
 * accuracy updates for the "searching / good / poor" indicator.
 */
import { useEffect, useState } from 'react'

type AccuracyState = 'idle' | 'searching' | 'good' | 'ok' | 'poor'

const ACCURACY_COLORS: Record<AccuracyState, string> = {
  idle: 'grey',
  searching: 'grey',
  good: '#4caf50',
  ok: '#ffeb3b',
  poor: '#f44336',
}

export function GpsStatus() {
  const [state, setState] = useState<AccuracyState>('idle')
  const [accuracy, setAccuracy] = useState<string>('Unavailable')

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setState('idle')
      return
    }
    setState('searching')
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const meters = Math.round(position.coords.accuracy)
        setAccuracy(`±${meters}m`)
        setState(meters <= 6 ? 'good' : meters <= 12 ? 'ok' : 'poor')
      },
      () => {
        setState('idle')
        setAccuracy('Unavailable')
      },
      { enableHighAccuracy: true }
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  return (
    <div className="gm-gps">
      <span
        className="gm-gps__dot"
        style={{ backgroundColor: ACCURACY_COLORS[state] }}
        aria-hidden="true"
      />
      <span>GPS: {accuracy}</span>
    </div>
  )
}
