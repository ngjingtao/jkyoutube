import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useLibrary } from '../store/library'
import { VideoGrid } from '../components/VideoGrid'
import { ChannelAvatar } from '../components/ChannelAvatar'
import { classNames, formatCount, formatSubscribers, formatViews } from '../lib/format'
import { BellIcon, SpinnerIcon } from '../components/icons'
import { useViewerMode } from '../lib/viewerMode'
import { getYouTubeChannel, useYouTubeChannel, YT_CHANNEL_PREFIX } from '../lib/youtubeFeed'

const TABS = ['Home', 'Videos', 'Shorts', 'Live', 'Playlists', 'Community', 'About'] as const

export function ChannelPage() {
  const { id = '' } = useParams()
  const { getChannel, getChannelVideos, isSubscribed, toggleSubscribe } = useLibrary()
  const [tab, setTab] = useState<string>('Videos')

  const mode = useViewerMode()
  const youtube = mode === 'youtube' && id.startsWith(YT_CHANNEL_PREFIX)
  const ytChannel = useYouTubeChannel(id, youtube)

  const channel = youtube ? (ytChannel.channel ?? getYouTubeChannel(id)) : getChannel(id)
  const videos = youtube ? ytChannel.videos : getChannelVideos(id)

  if (!channel) {
    if (youtube && (ytChannel.status === 'idle' || ytChannel.status === 'loading')) {
      return (
        <div className="flex flex-col items-center gap-3 px-6 py-24 text-[14px] text-fg2">
          <SpinnerIcon size={28} className="animate-spin" />
          Loading channel…
        </div>
      )
    }
    return (
      <div className="px-6 py-24 text-center">
        <h1 className="text-[20px] font-medium">This channel doesn't exist</h1>
        {youtube && ytChannel.error ? (
          <p className="mx-auto mt-2 max-w-[420px] text-[14px] leading-5 text-fg2">
            {ytChannel.error}
          </p>
        ) : null}
        <Link to="/" className="mt-6 inline-block text-[14px] font-medium text-[#065fd4]">
          Go to Home
        </Link>
      </div>
    )
  }

  const subscribed = isSubscribed(channel.id)
  const totalViews = videos.reduce((sum, v) => sum + v.viewCount, 0)

  return (
    <div className="pb-16">
      {/* Banner — YouTube's default gradient when a channel has not set one */}
      <div
        className="h-[106px] w-full md:h-[188px]"
        style={{ background: 'linear-gradient(90deg, #d9d9d9 0%, #bfbfbf 100%)' }}
      />

      <div className="px-4 md:px-6">
        <div className="flex flex-col gap-6 py-4 md:flex-row md:items-start md:gap-6">
          <ChannelAvatar channel={channel} size={128} className="border border-line" />

          <div className="min-w-0 flex-1 pt-1">
            <h1 className="text-[24px] font-bold leading-8 text-fg md:text-[36px] md:leading-10">
              {channel.name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-fg2">
              <span className="font-medium text-fg">{channel.handle}</span>
              {typeof channel.subscriberCount === 'number' ? (
                <>
                  <span>•</span>
                  <span>{formatSubscribers(channel.subscriberCount)}</span>
                </>
              ) : null}
              <span>•</span>
              <span>{formatCount(videos.length)} videos</span>
            </div>
            {channel.description ? (
              <p className="yt-clamp-1 mt-1 text-[14px] text-fg2">{channel.description}</p>
            ) : null}
            <button type="button" className="mt-2 text-[14px] text-fg2 hover:text-fg">
              more about this channel
            </button>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => toggleSubscribe(channel.id)}
                className={classNames(
                  'inline-flex h-9 items-center gap-2 rounded-full px-4 text-[14px] font-medium transition-colors',
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
              <button
                type="button"
                className="h-9 rounded-full bg-chip px-4 text-[14px] font-medium text-fg hover:bg-chip-hover"
              >
                Join
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="no-scrollbar -mx-4 flex gap-8 overflow-x-auto border-b border-line px-4 md:mx-0 md:px-0">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={classNames(
                'relative whitespace-nowrap pb-3 pt-1 text-[14px] font-medium uppercase tracking-wide transition-colors',
                t === tab ? 'text-fg' : 'text-fg2 hover:text-fg',
              )}
            >
              {t}
              {t === tab ? (
                <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-fg" />
              ) : null}
            </button>
          ))}
        </div>

        <div className="pt-6">
          {tab === 'About' ? (
            <div className="max-w-[700px]">
              <h2 className="text-[16px] font-medium text-fg">About</h2>
              <p className="mt-3 text-[14px] leading-5 text-fg2">
                {channel.description || 'This channel has no description yet.'}
              </p>
              <dl className="mt-6 space-y-2 text-[14px] text-fg">
                <div>
                  <dt className="inline text-fg2">Joined </dt>
                  <dd className="inline">—</dd>
                </div>
                <div>
                  <dt className="inline text-fg2">Total views </dt>
                  <dd className="inline">{formatViews(totalViews)}</dd>
                </div>
              </dl>
            </div>
          ) : videos.length ? (
            <VideoGrid videos={videos} />
          ) : (
            <p className="py-16 text-center text-[14px] text-fg2">
              This channel has no {tab.toLowerCase()} yet.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
