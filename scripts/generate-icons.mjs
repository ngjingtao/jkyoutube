/**
 * Generates every app icon and splash image, for both the PWA and Android.
 *
 * Written with no dependencies on purpose: Node's zlib is enough to emit a
 * valid PNG, so there is nothing to install just to produce icons.
 *
 * Design matches the YouTube app tile: a red rounded square with a white play
 * triangle. On iOS the OS applies its own corner mask, so the artwork is
 * full-bleed; Android uses an adaptive icon with a red background layer and the
 * triangle as the foreground layer.
 *
 *   node scripts/generate-icons.mjs
 */

import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const webIconDir = resolve(root, 'public', 'icons')
const androidRes = resolve(root, 'android', 'app', 'src', 'main', 'res')

const BRAND_RED = [255, 0, 0]
const WHITE = [255, 255, 255]
const SPLASH_BG = [15, 15, 15]

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

/* ----------------------------------------------------------- compositing --- */

function createBuffer(w, h, fill) {
  const buf = Buffer.alloc(w * h * 4)
  if (fill) {
    for (let i = 0; i < w * h; i++) {
      buf[i * 4] = fill[0]
      buf[i * 4 + 1] = fill[1]
      buf[i * 4 + 2] = fill[2]
      buf[i * 4 + 3] = fill.length > 3 ? fill[3] : 255
    }
  }
  return buf
}

/** Standard source-over compositing of one colour onto the buffer. */
function blendPixel(buf, i, rgb, alpha) {
  if (alpha <= 0) return
  const dstA = buf[i + 3] / 255
  const outA = alpha + dstA * (1 - alpha)
  if (outA <= 0) return
  for (let c = 0; c < 3; c++) {
    buf[i + c] = Math.round((rgb[c] * alpha + buf[i + c] * dstA * (1 - alpha)) / outA)
  }
  buf[i + 3] = Math.round(outA * 255)
}

/**
 * Rasterises a shape into the buffer using NxN supersampling inside its
 * bounding box only, so a full-screen splash stays fast.
 */
function drawShape(buf, imgW, imgH, bounds, inside, rgb, samples = 3) {
  const x0 = Math.max(0, Math.floor(bounds.x0))
  const y0 = Math.max(0, Math.floor(bounds.y0))
  const x1 = Math.min(imgW, Math.ceil(bounds.x1))
  const y1 = Math.min(imgH, Math.ceil(bounds.y1))
  const step = 1 / samples
  const total = samples * samples

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      let hits = 0
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          if (inside(x + (sx + 0.5) * step, y + (sy + 0.5) * step)) hits++
        }
      }
      if (hits === 0) continue
      blendPixel(buf, (y * imgW + x) * 4, rgb, hits / total)
    }
  }
}

/* -------------------------------------------------------------- geometry --- */

function roundedRectTest(x, y, cx, cy, w, h, r) {
  const dx = Math.max(Math.abs(x - cx) - (w / 2 - r), 0)
  const dy = Math.max(Math.abs(y - cy) - (h / 2 - r), 0)
  return dx * dx + dy * dy <= r * r
}

function triangleTest(px, py, a, b, c) {
  const edge = (ax, ay, bx, by) => (px - ax) * (by - ay) - (py - ay) * (bx - ax)
  const d1 = edge(a[0], a[1], b[0], b[1])
  const d2 = edge(b[0], b[1], c[0], c[1])
  const d3 = edge(c[0], c[1], a[0], a[1])
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0
  return !(hasNeg && hasPos)
}

/** The white play triangle, expressed as fractions of a square canvas. */
function trianglePoints(size, cx, cy) {
  const h = size
  const w = size
  return {
    a: [cx - w * 0.165, cy - h * 0.215],
    b: [cx - w * 0.165, cy + h * 0.215],
    c: [cx + w * 0.185, cy],
  }
}

/* ------------------------------------------------------------- app icons --- */

/** Full-bleed tile: red rounded square + white triangle. Used by the PWA. */
function tileIcon(size, cornerRadiusRatio) {
  const buf = createBuffer(size, size, [0, 0, 0, 0])
  const r = size * cornerRadiusRatio
  const half = size / 2

  drawShape(
    buf,
    size,
    size,
    { x0: 0, y0: 0, x1: size, y1: size },
    (x, y) => roundedRectTest(x, y, half, half, size, size, r),
    BRAND_RED,
    4,
  )

  const t = trianglePoints(size, half, half)
  drawShape(
    buf,
    size,
    size,
    { x0: 0, y0: 0, x1: size, y1: size },
    (x, y) => triangleTest(x, y, t.a, t.b, t.c),
    WHITE,
    4,
  )
  return buf
}

/**
 * Adaptive foreground: transparent, with the triangle kept inside the inner
 * 72dp of the 108dp canvas so no launcher mask can clip it.
 */
function adaptiveForeground(size) {
  const buf = createBuffer(size, size, [0, 0, 0, 0])
  const half = size / 2
  // Scale the triangle down so it sits comfortably within the safe zone.
  const t = trianglePoints(size * 0.66, half, half)
  drawShape(
    buf,
    size,
    size,
    { x0: 0, y0: 0, x1: size, y1: size },
    (x, y) => triangleTest(x, y, t.a, t.b, t.c),
    WHITE,
    4,
  )
  return buf
}

