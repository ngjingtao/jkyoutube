import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * YouTube's official IFrame Player API.
 *
 * Controls are left to YouTube itself (`controls: 1`), so the playback bar,
 * settings menu, quality picker and fullscreen button are the genuine article
 * rather than a re-implementation. We only subscribe to events so that we can
 * autoplay the next video and detect videos whose owner disabled embedding.
 *
 * Two failure modes are handled explicitly, because both would otherwise leave
 * the viewer staring at an unexplained black rectangle:
 *   1. the API script never loads (offline, firewall, school network)
 *   2. the specific video cannot be embedded (owner disabled it)
 */

declare global {
  interface Window {
    YT?: {
      Player: new (el: HTMLElement | string, opts: Record<string, unknown>) => YouTubePlayerInstance
      PlayerState: {
        ENDED: number
        PLAYING: number
        PAUSED: number
        BUFFERING: number
        CUED: number
      }
    }
    onYouTubeIframeAPIReady?: () => void
  }
}

interface YouTubePlayerInstance {
  playVideo: () => void
  pauseVideo: () => void
  stopVideo: () => void
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
  setVolume: (v: number) => void
  mute: () => void
  unMute: () => void
  getCurrentTime: () => number
  getDuration: () => number
  loadVideoById: (id: string) => void
  cueVideoById: (id: string) => void
  destroy: () => void
}

export interface PlayerError {
  code: number
  message: string
  /** True when the problem is the connection, not the video itself. */
  network: boolean
}

const API_SCRIPT_TIMEOUT_MS = 10_000

let apiPromise: Promise<boolean> | null = null

/**
 * Loads the IFrame API once per page. Resolves `false` — rather than hanging —
 * when the script cannot be fetched, so the UI can show a real message.
 */
function loadYouTubeApi(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if (window.YT?.Player) return Promise.resolve(true)
  if (apiPromise) return apiPromise

  const promise = new Promise<boolean>((resolve) => {
    let settled = false
    let timer: number | undefined

    const finish = (ok: boolean) => {
      if (settled) return
      settled = true
      if (timer !== undefined) window.clearTimeout(timer)
      resolve(ok)
    }

    timer = window.setTimeout(() => finish(Boolean(window.YT?.Player)), API_SCRIPT_TIMEOUT_MS)

    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      finish(true)
    }

    const existing = document.querySelector('script[data-yt-iframe-api]')
    if (!existing) {
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      script.async = true
      script.dataset.ytIframeApi = 'true'
      script.addEventListener('error', () => finish(false))
      document.head.appendChild(script)
    }
  })

  apiPromise = promise
  // Allow a later retry if this attempt failed.
  promise.then((ok) => {
    if (!ok) apiPromise = null
  })

  return promise
}

function describeError(code: number): PlayerError {
  switch (code) {
    case 2:
      return { code, network: false, message: 'This video has an invalid link.' }
    case 5:
      return { code, network: false, message: 'This video cannot be played in this browser.' }
    case 100:
      return { code, network: false, message: 'This video is unavailable.' }
    case 101:
    case 150:
      return {
        code,
        network: false,
        message: 'The owner does not allow this video to be played outside of YouTube.',
      }
    default:
      return { code, network: false, message: 'Something went wrong while playing this video.' }
  }
}

const NETWORK_ERROR: PlayerError = {
  code: 0,
  network: true,
  message: 'Could not reach YouTube. Check the internet connection and try again.',
}

