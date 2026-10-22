import { useEffect, useRef } from 'react'

/**
 * Keeps the screen awake while a video is playing.
 *
 * Why this is needed at all: the video lives inside a cross-origin YouTube or
 * Bilibili <iframe>, so from the top-level page's point of view nothing is
 * playing. iOS therefore applies its normal idle timer and dims/locks the
 * screen after a few minutes — which is exactly the "the iPad goes to sleep
 * while a video is playing" report.
 *
 * `navigator.wakeLock` is the supported fix. Two platform details matter:
 *
 *   - The lock is released automatically whenever the page becomes hidden, and
 *     is NOT re-acquired when it comes back. We re-request on visibilitychange.
 *   - In an installed Home Screen web app, wake lock only actually works from
 *     iOS/iPadOS 18.4. On 16.4–18.3 `request()` resolves but the screen still
 *     sleeps. There is no reliable feature test for that, so it is documented
 *     in the README rather than guessed at here. The old hidden-video hack is
 *     deliberately NOT used: it conflicts with the real player on iOS and no
 *     longer reliably keeps the screen awake anyway.
 *
 * The lock is a best-effort enhancement: denial (low battery, power-saving
 * mode, unsupported browser) must never affect playback.
 */

interface WakeLockSentinelLike {
  released: boolean
  release: () => Promise<void>
  addEventListener: (type: 'release', listener: () => void) => void
}

interface WakeLockLike {
  request: (type: 'screen') => Promise<WakeLockSentinelLike>
}

function getWakeLock(): WakeLockLike | null {
  if (typeof navigator === 'undefined') return null
  // Cast through `unknown` so this keeps working whether or not the installed
  // TypeScript DOM library already knows about the Wake Lock API.
  const nav = navigator as unknown as { wakeLock?: WakeLockLike }
  return nav.wakeLock ?? null
}

// Keeps the latest screen lock request per hook instance. The lock is only held
// if the viewer asked for it and the page is visible.
export function useWakeLock(active: boolean): void {
  const activeRef = useRef(active)
  activeRef.current = active

  useEffect(() => {
    let disposed = false
    let requesting = false
    let sentinel: WakeLockSentinelLike | null = null

    const release = () => {
      const current = sentinel
      sentinel = null
      if (current && !current.released) {
        void current.release().catch(() => {
          /* already gone */
        })
      }
    }

    const acquire = async () => {
      const wakeLock = getWakeLock()
      if (!wakeLock || disposed || requesting) return
      if (!activeRef.current) return
      if (document.visibilityState !== 'visible') return
      if (sentinel && !sentinel.released) return

      requesting = true
      try {
        const acquired = await wakeLock.request('screen')
        // The viewer may have paused or left while the request was pending.
        if (disposed || !activeRef.current || document.visibilityState !== 'visible') {
          void acquired.release().catch(() => {})
          return
        }
        sentinel = acquired
        acquired.addEventListener('release', () => {
          // Also fires when the platform takes the lock back (page hidden,
          // battery saver); forget it so a later acquire can request a new one.
          if (sentinel === acquired) sentinel = null
        })
      } catch {
        /* unsupported, denied or low battery — playback is unaffected */
      } finally {
        requesting = false
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (activeRef.current) void acquire()
      } else {
        // The platform releases the sentinel for us; drop the stale reference.
        sentinel = null
      }
    }

    if (active) void acquire()
    else release()
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      release()
    }
  }, [active])
}
