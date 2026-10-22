import { useCallback, useEffect, useRef, useState } from 'react'
import { useWakeLock } from '../../lib/wakelock'

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
      // The owner disabled embedding. Deliberately worded the way YouTube's own
      // unavailable state reads, with no reference to embedding or "outside of
      // YouTube" — that phrasing would reveal the video is being embedded.
      return { code, network: false, message: 'This video is unavailable.' }
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
  onProgress,
  onShieldClick,
  className,
}: {
  videoId: string
  autoplay?: boolean
  startSeconds?: number
  onEnded?: () => void
  onError?: (error: PlayerError) => void
  /** Called about every ten seconds with the real playback position. */
  onProgress?: (positionSeconds: number, durationSeconds: number) => void
  /** Called when the viewer clicks the shielded top band of the player. */
  onShieldClick?: () => void
  className?: string
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YouTubePlayerInstance | null>(null)
  const playingRef = useRef(false)
  const [failed, setFailed] = useState<PlayerError | null>(null)
  const [attempt, setAttempt] = useState(0)
  // The iframe owns the video, so the top-level page must ask the OS to keep the
  // screen on for as long as the iframe reports playback.
  const [keepingAwake, setKeepingAwake] = useState(false)
  useWakeLock(keepingAwake)

  // Latest callbacks without re-creating the player.
  const endedRef = useRef(onEnded)
  const errorRef = useRef(onError)
  const autoplayRef = useRef(autoplay)
  const progressRef = useRef(onProgress)
  endedRef.current = onEnded
  errorRef.current = onError
  autoplayRef.current = autoplay
  progressRef.current = onProgress

  // Create the player. Re-runs when the viewer retries.
  useEffect(() => {
    let disposed = false
    let watchdog: number | undefined
    let progressTimer: number | undefined
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
              if (window.YT) {
                playingRef.current = e.data === window.YT.PlayerState.PLAYING
                // Buffering counts as playing: a slow connection must not let
                // the screen dim while the viewer is waiting for the video.
                setKeepingAwake(
                  e.data === window.YT.PlayerState.PLAYING ||
                    e.data === window.YT.PlayerState.BUFFERING,
                )
                if (e.data === window.YT.PlayerState.ENDED) endedRef.current?.()
              }
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

      // Report playback position periodically. This is the only source of real
      // watch data: Bilibili's embed exposes nothing equivalent.
      progressTimer = window.setInterval(() => {
        const player = playerRef.current
        const report = progressRef.current
        if (!player || !report) return
        try {
          const position = player.getCurrentTime()
          const duration = player.getDuration()
          if (Number.isFinite(position) && Number.isFinite(duration) && duration > 0) {
            report(position, duration)
          }
        } catch {
          /* player not ready */
        }
      }, 10_000)
    })

    return () => {
      disposed = true
      if (watchdog !== undefined) window.clearTimeout(watchdog)
      if (progressTimer !== undefined) window.clearInterval(progressTimer)
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

  /**
   * Toggles playback. Used by the click shield below.
   */
  const togglePlayback = useCallback(() => {
    const player = playerRef.current
    if (!player) return
    try {
      if (playingRef.current) player.pauseVideo()
      else player.playVideo()
    } catch {
      /* player not ready yet */
    }
  }, [])

  if (failed) {
    return <PlayerFallback error={failed} onRetry={retry} className={className} />
  }

  return (
    <div className={`relative ${className ?? ''}`}>
      <div ref={hostRef} className="h-full w-full" />

      {/*
        YouTube's embedded player draws its own title overlay across the top,
        and that title is a clickable link to youtube.com. Its Share button also
        hands out a youtube.com URL. No player parameter removes either.

        This transparent strip swallows clicks in that band and forwards them to
        play/pause instead — which is what tapping the video does anyway, so no
        functionality is lost. It blocks the one-tap escape to the real YouTube.

        Limitation: it cannot follow the player into fullscreen, because the
        iframe then covers the entire screen and this element is left behind.
      */}
      <button
        type="button"
        onClick={() => {
          // A click in this band is also a click that would otherwise have
          // reached YouTube's title link, so it counts as a blocked attempt.
          onShieldClick?.()
          togglePlayback()
        }}
        aria-label="Play or pause"
        className="absolute inset-x-0 top-0 z-10 h-[18%] min-h-[52px] cursor-default bg-transparent"
      />
    </div>
  )
}

/**
 * Mirrors YouTube's own black unavailable state.
 *
 * There is deliberately **no "Watch on YouTube" link here**: any outbound link
 * to youtube.com is a one-tap escape from the app, which defeats the entire
 * point. The admin library still records the source URL if you need it.
 */
export function PlayerFallback({
  error,
  onRetry,
  className,
}: {
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
      {isNetwork && onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 rounded-full bg-white px-4 py-2 text-[14px] font-medium text-black hover:brightness-90"
        >
          Try again
        </button>
      ) : null}
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
  const [playing, setPlaying] = useState(false)
  useWakeLock(playing)

  return (
    <div className={className}>
      <video
        src={src}
        poster={poster}
        controls
        playsInline
        autoPlay={autoplay}
        onPlay={() => setPlaying(true)}
        onPlaying={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false)
          onEnded?.()
        }}
        className="h-full w-full bg-black"
      />
    </div>
  )
}