export function YouTubePlayer({
  videoId,
  autoplay = false,
  startSeconds = 0,
  onEnded,
  onError,
  className,
}: {
  videoId: string
  autoplay?: boolean
  startSeconds?: number
  onEnded?: () => void
  onError?: (error: PlayerError) => void
  className?: string
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YouTubePlayerInstance | null>(null)
  const [failed, setFailed] = useState<PlayerError | null>(null)
  const [attempt, setAttempt] = useState(0)

  // Latest callbacks without re-creating the player.
  const endedRef = useRef(onEnded)
  const errorRef = useRef(onError)
  const autoplayRef = useRef(autoplay)
  endedRef.current = onEnded
  errorRef.current = onError
  autoplayRef.current = autoplay

  // Create the player. Re-runs when the viewer retries.
  useEffect(() => {
    let disposed = false
    let watchdog: number | undefined
    setFailed(null)

    void loadYouTubeApi().then((ok) => {
      if (disposed) return
      if (!ok || !window.YT?.Player || !hostRef.current) {
        setFailed(NETWORK_ERROR)
        errorRef.current?.(NETWORK_ERROR)
        return
      }

      const target = document.createElement('div')
      target.className = 'h-full w-full'
      hostRef.current.replaceChildren(target)

      try {
        playerRef.current = new window.YT.Player(target, {
          videoId,
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: autoplayRef.current ? 1 : 0,
            start: startSeconds > 5 ? Math.floor(startSeconds) : 0,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            iv_load_policy: 3,
            fs: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              // The player is alive, so cancel the watchdog.
              if (watchdog !== undefined) {
                window.clearTimeout(watchdog)
                watchdog = undefined
              }
            },
            onStateChange: (e: { data: number }) => {
              if (window.YT && e.data === window.YT.PlayerState.ENDED) endedRef.current?.()
            },
            onError: (e: { data: number }) => {
              const err = describeError(e.data)
              setFailed(err)
              errorRef.current?.(err)
            },
          },
        })
      } catch {
        // The API script loaded but the player could not be constructed —
        // typically an incomplete or blocked response. Never leave a black box.
        setFailed(NETWORK_ERROR)
        errorRef.current?.(NETWORK_ERROR)
        return
      }

      // Watchdog: if the player never actually injects its iframe (blocked
      // widget script, content blocker, corporate proxy), surface the failure
      // instead of leaving an unexplained black rectangle.
      watchdog = window.setTimeout(() => {
        if (disposed) return
        if (!hostRef.current?.querySelector('iframe')) {
          setFailed(NETWORK_ERROR)
          errorRef.current?.(NETWORK_ERROR)
        }
      }, 12_000)
    })

    return () => {
      disposed = true
      if (watchdog !== undefined) window.clearTimeout(watchdog)
      try {
        playerRef.current?.destroy()
      } catch {
        /* the player may already be gone */
      }
      playerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt])

  // Swap the video without tearing the player down.
  useEffect(() => {
    setFailed(null)
    try {
      playerRef.current?.loadVideoById(videoId)
    } catch {
      /* player not ready yet; the create effect will pick this id up */
    }
  }, [videoId])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  if (failed) {
    return (
      <PlayerFallback videoId={videoId} error={failed} onRetry={retry} className={className} />
    )
  }

  return (
    <div className={className}>
      <div ref={hostRef} className="h-full w-full" />
    </div>
  )
}

/**
 * Mirrors YouTube's black unavailable state rather than leaving an empty box.
 * Network failures offer a retry; unavailable videos offer the source link.
 */
export function PlayerFallback({
  videoId,
  error,
  onRetry,
  className,
}: {
  videoId: string
  error?: PlayerError
  onRetry?: () => void
  className?: string
}) {
  const isNetwork = error?.network ?? false

  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 bg-black px-6 text-center ${
        className ?? ''
      }`}
    >
      <p className="text-[18px] font-medium text-white">
        {isNetwork ? "Can't reach YouTube" : 'Video unavailable'}
      </p>
      <p className="max-w-md text-[13px] leading-5 text-white/70">
        {error?.message ?? 'This video cannot be played here.'}
      </p>
      <div className="mt-1 flex items-center gap-2">
        {isNetwork && onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-full bg-white px-4 py-2 text-[14px] font-medium text-black hover:brightness-90"
          >
            Try again
          </button>
        ) : null}
        {!isNetwork ? (
          <a
            href={`https://www.youtube.com/watch?v=${videoId}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-white/10 px-4 py-2 text-[14px] font-medium text-white hover:bg-white/20"
          >
            Watch on YouTube
          </a>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Native <video> player, ready for the later "external .mp4 link" source type.
 */
export function NativePlayer({
  src,
  poster,
  autoplay = false,
  className,
  onEnded,
}: {
  src: string
  poster?: string
  autoplay?: boolean
  className?: string
  onEnded?: () => void
}) {
  return (
    <div className={className}>
      <video
        src={src}
        poster={poster}
        controls
        playsInline
        autoPlay={autoplay}
        onEnded={onEnded}
        className="h-full w-full bg-black"
      />
    </div>
  )
}
