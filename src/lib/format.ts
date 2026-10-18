/**
 * Formatting helpers that reproduce YouTube's own string formats exactly,
 * e.g. "1.2M views", "3 days ago", "12:34", "1:02:03".
 */

/** 999 -> "999", 1234 -> "1.2K", 45600 -> "45K", 1234567 -> "1.2M" */
export function formatCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0'
  if (n < 1000) return String(Math.trunc(n))
  if (n < 1_000_000) return short(n / 1000) + 'K'
  if (n < 1_000_000_000) return short(n / 1_000_000) + 'M'
  return short(n / 1_000_000_000) + 'B'
}

/**
 * YouTube shows one decimal place only below 10, and truncates rather than
 * rounds: 1,234 renders as "1.2K" but 45,600 renders as "45K", not "45.6K".
 */
function short(v: number): string {
  if (v < 10) return (Math.trunc(v * 10) / 10).toFixed(1).replace(/\.0$/, '')
  return String(Math.trunc(v))
}

export function formatViews(n: number): string {
  const c = formatCount(n)
  return c === '1' ? '1 view' : `${c} views`
}

export function formatSubscribers(n: number): string {
  const c = formatCount(n)
  return c === '1' ? '1 subscriber' : `${c} subscribers`
}

/** 3725 -> "1:02:05", 754 -> "12:34" */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (v: number) => String(v).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}

/** "3 days ago", "1 year ago", "just now" — matches YouTube's wording. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const seconds = Math.floor((now.getTime() - then) / 1000)
  if (seconds < 45) return 'just now'

  const units: Array<[number, string]> = [
    [60, 'second'],
    [60, 'minute'],
    [24, 'hour'],
    [7, 'day'],
    [4.348, 'week'],
    [12, 'month'],
    [Number.POSITIVE_INFINITY, 'year'],
  ]

  let value = seconds
  let unit = 'second'
  for (const [size, name] of units) {
    unit = name
    if (value < size) break
    value = value / size
  }

  const rounded = Math.floor(value)
  const v = rounded < 1 ? 1 : rounded
  return `${v} ${unit}${v === 1 ? '' : 's'} ago`
}

/** YouTube shows "No views"; a missing description is blank, not "null". */
export function formatVideoMeta(viewCount: number, publishedAt: string): string {
  const views = viewCount === 0 ? 'No views' : formatViews(viewCount)
  const ago = timeAgo(publishedAt)
  return ago ? `${views} • ${ago}` : views
}

export function classNames(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

/** Pull the 11-character video id out of any common YouTube URL shape. */
export function parseYouTubeId(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null
  // Bare id
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
  ]
  for (const re of patterns) {
    const m = raw.match(re)
    if (m) return m[1]
  }
  return null
}

export function youTubeThumbnail(videoId: string, quality: 'hq' | 'mq' | 'max' = 'hq'): string {
  const name = quality === 'max' ? 'maxresdefault' : quality === 'mq' ? 'mqdefault' : 'hqdefault'
  return `https://i.ytimg.com/vi/${videoId}/${name}.jpg`
}

/**
 * Thumbnail URLs to try in order.
 *
 * `hq720` is a crisp 1280x720 and is what YouTube itself prefers, but it does
 * not exist for older uploads. `hqdefault` is 480x360 — 4:3, with the video
 * letterboxed inside it; because the card crops with `object-cover`, those bars
 * fall outside the 16:9 frame and the result is correct. `mqdefault` (320x180)
 * is the last resort and is always present.
 */
export function youTubeThumbnailChain(videoId: string): string[] {
  return [
    `https://i.ytimg.com/vi/${videoId}/hq720.jpg`,
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
  ]
}

/* --------------------------------------------------------------- bilibili */

export interface BilibiliRef {
  /** `bvid` for the modern BV… id, `aid` for the legacy numeric av… id. */
  kind: 'bvid' | 'aid'
  /** The id itself: `BV1GJ411x7h7`, or the digits of `av12345`. */
  value: string
  /** Multi-part videos use `?p=`; 1 when absent. */
  page: number
}

export function isBilibiliShortLink(input: string): boolean {
  return /(^|\/\/)b23\.tv\//i.test(input.trim())
}

/**
 * Reads a Bilibili video id out of anything a person is likely to paste:
 * watch URLs, embed URLs, `av…` links, or a bare id.
 */
export function parseBilibiliId(input: string): BilibiliRef | null {
  const raw = input.trim()
  if (!raw) return null

  const pageMatch = raw.match(/[?&](?:p|page)=(\d+)/i)
  const page = pageMatch ? Math.max(1, Number(pageMatch[1])) : 1

  const bvid = raw.match(/BV[0-9A-Za-z]{10}/)
  if (bvid) return { kind: 'bvid', value: bvid[0], page }

  // `av12345`, `/video/av12345`, or `?aid=12345`
  const aid = raw.match(/(?:^|[^0-9A-Za-z])(?:av|aid=)(\d{1,12})/i)
  if (aid) return { kind: 'aid', value: aid[1], page }

  return null
}

/** True when the pasted text looks like a Bilibili link at all. */
export function looksLikeBilibili(input: string): boolean {
  return /bilibili\.com|b23\.tv/i.test(input) || /^BV[0-9A-Za-z]{10}$/.test(input.trim())
}

/**
 * Accepts "12:34", "1:02:03" or a plain number of seconds.
 * Returns 0 when the value cannot be read.
 */
export function parseDurationInput(input: string): number {
  const t = input.trim()
  if (!t) return 0
  if (/^\d+$/.test(t)) return Number(t)

  const parts = t.split(':')
  if (parts.length < 2 || parts.length > 3) return 0
  const nums = parts.map((p) => Number(p))
  if (nums.some((n) => !Number.isFinite(n) || n < 0)) return 0
  return nums.length === 2
    ? nums[0] * 60 + nums[1]
    : nums[0] * 3600 + nums[1] * 60 + nums[2]
}
