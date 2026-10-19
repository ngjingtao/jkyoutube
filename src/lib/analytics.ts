import { supabase } from './supabase'

/**
 * Watch telemetry.
 *
 * Records what was opened, how long it was watched, how far through, which
 * links were clicked inside the embedded player, and how the viewer moved from
 * page to page.
 *
 * Two limits worth knowing:
 *
 *  - YouTube videos report real playback positions, because the IFrame API
 *    exposes getCurrentTime(). Bilibili's embed has no scripting API at all, so
 *    for those the only measurable thing is how long the page stayed open.
 *
 *  - A click inside the Bilibili player cannot be observed. It happens in a
 *    cross-origin frame, and the browser gives us no event for it. What CAN be
 *    counted is a click stopped by our own shield, which is recorded as
 *    'blocked' — a genuine signal that someone reached for a link.
 *
 * Nothing here is allowed to break playback, so every call is fire-and-forget.
 */

export type ViewEventName = 'open' | 'progress' | 'blocked' | 'navigate'

export interface ViewEventInput {
  videoId: string
  event: ViewEventName
  positionSeconds?: number
  durationSeconds?: number
  watchedSeconds?: number
  fromPath?: string
  toPath?: string
  sourceType?: string
}

const SESSION_KEY = 'jk.session'

function sessionId(): string {
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY)
    if (existing) return existing
    const created =
      Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
    window.sessionStorage.setItem(SESSION_KEY, created)
    return created
  } catch {
    return 'unknown'
  }
}

/**
 * Events are batched so that a viewer scrubbing around does not fire a request
 * per checkpoint. Flushed on a timer, on page hide, and when the queue fills.
 */
const queue: ViewEventInput[] = []
let flushTimer: number | undefined
const FLUSH_INTERVAL_MS = 10_000
const MAX_QUEUE = 40

async function flush(): Promise<void> {
  if (flushTimer !== undefined) {
    window.clearTimeout(flushTimer)
    flushTimer = undefined
  }
  if (!supabase || queue.length === 0) return

  const batch = queue.splice(0, queue.length)
  const session = sessionId()

  try {
    const rows = batch.map((e) => ({
      video_id: e.videoId,
      session_id: session,
      event: e.event,
      position_seconds: e.positionSeconds ?? null,
      duration_seconds: e.durationSeconds ?? null,
      watched_seconds: e.watchedSeconds ?? null,
      from_path: e.fromPath ?? null,
      to_path: e.toPath ?? null,
      source_type: e.sourceType ?? null,
    }))
    await supabase.from('view_events').insert(rows)
  } catch {
    // Telemetry is never worth surfacing an error for. Drop the batch rather
    // than retrying forever and growing the queue.
  }
}

function scheduleFlush(): void {
  if (flushTimer !== undefined) return
  flushTimer = window.setTimeout(() => {
    flushTimer = undefined
    void flush()
  }, FLUSH_INTERVAL_MS)
}

export function track(input: ViewEventInput): void {
  if (!supabase) return
  queue.push(input)
  if (queue.length >= MAX_QUEUE) {
    void flush()
    return
  }
  scheduleFlush()
}

/**
 * Call once at startup. Flushes on the way out, so a viewer who simply closes
 * the tab still has their last checkpoints recorded.
 */
export function initAnalytics(): void {
  if (!supabase) return
  const onHide = () => {
    void flush()
  }
  window.addEventListener('pagehide', onHide)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush()
  })
}

export function hasAnalytics(): boolean {
  return Boolean(supabase)
}
