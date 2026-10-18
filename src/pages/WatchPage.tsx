import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLibrary } from '../store/library'
import { classNames, formatCount, formatSubscribers, formatViews, timeAgo } from '../lib/format'
import { ChannelAvatar } from '../components/ChannelAvatar'
import { VideoRowCompact } from '../components/VideoCard'
import { NativePlayer, YouTubePlayer } from '../components/player/YouTubePlayer'
import {
  BellIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DislikeFilledIcon,
  DislikeIcon,
  DownloadIcon,
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
  } = useLibrary()

  const video = getVideo(id)
  const [descOpen, setDescOpen] = useState(false)
  const [autoplayNext, setAutoplayNext] = useState(true)

  const queue = useMemo(() => (video ? upNext(video.id, 20) : []), [video, upNext])

  // Record history whenever the watched video changes.
  useEffect(() => {
    if (video) addToHistory(video.id)
    setDescOpen(false)
    window.scrollTo({ top: 0 })
  }, [video, addToHistory])

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
  const isEmbedded = video.sourceType === 'youtube' && video.youtubeId

  return (
    <div className="mx-auto max-w-[1754px] px-4 pb-16 pt-6 md:px-6">
      <div className="flex flex-col gap-6 xl:flex-row">
        {/* ------------------------------------------------ primary column */}
        <div className="min-w-0 flex-1">
          <div className="overflow-hidden rounded-xl bg-black" style={{ aspectRatio: '16 / 9' }}>
            {isEmbedded ? (
              <YouTubePlayer
                videoId={video.youtubeId as string}
                startSeconds={startSeconds}
                className="h-full w-full"
                onEnded={() => {
                  if (autoplayNext && queue[0]) navigate(`/watch/${queue[0].id}`)
                }}
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
                <span className="text-[12px] leading-4 text-fg2">
                  {formatSubscribers(channel?.subscriberCount ?? 0)}
                </span>
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
            <div className="text-[14px] font-medium text-fg">
              {formatViews(video.viewCount)} • {timeAgo(video.publishedAt)}
            </div>
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
