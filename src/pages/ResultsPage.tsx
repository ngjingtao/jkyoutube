import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLibrary } from '../store/library'
import { VideoRow } from '../components/VideoCard'
import { classNames } from '../lib/format'
import { FilterIcon, SpinnerIcon } from '../components/icons'
import { useViewerMode } from '../lib/viewerMode'
import { useYouTubeSearch } from '../lib/youtubeFeed'

const FILTERS = ['All', 'Videos', 'Shorts', 'Live', 'Playlists', 'This week'] as const

export function ResultsPage() {
  const [params] = useSearchParams()
  const query = params.get('search_query') ?? ''
  const { search } = useLibrary()
  const mode = useViewerMode()
  const youtube = mode === 'youtube'
  const ytSearch = useYouTubeSearch(query, youtube)
  const [filter, setFilter] = useState<string>('All')

  const results = useMemo(
    () => (youtube ? ytSearch.videos : search(query)),
    [youtube, ytSearch.videos, search, query],
  )
  const searching = youtube && Boolean(query) && (ytSearch.status === 'idle' || ytSearch.status === 'loading')

  return (
    <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-4 md:px-6">
      {/* Search-page filter rail */}
      <div className="no-scrollbar mb-4 flex items-center gap-3 overflow-x-auto border-b border-line pb-3">
        <button
          type="button"
          aria-label="Filters"
          className="yt-icon-btn h-10 w-10 shrink-0"
        >
          <FilterIcon size={22} />
        </button>
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={classNames(
              'shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-[14px] font-medium transition-colors',
              f === filter ? 'bg-chip-on text-chip-on-fg' : 'bg-chip text-fg hover:bg-chip-hover',
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {!query ? (
        <p className="py-20 text-center text-[14px] text-fg2">
          Type something in the search box to find videos.
        </p>
      ) : searching ? (
        <div className="flex flex-col items-center gap-3 py-20 text-[14px] text-fg2">
          <SpinnerIcon size={28} className="animate-spin" />
          Searching YouTube…
        </div>
      ) : youtube && ytSearch.status === 'error' ? (
        <div className="py-20 text-center">
          <p className="text-[16px] text-fg">YouTube search is unavailable.</p>
          <p className="mx-auto mt-2 max-w-[420px] text-[14px] leading-5 text-fg2">
            {ytSearch.error}
          </p>
        </div>
      ) : results.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-[16px] text-fg">
            No results found for <span className="font-medium">“{query}”</span>
          </p>
          <p className="mt-2 text-[14px] text-fg2">Try different keywords.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {results.map((v, i) => (
            <VideoRow key={v.id} video={v} priority={i < 2} />
          ))}
        </div>
      )}
    </div>
  )
}
