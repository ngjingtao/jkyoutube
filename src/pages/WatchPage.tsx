import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLibrary } from '../store/library'
import { track } from '../lib/analytics'
import { ensureSuggestions } from '../lib/suggestions'
import { useLocalStorage } from '../lib/hooks'
import { classNames, formatCount, formatSubscribers, formatViews, timeAgo } from '../lib/format'
import { ChannelAvatar } from '../components/ChannelAvatar'
import { VideoRowCompact } from '../components/VideoCard'
import { NativePlayer, YouTubePlayer } from '../components/player/YouTubePlayer'
import { BilibiliPlayer } from '../components/player/BilibiliPlayer'
import { parseBilibiliId } from '../lib/format'
import {
  BellIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CloseIcon,
  DislikeFilledIcon,
  DislikeIcon,
  DownloadIcon,
  FullscreenIcon,
  LikeFilledIcon,
  LikeIcon,
  MoreVerticalIcon,
  SaveIcon,
  ShareIcon,
} from '../components/icons'

function PillButton({
  onClick,
  active,
  children,
  label,
}: {
  onClick?: () => void
  active?: boolean
  children: React.ReactNode
  label?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={classNames(
        'inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-full px-4 text-[14px] font-medium transition-colors',
        active ? 'bg-chip-on text-chip-on-fg' : 'bg-chip text-fg hover:bg-chip-hover',
      )}
    >
      {children}
    </button>
  )
}

function SubscribeButton({ channelId }: { channelId: string }) {
  const { isSubscribed, toggleSubscribe } = useLibrary()
  const subscribed = isSubscribed(channelId)

  return (
    <button
      type="button"
      onClick={() => toggleSubscribe(channelId)}
      className={classNames(
        'inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-full px-4 text-[14px] font-medium transition-colors',
        subscribed ? 'bg-chip text-fg hover:bg-chip-hover' : 'bg-chip-on text-chip-on-fg',
      )}
    >
      {subscribed ? (
        <>
          <BellIcon size={20} />
          Subscribed
        </>
      ) : (
        'Subscribe'
      )}
    </button>
  )
}

