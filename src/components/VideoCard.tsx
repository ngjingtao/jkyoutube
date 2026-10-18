import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLibrary } from '../store/library'
import {
  classNames,
  formatDuration,
  formatVideoMeta,
  youTubeThumbnailChain,
} from '../lib/format'
import { ChannelAvatar } from './ChannelAvatar'
import { MoreVerticalIcon, PlayIcon } from './icons'
import type { Video } from '../types'

function DurationBadge({ video }: { video: Video }) {
  const isLive = video.isLive === true

  // A duration of 0 with no live flag means "unknown", not "live". Showing a
  // red LIVE badge on an ordinary video would be an instant giveaway.
  if (!isLive && video.durationSeconds <= 0) return null

  return (
    <span
      className={classNames(
        'pointer-events-none absolute bottom-2 right-2 rounded px-1 py-[1px] text-[12px] font-medium leading-4',
        isLive ? 'bg-[#ff0000] text-white' : 'bg-black/80 text-white',
      )}
      style={{ letterSpacing: '.2px' }}
    >
      {isLive ? 'LIVE' : formatDuration(video.durationSeconds)}
    </span>
  )
}

/**
 * Thumbnail with a graceful degradation chain.
 *
 * YouTube's `hq720` does not exist for older uploads, so we fall back to
 * `hqdefault` and then `mqdefault`, and finally to a placeholder rather than
 * leaving an empty grey box if every variant 404s.
 */
function ThumbnailImage({ video, priority = false }: { video: Video; priority?: boolean }) {
  const sources = useMemo(
    () => (video.youtubeId ? youTubeThumbnailChain(video.youtubeId) : [video.thumbnailUrl]),
    [video.youtubeId, video.thumbnailUrl],
  )
  const [index, setIndex] = useState(0)
  const [exhausted, setExhausted] = useState(false)

  useEffect(() => {
    setIndex(0)
    setExhausted(false)
  }, [video.id])

  if (exhausted) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-thumbbg text-fg2">
        <PlayIcon size={40} />
      </div>
    )
  }

  return (
    <img
      src={sources[Math.min(index, sources.length - 1)]}
      alt=""
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      draggable={false}
      className="h-full w-full object-cover"
      onError={() => {
        if (index < sources.length - 1) setIndex((i) => i + 1)
        else setExhausted(true)
      }}
    />
  )
}

function Thumbnail({
  video,
  className,
  rounded = 'rounded-xl',
  priority = false,
}: {
  video: Video
  className?: string
  rounded?: string
  priority?: boolean
}) {
  return (
    <div className={classNames('relative overflow-hidden bg-thumbbg', rounded, className)}>
      <ThumbnailImage video={video} priority={priority} />
      <DurationBadge video={video} />
    </div>
  )
}

/**
 * The standard home-grid card: 16:9 thumbnail, then avatar + 2-line title,
 * channel name and "views • time" — the exact information order YouTube uses.
 */
export function VideoCard({
  video,
  showAvatar = true,
  priority = false,
}: {
  video: Video
  showAvatar?: boolean
  priority?: boolean
}) {
  const { getChannel } = useLibrary()
  const channel = getChannel(video.channelId)

  return (
    <div className="group relative">
      <Link to={`/watch/${video.id}`} className="block">
        <Thumbnail video={video} className="aspect-video w-full" priority={priority} />
      </Link>

      <div className="mt-3 flex gap-3">
        {showAvatar ? (
          <Link to={`/channel/${video.channelId}`} className="mt-0.5">
            <ChannelAvatar channel={channel} size={36} />
          </Link>
        ) : null}

        <div className="min-w-0 flex-1">
          <Link to={`/watch/${video.id}`}>
            <h3 className="yt-clamp-2 text-[14px] font-medium leading-5 text-fg">{video.title}</h3>
          </Link>
          <Link
            to={`/channel/${video.channelId}`}
            className="mt-1 block truncate text-[12px] text-fg2 hover:text-fg"
          >
            {channel?.name ?? 'Unknown'}
          </Link>
          <div className="text-[12px] text-fg2">
            {formatVideoMeta(video.viewCount, video.publishedAt)}
          </div>
        </div>

        <button
          type="button"
          aria-label="Action menu"
          className="yt-icon-btn absolute right-0 top-[60%] hidden h-9 w-9 opacity-0 group-hover:opacity-100 md:inline-flex"
        >
          <MoreVerticalIcon size={20} />
        </button>
      </div>
    </div>
  )
}

/** Horizontal row card — used on search results and channel pages. */
export function VideoRow({ video, priority = false }: { video: Video; priority?: boolean }) {
  const { getChannel } = useLibrary()
  const channel = getChannel(video.channelId)

  return (
    <div className="flex gap-4">
      <Link to={`/watch/${video.id}`} className="w-[246px] shrink-0 sm:w-[360px]">
        <Thumbnail video={video} className="aspect-video w-full" priority={priority} />
      </Link>
      <div className="min-w-0 flex-1 pt-0.5">
        <Link to={`/watch/${video.id}`}>
          <h3 className="yt-clamp-2 text-[18px] font-normal leading-6 text-fg">{video.title}</h3>
        </Link>
        <div className="mt-1 text-[12px] text-fg2">
          {formatVideoMeta(video.viewCount, video.publishedAt)}
        </div>
        <Link to={`/channel/${video.channelId}`} className="mt-3 flex items-center gap-2">
          <ChannelAvatar channel={channel} size={24} />
          <span className="truncate text-[12px] text-fg2 hover:text-fg">{channel?.name}</span>
        </Link>
        {video.description ? (
          <p className="yt-clamp-2 mt-2 text-[12px] leading-4 text-fg2">{video.description}</p>
        ) : null}
      </div>
    </div>
  )
}

/** Dense row used in the watch page "Up next" column. */
export function VideoRowCompact({
  video,
  active = false,
  priority = false,
}: {
  video: Video
  active?: boolean
  priority?: boolean
}) {
  const { getChannel } = useLibrary()
  const channel = getChannel(video.channelId)

  return (
    <Link
      to={`/watch/${video.id}`}
      className={classNames(
        'flex gap-2 rounded-xl p-1 transition-colors',
        active ? 'bg-hover' : 'hover:bg-hover',
      )}
    >
      <div className="w-[168px] shrink-0">
        <Thumbnail video={video} className="aspect-video w-full" rounded="rounded-lg" priority={priority} />
      </div>
      <div className="min-w-0 flex-1 pr-2 pt-0.5">
        <h4 className="yt-clamp-2 text-[14px] font-medium leading-5 text-fg">{video.title}</h4>
        <div className="mt-1 truncate text-[12px] text-fg2">{channel?.name}</div>
        <div className="truncate text-[12px] text-fg2">
          {formatVideoMeta(video.viewCount, video.publishedAt)}
        </div>
      </div>
    </Link>
  )
}

export { Thumbnail }
