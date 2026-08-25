/**
 * Active round session state.
 *
 * Beyond the round itself, the session tracks the wizard's UI position
 * (current hole, active step, in-progress selections) so that a browser
 * crash, tab close, or accidental reload can be recovered pixel-perfect.
 * This mirrors the legacy app's flow while fixing its biggest gap: the
 * legacy version never persisted these fields, so every reload reset the
 * user to Hole 1.
 */
import { z } from 'zod'
import { Club, PuttDistance, RoundStep, ShotQuality, ShotResult } from '../enums/golf'
import type { Round } from './entities'
import { roundSchema } from './entities'

/**
 * Transient selections captured while the wizard advances through its steps.
 * `putts` is a required field (no zod default) so its inferred type is
 * strictly `number` — every factory initializes it explicitly.
 */
export const stepSelectionsSchema = z.object({
  club: z.nativeEnum(Club).optional(),
  quality: z.nativeEnum(ShotQuality).optional(),
  result: z.nativeEnum(ShotResult).optional(),
  putts: z.number().int().min(0),
  puttDistance: z.nativeEnum(PuttDistance).optional(),
  chipClub: z.nativeEnum(Club).optional(),
  chipResult: z.nativeEnum(ShotResult).optional(),
})
export type StepSelections = z.infer<typeof stepSelectionsSchema>

/** Fully serializable snapshot of an in-progress round session. */
export const activeRoundStateSchema = z.object({
  round: roundSchema,
  currentHole: z.number().int().min(1).max(18),
  activeStep: z.nativeEnum(RoundStep),
  selections: stepSelectionsSchema,
})
export type ActiveRoundState = z.infer<typeof activeRoundStateSchema>

/** Factory for a pristine session state; throws on invalid input. */
export function createActiveRoundState(round: Round): ActiveRoundState {
  return activeRoundStateSchema.parse({
    round,
    currentHole: 1,
    activeStep: RoundStep.START,
    selections: { putts: 2 },
  })
}
