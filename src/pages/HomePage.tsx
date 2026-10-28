import { useMemo, useState } from 'react'
import { CategoryChips } from '../components/CategoryChips'
import { VideoGrid } from '../components/VideoGrid'
import { SpinnerIcon } from '../components/icons'
import { useLibrary } from '../store/library'
import { useViewerMode } from '../lib/viewerMode'
import { useYouTubeFeed } from '../lib/youtubeFeed'
import { normalizePriority, weightedShuffle } from '../lib/format'
import type { Video } from '../types'

export function HomePage() {
  const { videos, categories } = useLibrary()
  const mode = useViewerMode()
  const youtube = mode === 'youtube'
  const feed = useYouTubeFeed(youtube)
  const [active, setActive] = useState('all')

  const source = youtube ? feed.videos : videos
  const chips = youtube ? feed.categories : categories
  // A category id from the other mode should not leave the grid empty.
  const activeId = chips.some((c) => c.id === active) ? active : 'all'

  const filtered = useMemo(
    () => (activeId === 'all' ? source : source.filter((v) => v.categoryId === activeId)),
    [source, activeId],
  )

  /**
   * Home is shuffled, weighted by each video's show priority (1-5, 5 highest),
   * so a 5 turns up near the top far more often than a 1 but the order is never
   * the same twice.
   *
   * Recomputed when the category changes or the library reloads, which also
   * means navigating away and back gives a fresh order. Pinned videos are left
   * at the front: pinning is a deliberate override, so it should beat the dice.
   *
   * YouTube's own list keeps YouTube's order — that is what "most popular"
   * means, and shuffling it would be misleading.
   */
  const ordered = useMemo<Video[]>(() => {
    if (youtube) return filtered
    const pinned = filtered.filter((v) => v.pinned)
    const rest = filtered.filter((v) => !v.pinned)
    return [
      ...pinned,
      ...weightedShuffle(rest, (v) => normalizePriority(v.priority)),
    ]
  }, [filtered, youtube])

  const loading = youtube && (feed.status === 'idle' || feed.status === 'loading')

  return (
    <>
      {youtube && (loading || feed.status === 'error') ? null : (
        <CategoryChips categories={chips} active={activeId} onChange={setActive} />
      )}
      <div className="px-4 pb-16 md:px-6">
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-24 text-[14px] text-fg2">
            <SpinnerIcon size={28} className="animate-spin" />
            Loading YouTube videos…
          </div>
        ) : youtube && feed.status === 'error' ? (
          <div className="py-24 text-center">
            <p className="text-[16px] text-fg">YouTube content is unavailable.</p>
            <p className="mx-auto mt-2 max-w-[420px] text-[14px] leading-5 text-fg2">
              {feed.error}
            </p>
          </div>
        ) : ordered.length ? (
          <VideoGrid videos={ordered} />
        ) : (
          <p className="py-16 text-center text-[14px] text-fg2">
            {youtube ? 'YouTube has no videos in this category right now.' : 'No videos in this category yet.'}
          </p>
        )}
      </div>
    </>
  )
}