/** Splash: flat dark background with the mark centred. */
function splash(width, height) {
  const buf = createBuffer(width, height, SPLASH_BG)
  const markHeight = Math.min(width, height) * 0.22
  const markWidth = (markHeight * 29) / 20
  const cx = width / 2
  const cy = height / 2

  drawShape(
    buf,
    width,
    height,
    { x0: cx - markWidth / 2, y0: cy - markHeight / 2, x1: cx + markWidth / 2, y1: cy + markHeight / 2 },
    (x, y) => roundedRectTest(x, y, cx, cy, markWidth, markHeight, markHeight * 0.23),
    BRAND_RED,
    4,
  )

  // Triangle inside the mark, matching the PWA icon proportions.
  const t = [
    [cx - markWidth * 0.165, cy - markHeight * 0.215],
    [cx - markWidth * 0.165, cy + markHeight * 0.215],
    [cx + markWidth * 0.185, cy],
  ]
  drawShape(
    buf,
    width,
    height,
    { x0: cx - markWidth, y0: cy - markHeight, x1: cx + markWidth, y1: cy + markHeight },
    (x, y) => triangleTest(x, y, t[0], t[1], t[2]),
    WHITE,
    4,
  )
  return buf
}

/* ------------------------------------------------------------------ write -- */

function writePng(dir, file, width, height, buffer) {
  mkdirSync(dir, { recursive: true })
  const png = encodePng(width, height, buffer)
  writeFileSync(resolve(dir, file), png)
  return png.length
}

console.log('PWA icons')

const pwaTargets = [
  { file: 'icon-192.png', size: 192, radius: 0.225 },
  { file: 'icon-512.png', size: 512, radius: 0.225 },
  // Maskable icons must survive a circular crop.
  { file: 'icon-maskable-512.png', size: 512, radius: 0.5 },
  { file: 'apple-touch-icon.png', size: 180, radius: 0.225 },
  { file: 'favicon-32.png', size: 32, radius: 0.225 },
  { file: 'favicon-16.png', size: 16, radius: 0.225 },
]

for (const { file, size, radius } of pwaTargets) {
  const bytes = writePng(webIconDir, file, size, size, tileIcon(size, radius))
  console.log(`  ${file.padEnd(24)} ${size}x${size}  ${(bytes / 1024).toFixed(1)} KB`)
}

writeFileSync(
  resolve(webIconDir, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7.2" fill="#FF0000"/>
  <path d="M12.3 9.4v13.2L23.5 16 12.3 9.4Z" fill="#fff"/>
</svg>
`,
)
console.log('  favicon.svg')

/* ------------------------------------------------------------ android ------ */

if (process.env.SKIP_ANDROID === '1') {
  console.log('\nSkipping Android assets (SKIP_ANDROID=1)')
} else {
  console.log('\nAndroid launcher icons')

  const densities = [
    { dir: 'mipmap-mdpi', legacy: 48, foreground: 108 },
    { dir: 'mipmap-hdpi', legacy: 72, foreground: 162 },
    { dir: 'mipmap-xhdpi', legacy: 96, foreground: 216 },
    { dir: 'mipmap-xxhdpi', legacy: 144, foreground: 324 },
    { dir: 'mipmap-xxxhdpi', legacy: 192, foreground: 432 },
  ]

  for (const d of densities) {
    const dir = resolve(androidRes, d.dir)
    writePng(dir, 'ic_launcher.png', d.legacy, d.legacy, tileIcon(d.legacy, 0.225))
    // A circle is just a fully rounded rectangle.
    writePng(dir, 'ic_launcher_round.png', d.legacy, d.legacy, tileIcon(d.legacy, 0.5))
    writePng(dir, 'ic_launcher_foreground.png', d.foreground, d.foreground, adaptiveForeground(d.foreground))
    console.log(`  ${d.dir.padEnd(20)} legacy ${d.legacy}px, foreground ${d.foreground}px`)
  }

  console.log('\nAndroid splash screens')
  const splashes = [
    ['drawable', 480, 320],
    ['drawable-land-mdpi', 480, 320],
    ['drawable-land-hdpi', 800, 480],
    ['drawable-land-xhdpi', 1280, 720],
    ['drawable-land-xxhdpi', 1600, 960],
    ['drawable-land-xxxhdpi', 1920, 1280],
    ['drawable-port-mdpi', 320, 480],
    ['drawable-port-hdpi', 480, 800],
    ['drawable-port-xhdpi', 720, 1280],
    ['drawable-port-xxhdpi', 960, 1600],
    ['drawable-port-xxxhdpi', 1280, 1920],
  ]

  for (const [dir, w, h] of splashes) {
    const bytes = writePng(resolve(androidRes, dir), 'splash.png', w, h, splash(w, h))
    console.log(`  ${dir.padEnd(24)} ${w}x${h}  ${(bytes / 1024).toFixed(1)} KB`)
  }
}

console.log('\nDone.')
