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

export default function App() {
  return (
    <LibraryProvider>
      <Routes>
        {/* The admin panel is a tool, so it renders without the YouTube chrome. */}
        <Route path="/admin" element={<AdminPage />} />

        <Route
          path="*"
          element={
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
          }
        />
      </Routes>
    </LibraryProvider>
  )
}
