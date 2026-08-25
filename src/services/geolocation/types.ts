/**
 * Geolocation provider abstraction.
 *
 * The domain/services layers must never call platform GPS APIs directly.
 * Instead they consume this interface; the browser implementation is wired
 * in at the composition root, and the React Native migration swaps in a
 * `react-native-geolocation-service` implementation with no other changes.
 */

/** Normalized GPS position handed to the domain layer. */
export interface GeoPosition {
  latitude: number
  longitude: number
  /** Reported accuracy radius in meters (when available). */
  accuracyMeters?: number
}

/** Contract for obtaining the current device position. */
export interface GeolocationProvider {
  readonly name: string
  /** Whether the provider can be used in the current runtime. */
  isAvailable(): boolean
  /**
   * Resolves the current position.
   * @throws {Error} When the platform cannot determine a position (permissions
   *                 denied, timeout, unavailable hardware).
   */
  getCurrentPosition(): Promise<GeoPosition>
}
