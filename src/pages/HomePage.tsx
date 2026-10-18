import { useState } from 'react'
import { CategoryChips } from '../components/CategoryChips'
import { VideoGrid } from '../components/VideoGrid'
import { useLibrary } from '../store/library'

export function HomePage() {
  const { videos, categories } = useLibrary()
  const [active, setActive] = useState('all')

  const filtered = active === 'all' ? videos : videos.filter((v) => v.categoryId === active)

  return (
    <>
      <CategoryChips categories={categories} active={active} onChange={setActive} />
      <div className="px-4 pb-16 md:px-6">
        {filtered.length ? (
          <VideoGrid videos={filtered} />
        ) : (
          <p className="py-16 text-center text-[14px] text-fg2">No videos in this category yet.</p>
        )}
      </div>
    </>
  )
}
