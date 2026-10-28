import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useLibrary } from '../store/library'
import { VideoGrid } from '../components/VideoGrid'
import { SpinnerIcon } from '../components/icons'
import { useViewerMode } from '../lib/viewerMode'
import { getYouTubeVideo, useYouTubeFeed } from '../lib/youtubeFeed'
import type { Video } from '../types'

export type FeedKind =
  | 'subscriptions'
  | 'trending'
  | 'history'
  | 'liked'
  | 'downloads'
  | 'library'
  | 'you'
  | 'music'
  | 'gaming'
  | 'news'

const COPY: Record<FeedKind, { title: string; empty: string }> = {
  subscriptions: { title: 'Subscriptions', empty: 'Subscribe to channels to see their newest videos here.' },
  trending: { title: 'Trending', empty: 'Nothing is trending right now.' },
  history: { title: 'Watch history', empty: 'Videos you watch will show up here.' },
  liked: { title: 'Liked videos', empty: 'Videos you like will show up here.' },
  downloads: { title: 'Downloads', empty: 'Videos you save for offline will show up here.' },
  library: { title: 'Library', empty: 'Your saved videos will show up here.' },
  you: { title: 'Your channel', empty: 'Your uploads will show up here.' },
  music: { title: 'Music', empty: 'No music videos yet.' },
  gaming: { title: 'Gaming', empty: 'No gaming videos yet.' },
  news: { title: 'News', empty: 'No news videos yet.' },
}

export function FeedPage({ kind }: { kind: FeedKind }) {
  const {
    videos,
    subscriptions,
    history,
    reactions,
    watchLater,
  } = useLibrary()

  const mode = useViewerMode()
  const youtube = mode === 'youtube'
  const ytFeed = useYouTubeFeed(youtube)

  const list = useMemo<Video[]>(() => {
    // Watched and saved lists store ids, which may point at either library or
    // YouTube videos, so resolve against both.
    const resolve = (id: string) => videos.find((v) => v.id === id) ?? getYouTubeVideo(id)
    const youtubeCategory = (names: string[]) => {
      const ids = ytFeed.categories.filter((c) => names.includes(c.name)).map((c) => c.id)
      return ytFeed.videos.filter((v) => v.categoryId && ids.includes(v.categoryId))
    }

    switch (kind) {
      case 'subscriptions':
        return youtube ? [] : videos.filter((v) => subscriptions.includes(v.channelId))
      case 'history':
        return history.map(resolve).filter(Boolean) as Video[]
      case 'liked':
        return videos.filter((v) => reactions[v.id] === 'like').concat(
          Object.entries(reactions)
            .filter(([, value]) => value === 'like')
            .map(([id]) => getYouTubeVideo(id))
            .filter(Boolean) as Video[],
        )
      case 'downloads':
      case 'library':
        return watchLater.map(resolve).filter(Boolean) as Video[]
      case 'trending':
        return youtube ? ytFeed.videos : [...videos].sort((a, b) => b.viewCount - a.viewCount)
      case 'music':
        return youtube ? youtubeCategory(['Music']) : videos.filter((v) => v.categoryId === 'music')
      case 'gaming':
        return youtube ? youtubeCategory(['Gaming']) : videos.filter((v) => v.categoryId === 'gaming')
      case 'news':
        return youtube
          ? youtubeCategory(['News & Politics'])
          : videos.filter((v) => v.categoryId === 'science' || v.categoryId === 'nature')
      default:
        return youtube ? ytFeed.videos : videos
    }
  }, [kind, videos, subscriptions, history, reactions, watchLater, youtube, ytFeed])

  const copy = COPY[kind]
  const usesYouTubeList =
    youtube && (kind === 'trending' || kind === 'music' || kind === 'gaming' || kind === 'news')
  const loading =
    usesYouTubeList && (ytFeed.status === 'idle' || ytFeed.status === 'loading')

  return (
    <div className="mx-auto max-w-[1754px] px-4 pb-16 pt-6 md:px-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-[24px] font-bold text-fg">{copy.title}</h1>
        {kind === 'history' && list.length > 0 ? (
          <ClearHistoryButton />
        ) : null}
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-20 text-[14px] text-fg2">
          <SpinnerIcon size={28} className="animate-spin" />
          Loading YouTube videos…
        </div>
      ) : usesYouTubeList && ytFeed.status === 'error' ? (
        <div className="py-24 text-center">
          <p className="text-[16px] text-fg">YouTube content is unavailable.</p>
          <p className="mx-auto mt-2 max-w-[420px] text-[14px] leading-5 text-fg2">
            {ytFeed.error}
          </p>
        </div>
      ) : list.length ? (
        <VideoGrid videos={list} />
      ) : (
        <div className="py-24 text-center">
          <p className="text-[16px] text-fg">{copy.empty}</p>
          <Link to="/" className="mt-4 inline-block text-[14px] font-medium text-[#065fd4]">
            Browse videos
          </Link>
        </div>
      )}
    </div>
  )
}

function ClearHistoryButton() {
  const { clearHistory } = useLibrary()
  return (
    <button
      type="button"
      onClick={clearHistory}
      className="text-[14px] font-medium text-fg2 hover:text-fg"
    >
      Clear all watch history
    </button>
  )
}
