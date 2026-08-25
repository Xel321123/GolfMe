/**
 * Browser (web) geolocation provider.
 *
 * Wraps `navigator.geolocation` behind the {@link GeolocationProvider}
 * contract. Lives outside `src/services` because it legitimately touches a
 * browser global; the core layers never see it.
 */
import type { GeoPosition, GeolocationProvider } from '../services/geolocation/types'

/** High-accuracy acquisition timeout in milliseconds. */
const POSITION_TIMEOUT_MS = 10_000

/**
 * Browser-backed provider using `navigator.geolocation.getCurrentPosition`.
 * Rejects with a descriptive Error on permission/timeout/hardware failures.
 */
export const browserGeolocationProvider: GeolocationProvider = {
  name: 'browser-geolocation',

  isAvailable(): boolean {
    return typeof navigator !== 'undefined' && 'geolocation' in navigator
  },

  getCurrentPosition(): Promise<GeoPosition> {
    return new Promise((resolve, reject) => {
      if (!browserGeolocationProvider.isAvailable()) {
        reject(new Error('Geolocation is not available in this browser.'))
        return
      }
      navigator.geolocation.getCurrentPosition(
        (position) =>
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters: Math.round(position.coords.accuracy),
          }),
        (error) => {
          const code = error.code
          const message =
            code === error.PERMISSION_DENIED
              ? 'Location permission denied. Enable location access and try again.'
              : code === error.POSITION_UNAVAILABLE
                ? 'Position unavailable. Move to an open area and try again.'
                : code === error.TIMEOUT
                  ? 'Location request timed out. Try again.'
                  : `Geolocation error (code ${code}).`
          reject(new Error(message))
        },
        { enableHighAccuracy: true, timeout: POSITION_TIMEOUT_MS, maximumAge: 5_000 }
      )
    })
  },
}
