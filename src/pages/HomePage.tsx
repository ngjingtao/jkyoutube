import { useMemo, useState } from 'react'
import { CategoryChips } from '../components/CategoryChips'
import { VideoGrid } from '../components/VideoGrid'
import { useLibrary } from '../store/library'
import { normalizePriority, weightedShuffle } from '../lib/format'
import type { Video } from '../types'

export function HomePage() {
  const { videos, categories } = useLibrary()
  const [active, setActive] = useState('all')

  const filtered = useMemo(
    () => (active === 'all' ? videos : videos.filter((v) => v.categoryId === active)),
    [videos, active],
  )

  /**
   * Home is shuffled, weighted by each video's show priority (1-5, 5 highest),
   * so a 5 turns up near the top far more often than a 1 but the order is never
   * the same twice.
   *
   * Recomputed when the category changes or the library reloads, which also
   * means navigating away and back gives a fresh order. Pinned videos are left
   * at the front: pinning is a deliberate override, so it should beat the dice.
   */
  const ordered = useMemo<Video[]>(() => {
    const pinned = filtered.filter((v) => v.pinned)
    const rest = filtered.filter((v) => !v.pinned)
    return [
      ...pinned,
      ...weightedShuffle(rest, (v) => normalizePriority(v.priority)),
    ]
  }, [filtered])

  return (
    <>
      <CategoryChips categories={categories} active={active} onChange={setActive} />
      <div className="px-4 pb-16 md:px-6">
        {ordered.length ? (
          <VideoGrid videos={ordered} />
        ) : (
          <p className="py-16 text-center text-[14px] text-fg2">No videos in this category yet.</p>
        )}
      </div>
    </>
  )
}
