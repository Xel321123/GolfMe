/**
 * useRoundSession — the shot-recording wizard's action surface.
 *
 * Wraps the pure round actions (`src/services/round/roundActions.ts`) with
 * the persistence-aware `update` from {@link usePersistentRound} and the
 * injected geolocation provider. Components call these actions exclusively;
 * they never mutate domain state directly.
 */
import { useCallback, useMemo, useState } from 'react'
import { Club, PuttDistance, ShotQuality, ShotResult } from '../domain/enums/golf'
import type { ActiveRoundState } from '../domain/models/roundSession'
import type { GeoPosition, GeolocationProvider } from '../services/geolocation/types'
import * as roundActions from '../services/round/roundActions'
import type { UsePersistentRoundReturn } from './usePersistentRound'

/** Errors as human-readable strings. */
function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** All wizard actions exposed to the UI. */
export interface RoundSessionActions {
  setCourseName: (name: string) => void
  selectPar: (par: number) => void
  changeHole: (delta: number) => void
  /** Records a new shot at the current GPS position. */
  startShot: () => Promise<void>
  selectClub: (club: Club) => void
  selectQuality: (quality: ShotQuality) => void
  confirmClubAndQuality: () => void
  selectResult: (result: ShotResult) => void
  confirmLanding: () => void
  /** Locks the current shot's endpoint and starts the next shot (GPS). */
  lockNextPosition: () => Promise<void>
  switchToChipMode: () => Promise<void>
  switchToGreenMode: () => Promise<void>
  selectChipClub: (club: Club) => void
  selectChipResult: (result: ShotResult) => void
  addChipShot: () => void
  finishChipping: () => void
  adjustPutts: (delta: number) => void
  selectPuttDistance: (distance: PuttDistance) => void
  endHole: () => void
  undo: () => void
  clearRound: () => void
}

/** Return shape of {@link useRoundSession}. */
export interface UseRoundSessionReturn {
  state: ActiveRoundState | null
  actions: RoundSessionActions
  /** True while a GPS position is being acquired. */
  gpsBusy: boolean
  /** Last GPS failure message, or null. */
  gpsError: string | null
  clearGpsError: () => void
}

/**
 * @param persistent - The persistence hook owning session state.
 * @param geolocation - Platform geolocation provider.
 */
export function useRoundSession(
  persistent: UsePersistentRoundReturn,
  geolocation: GeolocationProvider
): UseRoundSessionReturn {
  const { state, update } = persistent
  const [gpsBusy, setGpsBusy] = useState(false)
  const [gpsError, setGpsError] = useState<string | null>(null)

  const clearGpsError = useCallback(() => setGpsError(null), [])

  /** Runs a GPS-dependent action with busy/error handling. */
  const withGps = useCallback(
    async (action: (position: GeoPosition) => void) => {
      setGpsBusy(true)
      setGpsError(null)
      try {
        const position = await geolocation.getCurrentPosition()
        action(position)
      } catch (e) {
        setGpsError(toMessage(e))
      } finally {
        setGpsBusy(false)
      }
    },
    [geolocation]
  )

  const actions = useMemo<RoundSessionActions>(
    () => ({
      setCourseName: (name) => update((s) => roundActions.setCourseName(s, name)),
      selectPar: (par) => update((s) => roundActions.setParForHole(s, par)),
      changeHole: (delta) => update((s) => roundActions.changeHole(s, delta)),
      startShot: () => withGps((position) => update((s) => roundActions.startShot(s, position))),
      selectClub: (club) => update((s) => roundActions.selectClub(s, club)),
      selectQuality: (quality) => update((s) => roundActions.selectQuality(s, quality)),
      confirmClubAndQuality: () => update((s) => roundActions.confirmClubAndQuality(s)),
      selectResult: (result) => update((s) => roundActions.selectResult(s, result)),
      confirmLanding: () => update((s) => roundActions.confirmLanding(s)),
      lockNextPosition: () =>
        withGps((position) => update((s) => roundActions.lockNextPosition(s, position))),
      switchToChipMode: () =>
        withGps((position) => update((s) => roundActions.switchToChipMode(s, position))),
      switchToGreenMode: () =>
        withGps((position) => update((s) => roundActions.switchToGreenMode(s, position))),
      selectChipClub: (club) =>
        update((s) => ({ ...s, selections: { ...s.selections, chipClub: club } })),
      selectChipResult: (result) =>
        update((s) => ({ ...s, selections: { ...s.selections, chipResult: result } })),
      addChipShot: () =>
        update((s) => {
          const club = s.selections.chipClub ?? Club.SAND_WEDGE
          const result = s.selections.chipResult ?? ShotResult.ON_GREEN
          return roundActions.addChipShot(s, club, result)
        }),
      finishChipping: () => update((s) => roundActions.finishChipping(s)),
      adjustPutts: (delta) => update((s) => roundActions.adjustPutts(s, delta)),
      selectPuttDistance: (distance) => update((s) => roundActions.selectPuttDistance(s, distance)),
      endHole: () => update((s) => roundActions.endHole(s)),
      undo: () => update((s) => roundActions.undoAction(s)),
      clearRound: () => update((s) => roundActions.clearRoundShots(s)),
    }),
    [update, withGps]
  )

  return { state, actions, gpsBusy, gpsError, clearGpsError }
}
