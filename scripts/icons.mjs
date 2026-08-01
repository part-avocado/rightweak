// BEGIN AI USAGE SECTION
// This section basically creates the image icons for the extension. I could not be bothered to make it myself. :D

import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const out = join(dirname(fileURLToPath(import.meta.url)), '../public/icons')
mkdirSync(out, { recursive: true })

function crc32(buf) {
  const table = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  let crc = 0xffffffff
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function pngRgba(size, pixelFn) {
  const raw = Buffer.alloc(size * (1 + size * 4))
  for (let y = 0; y < size; y++) {
    const row = y * (1 + size * 4)
    raw[row] = 0
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelFn(x, y, size)
      raw.set([r, g, b, a], row + 1 + x * 4)
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// Rounded-square gradient tile with a white play-triangle and a "sun" dot —
// media, images, video.
function draw(x, y, size) {
  const u = x / size
  const v = y / size
  // rounded-rect mask
  const r = 0.18
  const cx = Math.max(r, Math.min(1 - r, u))
  const cy = Math.max(r, Math.min(1 - r, v))
  const dist = Math.hypot(u - cx, v - cy)
  const edge = 1.5 / size
  const mask = Math.max(0, Math.min(1, (r - dist) / edge + 0.5))
  if (mask === 0) return [0, 0, 0, 0]

  // diagonal gradient: blue -> violet
  const t = (u + v) / 2
  let R = 59 + (139 - 59) * t
  let G = 130 + (92 - 130) * t
  let B = 246 + (246 - 246) * t

  // sun dot, upper-left
  const sd = Math.hypot(u - 0.32, v - 0.32)
  const sun = Math.max(0, Math.min(1, (0.1 - sd) / edge + 0.5))

  // play triangle, lower-right: vertices (0.48,0.42) (0.48,0.82) (0.82,0.62)
  const inTri = (() => {
    const ax = 0.48, ay = 0.42, bx = 0.48, by = 0.82, cxx = 0.82, cyy = 0.62
    const s1 = (u - ax) * (by - ay) - (v - ay) * (bx - ax)
    const s2 = (u - bx) * (cyy - by) - (v - by) * (cxx - bx)
    const s3 = (u - cxx) * (ay - cyy) - (v - cyy) * (ax - cxx)
    return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0) ? 1 : 0
  })()

  const white = Math.min(1, sun + inTri)
  R = R + (255 - R) * white
  G = G + (255 - G) * white
  B = B + (255 - B) * white
  return [Math.round(R), Math.round(G), Math.round(B), Math.round(255 * mask)]
}

for (const size of [16, 32, 48, 128]) {
  writeFileSync(join(out, `icon${size}.png`), pngRgba(size, draw))
}
console.log('icons -> public/icons')

// END AI USAGE SECTION