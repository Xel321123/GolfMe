/**
 * Browser file-download helper (UI layer only).
 */

/**
 * Triggers a client-side download of a text payload.
 *
 * @param filename - Suggested file name (e.g. `backup-2026-08-25.json`).
 * @param content - Text content to save.
 * @param mimeType - MIME type (default `text/plain`).
 */
export function downloadTextFile(filename: string, content: string, mimeType = 'text/plain'): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
