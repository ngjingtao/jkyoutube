import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useLibrary } from '../store/library'
import { VideoGrid } from '../components/VideoGrid'
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

  const list = useMemo<Video[]>(() => {
    switch (kind) {
      case 'subscriptions':
        return videos.filter((v) => subscriptions.includes(v.channelId))
      case 'history':
        return history
          .map((id) => videos.find((v) => v.id === id))
          .filter(Boolean) as Video[]
      case 'liked':
        return videos.filter((v) => reactions[v.id] === 'like')
      case 'downloads':
      case 'library':
        return watchLater.map((id) => videos.find((v) => v.id === id)).filter(Boolean) as Video[]
      case 'trending':
        return [...videos].sort((a, b) => b.viewCount - a.viewCount)
      case 'music':
        return videos.filter((v) => v.categoryId === 'music')
      case 'gaming':
        return videos.filter((v) => v.categoryId === 'gaming')
      case 'news':
        return videos.filter((v) => v.categoryId === 'science' || v.categoryId === 'nature')
      default:
        return videos
    }
  }, [kind, videos, subscriptions, history, reactions, watchLater])

  const copy = COPY[kind]

  return (
    <div className="mx-auto max-w-[1754px] px-4 pb-16 pt-6 md:px-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-[24px] font-bold text-fg">{copy.title}</h1>
        {kind === 'history' && list.length > 0 ? (
          <ClearHistoryButton />
        ) : null}
      </div>

      {list.length ? (
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
