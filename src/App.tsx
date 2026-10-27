import { useEffect, useRef, useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { LibraryProvider } from './store/library'
import { AdminPage } from './pages/AdminPage'
import { ChannelPage } from './pages/ChannelPage'
import { FeedPage } from './pages/FeedPage'
import { HomePage } from './pages/HomePage'
import { PlaylistPage } from './pages/PlaylistPage'
import { ResultsPage } from './pages/ResultsPage'
import { NotFoundPage, ShortsPage } from './pages/ShortsPage'
import { WatchPage } from './pages/WatchPage'
import { NORMAL_YOUTUBE_URL, fetchViewerMode, isCuratedPreview } from './lib/viewerMode'

/**
 * How long to wait for the shared setting before showing the curated app.
 * Supabase normally answers in well under a second; on a dead connection the
 * viewer should get their videos rather than a black screen.
 */
const MODE_CHECK_TIMEOUT_MS = 2500

/** How quickly a change made in Admin reaches a viewer that is already open. */
const MODE_POLL_MS = 60_000

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = window.setTimeout(() => resolve(fallback), ms)
    promise.then(
      (value) => {
        window.clearTimeout(timer)
        resolve(value)
      },
      () => {
        window.clearTimeout(timer)
        resolve(fallback)
      },
    )
  })
}

/**
 * Hands the screen to the real YouTube when the Admin page says so.
 *
 * This wraps only the viewer routes — `/admin` is deliberately outside it, so
 * the content manager stays reachable on every device even while the site is
 * in normal-YouTube mode.
 *
 * The viewer UI never shows a switch or a message: it either renders the
 * curated app or navigates away to youtube.com, which is what "normal YouTube"
 * means to the person holding the device. Every device follows the setting,
 * desktops included; `?preview=curated` opts out for one visit.
 */
function ViewerModeGate({ children }: { children: React.ReactNode }) {
  const preview = isCuratedPreview()
  // When previewing there is nothing to wait for, so render immediately.
  const [checked, setChecked] = useState(preview)
  const redirectingRef = useRef(false)

  useEffect(() => {
    if (preview) return

    let cancelled = false

    const check = async () => {
      if (cancelled || redirectingRef.current) return
      try {
        const mode = await withTimeout(fetchViewerMode(), MODE_CHECK_TIMEOUT_MS, 'curated')
        if (cancelled || mode !== 'youtube') return
        redirectingRef.current = true
        // `replace` so our app is not left in the back stack, ready to bounce
        // forward to YouTube again the moment the viewer goes back.
        window.location.replace(NORMAL_YOUTUBE_URL)
      } finally {
        if (!cancelled) setChecked(true)
      }
    }

    void check()

    // Re-check when the viewer comes back to the app, and once a minute while
    // it is open, so turning the switch on in Admin takes effect without the
    // iPad having to be relaunched.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void check()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void check()
    }, MODE_POLL_MS)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.clearInterval(interval)
    }
  }, [preview])

  // A black frame while the shared mode is read, so the curated feed never
  // flashes up for a moment before YouTube takes over.
  if (!checked) return <div className="min-h-screen bg-black" />

  return <>{children}</>
}

export default function App() {
  return (
    <LibraryProvider>
      <Routes>
        {/* The admin panel is a tool, so it renders without the YouTube chrome. */}
        <Route path="/admin" element={<AdminPage />} />

        <Route
          path="*"
          element={
            <ViewerModeGate>
              <AppShell>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/watch/:id" element={<WatchPage />} />
                  <Route path="/results" element={<ResultsPage />} />
                  <Route path="/channel/:id" element={<ChannelPage />} />
                  <Route path="/playlist/:id" element={<PlaylistPage />} />
                  <Route path="/shorts" element={<ShortsPage />} />
                  <Route path="/feed/subscriptions" element={<FeedPage kind="subscriptions" />} />
                  <Route path="/feed/trending" element={<FeedPage kind="trending" />} />
                  <Route path="/feed/history" element={<FeedPage kind="history" />} />
                  <Route path="/feed/liked" element={<FeedPage kind="liked" />} />
                  <Route path="/feed/downloads" element={<FeedPage kind="downloads" />} />
                  <Route path="/feed/library" element={<FeedPage kind="library" />} />
                  <Route path="/feed/you" element={<FeedPage kind="you" />} />
                  <Route path="/feed/music" element={<FeedPage kind="music" />} />
                  <Route path="/feed/gaming" element={<FeedPage kind="gaming" />} />
                  <Route path="/feed/news" element={<FeedPage kind="news" />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </AppShell>
            </ViewerModeGate>
          }
        />
      </Routes>
    </LibraryProvider>
  )
}
