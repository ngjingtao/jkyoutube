import { useMemo, useState } from 'react'
import { CategoryChips } from '../components/CategoryChips'
import { VideoGrid } from '../components/VideoGrid'
import { SpinnerIcon } from '../components/icons'
import { useLibrary } from '../store/library'
import { useViewerMode } from '../lib/viewerMode'
import { useYouTubeFeed, useYouTubeHomeFeed } from '../lib/youtubeFeed'
import { useYouTubeAccountFeed } from '../lib/youtubeAccount'
import { useGoogleAccount, useGoogleClientId } from '../lib/googleAuth'
import { normalizePriority, weightedShuffle } from '../lib/format'
import type { Video } from '../types'

export function HomePage() {
  const { videos, categories } = useLibrary()
  const mode = useViewerMode()
  const youtube = mode === 'youtube'

  // Trending is still loaded in account mode: it supplies category names and
  // is the fallback if the account has nothing to show.
  const feed = useYouTubeFeed(youtube)
  const homeFeed = useYouTubeHomeFeed(youtube)
  const { clientId, ready: clientReady } = useGoogleClientId()
  const google = useGoogleAccount(clientId)
  const account = useYouTubeAccountFeed(youtube && Boolean(google.token))
  const usingAccount = youtube && Boolean(google.token)

  const [active, setActive] = useState('all')

  // The imported home snapshot wins, then the signed-in account, then trending.
  const usingHome = youtube && homeFeed.status === 'ready' && homeFeed.videos.length > 0
  const homeWaiting = youtube && (homeFeed.status === 'idle' || homeFeed.status === 'loading')
  const source = usingHome
    ? homeFeed.videos
    : usingAccount
      ? account.videos
      : youtube
        ? feed.videos
        : videos
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
   * YouTube lists keep their own order — most popular, or newest from the
   * account — because shuffling them would be misleading.
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

  const loading =
    homeWaiting ||
    (youtube &&
      !usingHome &&
      (usingAccount
        ? account.status === 'idle' || account.status === 'loading'
        : feed.status === 'idle' || feed.status === 'loading'))
  const error =
    youtube &&
    !usingHome &&
    !homeWaiting &&
    (usingAccount
      ? account.status === 'error' && account.error
      : feed.status === 'error' && feed.error)

  return (
    <>
      {usingHome ? (
        <div className="mx-4 mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-chip px-3 py-2 text-[12px] leading-5 text-fg2 md:mx-6">
          <span className="min-w-0 flex-1">
            Showing the home feed imported from your signed-in browser. It is a snapshot — re-run
            the Admin bookmarklet when you want YouTube's latest picks.
          </span>
        </div>
      ) : youtube && clientReady && clientId ? (
        <div className="mx-4 mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-chip px-3 py-2 text-[12px] leading-5 text-fg2 md:mx-6">
          {google.token ? (
            <>
              <span className="min-w-0 flex-1">
                Showing{' '}
                <strong className="font-medium text-fg">
                  {account.accountTitle || 'your YouTube account'}
                </strong>{' '}
                — your subscriptions and liked videos.
              </span>
              <button
                type="button"
                onClick={google.signOut}
                className="font-medium text-[#065fd4]"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <span className="min-w-0 flex-1">
                These are YouTube's popular videos. Sign in with Google to see your own
                subscriptions and liked videos instead.
              </span>
              <button
                type="button"
                onClick={() => void google.signIn()}
                disabled={google.busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#065fd4] px-3 py-1.5 text-[12px] font-medium text-white hover:brightness-110 disabled:opacity-50"
              >
                {google.busy ? <SpinnerIcon size={14} className="animate-spin" /> : null}
                Sign in with Google
              </button>
            </>
          )}
        </div>
      ) : null}

      {google.error ? (
        <p className="mx-4 mt-2 text-[12px] leading-5 text-[#ff9d00] md:mx-6">{google.error}</p>
      ) : null}

      {youtube && (loading || error) ? null : (
        <CategoryChips categories={chips} active={activeId} onChange={setActive} />
      )}
      <div className="px-4 pb-16 md:px-6">
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-24 text-[14px] text-fg2">
            <SpinnerIcon size={28} className="animate-spin" />
            {homeWaiting
              ? 'Loading your YouTube home…'
              : usingAccount
                ? 'Loading your YouTube…'
                : 'Loading YouTube videos…'}
          </div>
        ) : error ? (
          <div className="py-24 text-center">
            <p className="text-[16px] text-fg">
              {usingAccount ? 'Your YouTube account could not be loaded.' : 'YouTube content is unavailable.'}
            </p>
            <p className="mx-auto mt-2 max-w-[420px] text-[14px] leading-5 text-fg2">{error}</p>
            {usingAccount && clientId ? (
              <button
                type="button"
                onClick={() => void google.signIn()}
                disabled={google.busy}
                className="mt-4 rounded-lg bg-[#065fd4] px-4 py-2 text-[13px] font-medium text-white hover:brightness-110 disabled:opacity-50"
              >
                Sign in again
              </button>
            ) : null}
          </div>
        ) : ordered.length ? (
          <VideoGrid videos={ordered} />
        ) : (
          <p className="py-16 text-center text-[14px] text-fg2">
            {usingAccount
              ? 'No subscriptions or liked videos were found for this YouTube account.'
              : youtube
                ? 'YouTube has no videos in this category right now.'
                : 'No videos in this category yet.'}
          </p>
        )}
      </div>
    </>
  )
}