export function WatchPage() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const {
    getVideo,
    getChannel,
    upNext,
    reactions,
    setReaction,
    addToHistory,
    watchLater,
    toggleWatchLater,
    isSubscribed,
    toggleSubscribe,
    suggestionsRatio,
    reload,
  } = useLibrary()

  const [ytApiKey] = useLocalStorage('jk.youtubeApiKey', '')

  const video = getVideo(id)
  const [descOpen, setDescOpen] = useState(false)
  const [autoplayNext, setAutoplayNext] = useState(true)
  const [fillScreen, setFillScreen] = useState(false)

  const queue = useMemo(() => (video ? upNext(video.id, 20) : []), [video, upNext])

  /**
   * Whether to offer the in-app fill-screen mode.
   *
   * Only where the platform cannot do it natively. iOS never supports the
   * Fullscreen API for elements, and video fullscreen inside a cross-origin
   * iframe does not work in an installed web app — so on the iPad the player's
   * own button does nothing and this is the only way to get a big picture.
   */
  const canFillScreen = !document.fullscreenEnabled

  // Fill-screen hides the header and guide by classing <body>, which is the only
  // thing that can reach outside this component's subtree.
  useEffect(() => {
    document.body.classList.toggle('jk-fill-screen', fillScreen)
    return () => document.body.classList.remove('jk-fill-screen')
  }, [fillScreen])

  // Record history whenever the watched video changes.
  useEffect(() => {
    if (video) addToHistory(video.id)
    setDescOpen(false)
    setFillScreen(false)
    window.scrollTo({ top: 0 })
  }, [video, addToHistory])

  /* ------------------------------------------------------------- telemetry */
  //
  // Held in refs so the cleanup handler can read the final values without
  // re-subscribing. Nothing here is allowed to affect playback.

  const watchStartRef = useRef(0)
  const lastPositionRef = useRef(0)
  const lastDurationRef = useRef(0)
  const videoIdRef = useRef('')
  const sourceTypeRef = useRef('')

  useEffect(() => {
    if (!video) return
    const id = video.id
    const sourceType = video.sourceType
    videoIdRef.current = id
    sourceTypeRef.current = sourceType
    watchStartRef.current = Date.now()
    lastPositionRef.current = 0
    lastDurationRef.current = 0

    track({ videoId: id, event: 'open', sourceType })

    return () => {
      // Leaving this video: record how long it was open, and how far in it got.
      // For Bilibili this is the only measurable figure, because its embed
      // exposes no playback events at all.
      track({
        videoId: id,
        event: 'progress',
        sourceType,
        watchedSeconds: Math.round((Date.now() - watchStartRef.current) / 1000),
        positionSeconds: Math.round(lastPositionRef.current),
        durationSeconds: Math.round(lastDurationRef.current),
      })
    }
  }, [video])

  /** Real playback positions, YouTube only. */
  const handleProgress = useCallback((position: number, duration: number) => {
    lastPositionRef.current = position
    lastDurationRef.current = duration
    track({
      videoId: videoIdRef.current,
      event: 'progress',
      sourceType: sourceTypeRef.current,
      positionSeconds: Math.round(position),
      durationSeconds: Math.round(duration),
      watchedSeconds: Math.round((Date.now() - watchStartRef.current) / 1000),
    })
  }, [])

  /**
   * Counts a click stopped by our shield.
   *
   * It cannot be distinguished from a viewer trying to pause, so it is recorded
   * as a blocked attempt rather than a link click. It is still a genuine signal
   * that someone reached for something inside the player.
   */
  const handleBlocked = useCallback(() => {
    track({
      videoId: videoIdRef.current,
      event: 'blocked',
      sourceType: sourceTypeRef.current,
      positionSeconds: Math.round(lastPositionRef.current),
    })
  }, [])

  /**
   * Pull in YouTube suggestions for this video, when the owner has enabled them.
   *
   * Guarded three ways because a lookup costs 100 quota units: off by default,
   * requires an API key, and the fetch layer caches per seed for 24 hours. The
   * ref stops a re-run for the same video after the store reloads.
   */
  const filledForRef = useRef('')
  useEffect(() => {
    if (!video || suggestionsRatio <= 0 || !ytApiKey.trim()) return
    if (filledForRef.current === video.id) return
    filledForRef.current = video.id

    void (async () => {
      const added = await ensureSuggestions(video, ytApiKey, suggestionsRatio)
      if (added.length > 0) await reload()
    })()
  }, [video, suggestionsRatio, ytApiKey, reload])

  if (!video) {
    return (
      <div className="px-6 py-24 text-center">
        <h1 className="text-[20px] font-medium">This video isn't available anymore</h1>
        <p className="mt-2 text-[14px] text-fg2">
          It may have been removed, or the link may be wrong.
        </p>
        <Link to="/" className="mt-6 inline-block text-[14px] font-medium text-[#065fd4]">
          Go to Home
        </Link>
      </div>
    )
  }

  const channel = getChannel(video.channelId)
  const reaction = reactions[video.id] ?? null
  const saved = watchLater.includes(video.id)
  const startSeconds = Number(params.get('t') ?? 0) || 0
  const bilibiliRef =
    video.sourceType === 'bilibili' ? parseBilibiliId(video.sourceUrl) : null

  return (
    <div className="mx-auto max-w-[1754px] px-4 pb-16 pt-6 md:px-6">
      {fillScreen ? (
        <button type="button" className="jk-fill-exit" onClick={() => setFillScreen(false)}>
          <CloseIcon size={18} />
          Exit full screen
        </button>
      ) : null}

      <div className="flex flex-col gap-6 xl:flex-row">
        {/* ------------------------------------------------ primary column */}
        <div className="min-w-0 flex-1">
          <div
            className={classNames(
              'overflow-hidden rounded-xl bg-black',
              fillScreen && 'jk-player-fill',
            )}
            style={{ aspectRatio: '16 / 9' }}
          >
            {video.sourceType === 'youtube' && video.youtubeId ? (
              <YouTubePlayer
                videoId={video.youtubeId}
                startSeconds={startSeconds}
                className="h-full w-full"
                onProgress={handleProgress}
                onShieldClick={handleBlocked}
                onEnded={() => {
                  if (autoplayNext && queue[0]) navigate(`/watch/${queue[0].id}`)
                }}
              />
            ) : bilibiliRef ? (
              <BilibiliPlayer
                bilibiliRef={bilibiliRef}
                startSeconds={startSeconds}
                onBlockedClick={handleBlocked}
                onToggleFullscreen={() => setFillScreen((v) => !v)}
                className="h-full w-full"
              />
            ) : (
              <NativePlayer src={video.sourceUrl} poster={video.thumbnailUrl} className="h-full w-full" />
            )}
          </div>

          {/* Title */}
          <h1 className="mt-3 text-[20px] font-bold leading-7 text-fg">{video.title}</h1>

          {/* Channel row + actions */}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-3">
            <Link
              to={`/channel/${video.channelId}`}
              className="flex items-center gap-3"
            >
              <ChannelAvatar channel={channel} size={40} />
              <span className="flex flex-col">
                <span className="text-[16px] font-medium leading-5 text-fg">{channel?.name}</span>
                {typeof channel?.subscriberCount === 'number' ? (
                  <span className="text-[12px] leading-4 text-fg2">
                    {formatSubscribers(channel.subscriberCount)}
                  </span>
                ) : null}
              </span>
            </Link>

            <SubscribeButton channelId={video.channelId} />

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <div className="inline-flex h-9 items-center overflow-hidden rounded-full bg-chip">
                <button
                  type="button"
                  onClick={() => setReaction(video.id, 'like')}
                  aria-label="Like"
                  className="inline-flex h-9 items-center gap-2 pl-4 pr-3 hover:bg-chip-hover"
                >
                  {reaction === 'like' ? <LikeFilledIcon size={22} /> : <LikeIcon size={22} />}
                  <span className="text-[14px] font-medium">
                    {formatCount((video.likeCount ?? 0) + (reaction === 'like' ? 1 : 0))}
                  </span>
                </button>
                <span className="h-6 w-px bg-line" />
                <button
                  type="button"
                  onClick={() => setReaction(video.id, 'dislike')}
                  aria-label="Dislike"
                  className="inline-flex h-9 items-center px-4 hover:bg-chip-hover"
                >
                  {reaction === 'dislike' ? <DislikeFilledIcon size={22} /> : <DislikeIcon size={22} />}
                </button>
              </div>

              <PillButton label="Share">
                <ShareIcon size={22} />
                Share
              </PillButton>

              {canFillScreen ? (
                <PillButton label="Fill the screen" onClick={() => setFillScreen(true)}>
                  <FullscreenIcon size={22} />
                  Full screen
                </PillButton>
              ) : null}

              <PillButton label="Download">
                <DownloadIcon size={22} />
                Download
              </PillButton>

              <PillButton
                label="Save to playlist"
                active={saved}
                onClick={() => toggleWatchLater(video.id)}
              >
                {saved ? <CheckIcon size={22} /> : <SaveIcon size={22} />}
                {saved ? 'Saved' : 'Save'}
              </PillButton>

              <PillButton label="More actions">
                <MoreVerticalIcon size={22} />
              </PillButton>
            </div>
          </div>

          {/* Description */}
          <button
            type="button"
            onClick={() => setDescOpen((v) => !v)}
            className="mt-3 w-full rounded-xl bg-chip p-3 text-left hover:bg-chip-hover"
          >
            {video.statsUnknown ? null : (
              <div className="text-[14px] font-medium text-fg">
                {formatViews(video.viewCount)} • {timeAgo(video.publishedAt)}
              </div>
            )}
            <span className="float-right -mt-5 text-fg">
              {descOpen ? <ChevronUpIcon size={20} /> : <ChevronDownIcon size={20} />}
            </span>
            <p
              className={classNames(
                'mt-1 whitespace-pre-wrap text-[14px] leading-5 text-fg',
                descOpen ? '' : 'yt-clamp-2',
              )}
            >
              {video.description || 'No description has been added to this video.'}
            </p>
          </button>

          {/* Comments — added in a later pass */}
          <section className="mt-6">
            <h2 className="text-[20px] font-bold text-fg">Comments</h2>
            <div className="mt-4 flex items-start gap-4">
              <div className="h-10 w-10 shrink-0 rounded-full bg-chip" />
              <div className="flex-1 border-b border-line pb-2 text-[14px] text-fg2">
                Add a comment…
              </div>
            </div>
          </section>
        </div>

        {/* ------------------------------------------------ up next column */}
        <aside className="w-full shrink-0 xl:w-[402px]">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[16px] font-medium text-fg">Up next</span>
            <button
              type="button"
              onClick={() => setAutoplayNext((v) => !v)}
              className="flex items-center gap-2 text-[13px] text-fg2"
            >
              Autoplay
              <span
                className={classNames(
                  'relative inline-flex h-[14px] w-[36px] items-center rounded-full transition-colors',
                  autoplayNext ? 'bg-fg' : 'bg-chip-hover',
                )}
              >
                <span
                  className={classNames(
                    'absolute h-[18px] w-[18px] rounded-full bg-bg shadow transition-all',
                    autoplayNext ? 'left-[18px]' : 'left-0',
                  )}
                  style={{ boxShadow: '0 1px 3px rgba(0,0,0,.4)' }}
                />
              </span>
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {queue.map((v) => (
              <VideoRowCompact key={v.id} video={v} />
            ))}
          </div>

          {isSubscribed(video.channelId) ? null : (
            <div className="mt-6 rounded-xl border border-line p-4">
              <p className="text-[14px] font-medium text-fg">
                Subscribe to {channel?.name} to see their videos here.
              </p>
              <button
                type="button"
                onClick={() => toggleSubscribe(video.channelId)}
                className="mt-3 text-[14px] font-medium text-[#065fd4]"
              >
                Subscribe
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
