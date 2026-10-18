/**
 * Generates the PWA / home-screen icons.
 *
 * Written with no dependencies on purpose: Node's zlib is enough to emit a
 * valid PNG, so there is nothing to install just to get app icons.
 *
 * Design matches the YouTube app tile: a red rounded square with the white
 * play triangle. On iOS the OS applies its own corner mask, so the artwork is
 * full-bleed.
 *
 *   node scripts/generate-icons.mjs
 */

import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(here, '..', 'public', 'icons')

const BRAND_RED = [255, 0, 0]
const WHITE = [255, 255, 255]

/* ------------------------------------------------------------------ PNG ---- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([length, typeBuf, data, crc])
}

function encodePng(width, height, rgba) {
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0 // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type: RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/* ------------------------------------------------------------- geometry ---- */

function inRoundedRect(x, y, size, radius) {
  const half = size / 2
  const dx = Math.max(Math.abs(x - half) - (half - radius), 0)
  const dy = Math.max(Math.abs(y - half) - (half - radius), 0)
  return dx * dx + dy * dy <= radius * radius
}

function edge(ax, ay, bx, by, px, py) {
  return (px - ax) * (by - ay) - (py - ay) * (bx - ax)
}

function inTriangle(px, py, a, b, c) {
  const d1 = edge(a[0], a[1], b[0], b[1], px, py)
  const d2 = edge(b[0], b[1], c[0], c[1], px, py)
  const d3 = edge(c[0], c[1], a[0], a[1], px, py)
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0
  return !(hasNeg && hasPos)
}

/**
 * Renders one icon. Interior sampling at 4x4 per pixel gives clean edges
 * without needing any graphics library.
 */
function renderIcon(size, { cornerRadiusRatio = 0.225, samples = 4 } = {}) {
  const buffer = Buffer.alloc(size * size * 4)
  const radius = size * cornerRadiusRatio

  const triangleA = [size * 0.385, size * 0.295]
  const triangleB = [size * 0.385, size * 0.705]
  const triangleC = [size * 0.735, size * 0.5]

  const step = 1 / samples
  const total = samples * samples

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let rSum = 0
      let gSum = 0
      let bSum = 0
      let aSum = 0

      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const px = x + (sx + 0.5) * step
          const py = y + (sy + 0.5) * step

          if (!inRoundedRect(px, py, size, radius)) continue

          aSum += 1

          if (inTriangle(px, py, triangleA, triangleB, triangleC)) {
            rSum += WHITE[0]
            gSum += WHITE[1]
            bSum += WHITE[2]
          } else {
            rSum += BRAND_RED[0]
            gSum += BRAND_RED[1]
            bSum += BRAND_RED[2]
          }
        }
      }

      const i = (y * size + x) * 4
      if (aSum === 0) {
        buffer[i] = 0
        buffer[i + 1] = 0
        buffer[i + 2] = 0
        buffer[i + 3] = 0
      } else {
        buffer[i] = Math.round(rSum / aSum)
        buffer[i + 1] = Math.round(gSum / aSum)
        buffer[i + 2] = Math.round(bSum / aSum)
        buffer[i + 3] = Math.round((aSum / total) * 255)
      }
    }
  }

  return encodePng(size, size, buffer)
}

/* ------------------------------------------------------------------ run ---- */

const targets = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  // Maskable icons must survive a circular crop, so the corner radius is larger
  // and the artwork is pulled in slightly.
  { file: 'icon-maskable-512.png', size: 512, cornerRadiusRatio: 0.5 },
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'favicon-32.png', size: 32 },
  { file: 'favicon-16.png', size: 16 },
]

mkdirSync(outDir, { recursive: true })

for (const { file, size, cornerRadiusRatio } of targets) {
  const png = renderIcon(size, cornerRadiusRatio ? { cornerRadiusRatio } : undefined)
  writeFileSync(resolve(outDir, file), png)
  console.log(`${file}  ${size}x${size}  ${(png.length / 1024).toFixed(1)} KB`)
}

writeFileSync(
  resolve(outDir, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7.2" fill="#FF0000"/>
  <path d="M12.3 9.4v13.2L23.5 16 12.3 9.4Z" fill="#fff"/>
</svg>
`,
)
console.log('favicon.svg')

console.log(`\nWrote ${targets.length + 1} files to public/icons`)
