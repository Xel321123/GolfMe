/**
 * Backup & export serializers (pure — no DOM).
 *
 * Produces/consumes the JSON backup format (an array of schema v2 rounds)
 * and the per-round CSV export. The download itself (file dialogs, object
 * URLs) is handled by the UI layer via {@link downloadTextFile}.
 */
import { roundSchema } from '../../domain/models/entities'
import type { Round } from '../../domain/models/entities'

/**
 * Serializes rounds to a pretty-printed JSON backup document.
 *
 * @param rounds - Rounds to include in the backup.
 * @returns A JSON string (array of round objects).
 */
export function serializeRoundsToJson(rounds: readonly Round[]): string {
  return JSON.stringify(rounds, null, 2)
}

/**
 * Parses a JSON backup document into validated rounds.
 *
 * @param text - Raw file/string content.
 * @returns The validated rounds.
 * @throws {Error} On invalid JSON, or when any entry fails schema validation
 *                 (the import is all-or-nothing so the user can fix the file
 *                 instead of silently losing records).
 */
export function parseRoundsFromJson(text: string): Round[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Invalid JSON: the backup file could not be parsed.')
  }
  if (!Array.isArray(parsed)) {
    throw new Error('Invalid backup: expected an array of rounds.')
  }

  const rounds: Round[] = []
  for (const item of parsed) {
    const result = roundSchema.safeParse(item)
    if (!result.success) {
      throw new Error(
        `Invalid backup: an entry failed validation (${result.error.issues
          .map((i) => `${i.path.join('.') || 'value'}: ${i.message}`)
          .join('; ')})`
      )
    }
    rounds.push(result.data)
  }
  return rounds
}

/**
 * Serializes one round to CSV (semicolon-safe quoting per RFC 4180).
 *
 * Columns: Course, Date, Hole, Par, Shot#, Club, Quality, Distance(m),
 * Result, Putts, PuttDistance. Enum values are exported as their canonical
 * string codes so the file round-trips losslessly.
 *
 * @param round - The round to export.
 * @returns CSV content including the header row.
 */
export function roundToCsv(round: Round): string {
  const header = [
    'Course',
    'Date',
    'Hole',
    'Par',
    'ShotNumber',
    'Club',
    'Quality',
    'DistanceMeters',
    'Result',
    'Putts',
    'PuttDistance',
  ]

  const rows = round.shots.map((shot) => [
    round.courseName,
    round.startedAt.slice(0, 10),
    String(shot.holeNumber),
    String(round.holes.find((h) => h.holeNumber === shot.holeNumber)?.par ?? ''),
    String(shot.shotNumber),
    shot.club ?? '',
    shot.quality ?? '',
    shot.distanceMeters !== undefined ? String(shot.distanceMeters) : '',
    shot.result ?? '',
    shot.putts !== undefined ? String(shot.putts) : '',
    shot.puttDistance ?? '',
  ])

  const escapeCell = (cell: string): string => {
    if (/[",\n]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`
    return cell
  }

  return [header, ...rows].map((row) => row.map(escapeCell).join(',')).join('\n')
}
