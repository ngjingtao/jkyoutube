import { Link, useParams } from 'react-router-dom'
import { useLibrary } from '../store/library'
import { Thumbnail } from '../components/VideoCard'
import { ChannelAvatar } from '../components/ChannelAvatar'
import { classNames, formatCount, formatDuration, formatVideoMeta } from '../lib/format'
import { MoreVerticalIcon, PlayIcon, ShuffleIcon } from '../components/icons'

export function PlaylistPage() {
  const { id = '' } = useParams()
  const { getPlaylist, getPlaylistVideos, getChannel } = useLibrary()

  const playlist = getPlaylist(id)
  const videos = getPlaylistVideos(id)

  if (!playlist && videos.length === 0) {
    return (
      <div className="px-6 py-24 text-center">
        <h1 className="text-[20px] font-medium">This playlist doesn't exist</h1>
        <Link to="/" className="mt-6 inline-block text-[14px] font-medium text-[#065fd4]">
          Go to Home
        </Link>
      </div>
    )
  }

  const title = playlist?.title ?? 'Playlist'
  const owner = playlist?.channelId ? getChannel(playlist.channelId) : undefined
  const first = videos[0]
  const totalSeconds = videos.reduce((sum, v) => sum + v.durationSeconds, 0)

  return (
    <div className="pb-16">
      {/* Gradient header panel, as on YouTube */}
      <div className="px-4 py-6 md:px-6">
        <div
          className="flex flex-col gap-6 rounded-2xl p-4 md:flex-row md:items-center"
          style={{
            background: 'linear-gradient(180deg, rgba(0,0,0,.08) 0%, rgba(0,0,0,0) 100%)',
          }}
        >
          <Link to={first ? `/watch/${first.id}` : '#'} className="relative w-full max-w-[360px] shrink-0">
            <div className="aspect-video overflow-hidden rounded-xl bg-thumbbg">
              {first ? (
                <Thumbnail video={first} rounded="rounded-none" className="h-full w-full" />
              ) : null}
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-chip px-3 py-1.5 text-[12px] font-medium text-fg">
              <span>{formatCount(videos.length)} videos</span>
              <span className="text-fg2">{formatDuration(totalSeconds)}</span>
            </div>
          </Link>

          <div className="min-w-0 flex-1">
            <h1 className="yt-clamp-2 text-[24px] font-bold leading-8 text-fg md:text-[28px]">
              {title}
            </h1>
            {owner ? (
              <Link to={`/channel/${owner.id}`} className="mt-2 flex items-center gap-2">
                <ChannelAvatar channel={owner} size={24} />
                <span className="text-[14px] text-fg">{owner.name}</span>
              </Link>
            ) : null}
            {playlist?.description ? (
              <p className="mt-1 text-[13px] text-fg2">{playlist.description}</p>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link
                to={first ? `/watch/${first.id}` : '#'}
                className="inline-flex h-9 items-center gap-2 rounded-full bg-chip-on px-4 text-[14px] font-medium text-chip-on-fg"
              >
                <PlayIcon size={20} />
                Play all
              </Link>
              <button
                type="button"
                className="inline-flex h-9 items-center gap-2 rounded-full bg-chip px-4 text-[14px] font-medium text-fg hover:bg-chip-hover"
              >
                <ShuffleIcon size={20} />
                Shuffle
              </button>
              <button type="button" aria-label="More actions" className="yt-icon-btn h-9 w-9">
                <MoreVerticalIcon size={22} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Item list */}
      <div className="px-4 md:px-6">
        {videos.length === 0 ? (
          <p className="py-16 text-center text-[14px] text-fg2">This playlist is empty.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {videos.map((v, index) => (
              <li key={`${v.id}-${index}`}>
                <Link
                  to={`/watch/${v.id}`}
                  className={classNames(
                    'flex items-center gap-3 rounded-xl p-1 hover:bg-hover',
                  )}
                >
                  <span className="w-6 shrink-0 text-center text-[12px] text-fg2">{index + 1}</span>
                  <div className="w-[120px] shrink-0 sm:w-[160px]">
                    <Thumbnail video={v} className="aspect-video w-full" rounded="rounded-lg" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="yt-clamp-2 text-[14px] font-medium leading-5 text-fg">{v.title}</h3>
                    <div className="mt-0.5 truncate text-[12px] text-fg2">{v.description ? '' : ''}</div>
                    <div className="truncate text-[12px] text-fg2">
                      {formatVideoMeta(v.viewCount, v.publishedAt)}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Action menu"
                    className="yt-icon-btn hidden h-9 w-9 shrink-0 sm:inline-flex"
                  >
                    <MoreVerticalIcon size={20} />
                  </button>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
