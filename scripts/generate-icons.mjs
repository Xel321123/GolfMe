/**
 * GolfMe PWA icon generator.
 *
 * Dependency-free Node script (uses only the built-in `zlib` module) that
 * renders the GolfMe icon set as PNGs:
 *
 *   public/icons/favicon-32.png          32x32  (rounded square)
 *   public/icons/pwa-192x192.png         192x192 (rounded square)
 *   public/icons/pwa-512x512.png         512x512 (rounded square)
 *   public/icons/pwa-maskable-512x512.png 512x512 (full-bleed, 80% safe zone)
 *   public/icons/apple-touch-icon.png    180x180 (full-bleed)
 *
 * Design: dark rounded tile, white golf flag with green pennant, and a white
 * golf ball. Regenerate any time with: `npm run icons`.
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')

// ---------------------------------------------------------------------------
// Minimal PNG encoder (8-bit RGBA, no external dependencies)
// ---------------------------------------------------------------------------

/** CRC-32 table-based checksum (PNG chunk integrity). */
function crc32(buf) {
  let table = crc32.table
  if (!table) {
    table = crc32.table = new Int32Array(256)
    for (let n = 0; n < 256; n += 1) {
      let c = n
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      table[n] = c
    }
  }
  let crc = -1
  for (let i = 0; i < buf.length; i += 1) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff]
  return (crc ^ -1) >>> 0
}

/** Encodes one PNG chunk (length + type + data + CRC). */
function pngChunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([length, typeBuf, data, crc])
}

/**
 * Encodes an RGBA PNG.
 * @param width  - Image width in pixels.
 * @param height - Image height in pixels.
 * @param pixelAt - `(x, y) => [r, g, b, a]` color callback.
 */
function encodePng(width, height, pixelAt) {
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  let offset = 0
  for (let y = 0; y < height; y += 1) {
    raw[offset] = 0 // filter type: none
    offset += 1
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a] = pixelAt(x, y)
      raw[offset] = r
      raw[offset + 1] = g
      raw[offset + 2] = b
      raw[offset + 3] = a
      offset += 4
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

// ---------------------------------------------------------------------------
// Icon artwork (normalized 0..1 coordinate space)
// ---------------------------------------------------------------------------

const BG = [18, 18, 18] // design token --bg-color
const GREEN = [76, 175, 80] // design token --primary
const WHITE = [224, 224, 224] // design token --text-color

/** True when (nx, ny) is inside a centered rounded rectangle. */
function insideRoundedRect(nx, ny, radius) {
  const half = 0.5
  const left = 0.5 - half
  const right = 0.5 + half
  const top = 0.5 - half
  const bottom = 0.5 + half
  const cx = Math.max(left + radius, Math.min(nx, right - radius))
  const cy = Math.max(top + radius, Math.min(ny, bottom - radius))
  return Math.hypot(nx - cx, ny - cy) <= radius
}

/**
 * Samples the artwork at normalized coordinates.
 *
 * @param nx - Normalized x in [0, 1].
 * @param ny - Normalized y in [0, 1].
 * @param rounded - Apply the rounded-tile mask (false = full bleed).
 * @param scale - Draw content scaled into a centered box (maskable safe zone).
 * @returns `[r, g, b, a]`.
 */
function sample(nx, ny, rounded, scale) {
  const cx = 0.5
  const cy = 0.5
  // Map back from the safe-zone box to the design coordinates.
  const dx = cx + (nx - cx) / scale
  const dy = cy + (ny - cy) / scale

  if (rounded && !insideRoundedRect(dx, dy, 0.2)) return [0, 0, 0, 0]

  // Golf ball (solid white with a subtle radial shading and green stripe).
  const ballX = 0.42
  const ballY = 0.68
  const ballR = 0.17
  const dist = Math.hypot(dx - ballX, dy - ballY)
  if (dist <= ballR) {
    const shade = Math.round(255 * (1 - (dist / ballR) * 0.12))
    if (Math.abs(dy - ballY) < ballR * 0.12) return [GREEN[0], GREEN[1], GREEN[2], 255]
    return [shade, shade, shade, 255]
  }

  // Flag pole.
  if (Math.abs(dx - 0.58) <= 0.012 && dy >= 0.2 && dy <= 0.62) return [...WHITE, 255]

  // Flag pennant (right-pointing triangle).
  if (dx >= 0.58 && dx <= 0.8 && dy >= 0.2 && dy <= 0.36) {
    const t = (dy - 0.2) / (0.36 - 0.2)
    if (dx <= 0.58 + 0.22 * t) return [...GREEN, 255]
  }

  return [...BG, 255]
}

/** Renders one icon file. */
function render(size, { rounded = true, scale = 1, filename }) {
  const png = encodePng(size, size, (x, y) =>
    sample((x + 0.5) / size, (y + 0.5) / size, rounded, scale)
  )
  writeFileSync(join(OUT_DIR, filename), png)
  console.log(`  ✓ ${filename} (${size}x${size})`)
}

mkdirSync(OUT_DIR, { recursive: true })
console.log('Generating GolfMe icons:')
render(32, { filename: 'favicon-32.png' })
render(192, { filename: 'pwa-192x192.png' })
render(512, { filename: 'pwa-512x512.png' })
render(512, { rounded: false, scale: 0.8, filename: 'pwa-maskable-512x512.png' })
render(180, { rounded: false, scale: 0.85, filename: 'apple-touch-icon.png' })
console.log('Done.')
