import type { BilibiliRef } from './format'

/**
 * Bilibili support.
 *
 * Two hard constraints shaped this file, both verified against the live site:
 *
 * 1. `player.bilibili.com/player.html` returns HTTP 200 with no
 *    `X-Frame-Options` and no CSP `frame-ancestors`, so the video *can* be
 *    embedded in an iframe. That is the only supported way to play Bilibili
 *    content, and the playback chrome belongs to Bilibili — it cannot be
 *    restyled to look like YouTube without re-hosting their video streams.
 *
 * 2. `api.bilibili.com` returns HTTP 403 with no `Access-Control-Allow-Origin`
 *    for browser requests. There is no oEmbed endpoint either. So titles,
 *    thumbnails, durations and view counts **cannot be fetched automatically**
 *    and have to be typed in by hand.
 *
 * The one thing we can genuinely fix is the bullet-comment overlay ("danmaku"),
 * which is the most un-YouTube feature of their player. `danmaku=0` disables it.
 */

export interface BilibiliEmbedOptions {
  autoplay?: boolean
  startSeconds?: number
}

export function bilibiliEmbedUrl(
  ref: BilibiliRef,
  { autoplay = false, startSeconds = 0 }: BilibiliEmbedOptions = {},
): string {
  const params = new URLSearchParams()
  if (ref.kind === 'bvid') params.set('bvid', ref.value)
  else params.set('aid', ref.value)

  params.set('page', String(ref.page))
  params.set('high_quality', '1')
  params.set('as_wide', '1')
  // The single most important flag: no scrolling bullet comments.
  params.set('danmaku', '0')
  params.set('autoplay', autoplay ? '1' : '0')
  if (startSeconds > 0) params.set('t', String(Math.floor(startSeconds)))

  return `https://player.bilibili.com/player.html?${params.toString()}`
}

/** Canonical watch URL, used for the "open on Bilibili" fallback link. */
export function bilibiliWatchUrl(ref: BilibiliRef): string {
  const id = ref.kind === 'bvid' ? ref.value : `av${ref.value}`
  const suffix = ref.page > 1 ? `?p=${ref.page}` : ''
  return `https://www.bilibili.com/video/${id}/${suffix}`
}

/** Stable storage id, e.g. `BV1GJ411x7h7` or `av12345`, including the part. */
export function bilibiliVideoId(ref: BilibiliRef): string {
  const base = ref.kind === 'bvid' ? ref.value : `av${ref.value}`
  return ref.page > 1 ? `${base}-p${ref.page}` : base
}

function hashString(value: string): number {
  let h = 0
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0
  return Math.abs(h)
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Greedy word wrap, capped at `maxLines` with an ellipsis. */
function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= maxChars) {
      current = candidate
      continue
    }
    if (current) lines.push(current)
    current = word.length > maxChars ? `${word.slice(0, maxChars - 1)}…` : word
    if (lines.length === maxLines) break
  }
  if (current && lines.length < maxLines) lines.push(current)

  if (lines.length === maxLines) {
    const consumed = lines.join(' ').length
    if (consumed < text.length - 1) {
      lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[…\s]+$/, '').slice(0, maxChars - 1)}…`
    }
  }
  return lines.slice(0, maxLines)
}

/**
 * A stand-in thumbnail for Bilibili entries.
 *
 * Bilibili's API is unreachable from the browser, so there is no thumbnail URL
 * to derive. A grey empty box would look broken in the grid; this renders a
 * calm gradient card with the title, which reads as a legitimate thumbnail
 * until the admin pastes a real image URL.
 */
export function bilibiliPlaceholderThumbnail(title: string, seed: string): string {
  const hue = hashString(seed) % 360
  const from = `hsl(${hue} 32% 26%)`
  const to = `hsl(${(hue + 38) % 360} 30% 14%)`

  const lines = wrap(title || 'Bilibili video', 26, 2)
  const fontSize = 34
  const lineHeight = 42
  const startY = 180 - ((lines.length - 1) * lineHeight) / 2

  const text = lines
    .map(
      (line, i) =>
        `<text x="48" y="${startY + i * lineHeight}" font-family="Roboto, Arial, sans-serif" font-size="${fontSize}" font-weight="500" fill="rgba(255,255,255,0.92)">${escapeXml(line)}</text>`,
    )
    .join('')

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="640" height="360" fill="url(#g)"/>
  <circle cx="560" cy="64" r="110" fill="rgba(255,255,255,0.04)"/>
  <circle cx="96" cy="320" r="80" fill="rgba(255,255,255,0.03)"/>
  ${text}
</svg>`

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
