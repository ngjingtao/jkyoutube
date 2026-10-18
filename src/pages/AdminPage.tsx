import { useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchOEmbed, useLibrary } from '../store/library'
import type { LibraryMode } from '../store/library'
import { classNames, parseYouTubeId, timeAgo, youTubeThumbnail } from '../lib/format'
import { useLocalStorage } from '../lib/hooks'
import { AlertIcon, CheckIcon, CloseIcon, PlusIcon, SpinnerIcon } from '../components/icons'
import type { Video } from '../types'

/**
 * The PC-side control panel.
 *
 * Not part of the viewer experience, so it deliberately looks like a tool
 * rather than like YouTube.
 *
 * NOTE: the passcode below is a *preview* gate only — there is no server yet
 * and everything is stored in this browser. Real per-user authentication
 * arrives with Supabase in Phase 3, at which point this screen is protected
 * server-side and this gate is removed.
 */

const PREVIEW_PASSCODE = 'admin'

export function AdminPage() {
  const [authed, setAuthed] = useLocalStorage('jk.adminPreview', false)
  if (!authed) return <PasscodeGate onUnlock={() => setAuthed(true)} />
  return <AdminDashboard onSignOut={() => setAuthed(false)} />
}

function PasscodeGate({ onUnlock }: { onUnlock: () => void }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)

  return (
    <div className="mx-auto flex max-w-[420px] flex-col gap-4 px-6 py-24">
      <h1 className="text-[22px] font-semibold text-fg">Admin</h1>
      <p className="text-[13px] leading-5 text-fg2">
        Preview gate only. Until Supabase authentication is wired up, this password
        lives in the page source and data is stored in this browser.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (value === PREVIEW_PASSCODE) onUnlock()
          else setError(true)
        }}
        className="flex flex-col gap-3"
      >
        <input
          type="password"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setError(false)
          }}
          placeholder="Passcode"
          className="h-11 rounded-lg border border-line bg-search px-3 text-[15px] text-fg outline-none focus:border-[#1c62b9]"
        />
        {error ? <p className="text-[13px] text-[#ff4e45]">Incorrect passcode.</p> : null}
        <button
          type="submit"
          className="h-11 rounded-lg bg-[#065fd4] text-[15px] font-medium text-white hover:brightness-110"
        >
          Unlock
        </button>
      </form>
      <p className="text-[12px] text-fg2">
        Default passcode is <code className="rounded bg-chip px-1">admin</code>
      </p>
      <Link to="/" className="text-[13px] text-[#065fd4]">
        ← Back to the app
      </Link>
    </div>
  )
}

function AdminDashboard({ onSignOut }: { onSignOut: () => void }) {
  const { categories, customVideos, removeVideo, resetToSeed, addVideo, videos } = useLibrary()
  const [libraryUrl, setLibraryUrl] = useState(() => window.location.origin)

  return (
    <div className="mx-auto max-w-[1000px] px-4 pb-24 pt-8 md:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold text-fg">Content manager</h1>
          <p className="mt-1 text-[13px] text-fg2">
            {videos.length} videos live · {customVideos.length} added by you
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="rounded-lg bg-chip px-4 py-2 text-[13px] font-medium text-fg hover:bg-chip-hover"
          >
            Open the app
          </Link>
          <button
            type="button"
            onClick={onSignOut}
            className="rounded-lg bg-chip px-4 py-2 text-[13px] font-medium text-fg hover:bg-chip-hover"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="mt-6 rounded-xl border border-line bg-chip p-4">
        <p className="text-[13px] leading-5 text-fg2">
          <strong className="font-medium text-fg">Share this address</strong> with the iPad and
          the Android app. Anything you add below appears there immediately.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-search px-3 py-2 text-[13px] text-fg">
            {libraryUrl}
          </code>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(libraryUrl)}
            className="rounded-lg bg-[#065fd4] px-3 py-2 text-[13px] font-medium text-white"
          >
            Copy
          </button>
          <button
            type="button"
            onClick={() => setLibraryUrl(window.location.origin)}
            className="rounded-lg bg-chip px-3 py-2 text-[13px] font-medium text-fg hover:bg-chip-hover"
          >
            Reset
          </button>
        </div>
      </div>

      <LibraryContentsCard />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <AddSingleVideo categories={categories} addVideo={addVideo} />
        <BulkAdd categories={categories} addVideo={addVideo} />
      </div>

      <YoutubeSearchKeyCard />

      <MyLibrary
        videos={customVideos}
        onRemove={removeVideo}
        onReset={resetToSeed}
        categories={categories}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ adding */

/**
 * Controls whether the bundled placeholder library is shown.
 *
 * This matters because the placeholders are hardcoded, so without a control
 * here the app could never show *only* your own content.
 */
function LibraryContentsCard() {
  const { libraryMode, setLibraryMode, sampleVideoCount, customVideos } = useLibrary()

  const options: Array<{ value: LibraryMode; label: string; hint: string }> = [
    {
      value: 'auto',
      label: 'Auto',
      hint: 'Placeholders show only until you add your first video.',
    },
    {
      value: 'mine',
      label: 'Only my videos',
      hint: 'Hide every placeholder. The app shows your library and nothing else.',
    },
    {
      value: 'samples',
      label: 'Only samples',
      hint: 'Ignore what you added, for comparing against the original look.',
    },
  ]

  const showing =
    libraryMode === 'samples'
      ? `${sampleVideoCount} placeholder videos`
      : libraryMode === 'mine'
        ? `${customVideos.length} of your videos`
        : customVideos.length === 0
          ? `${sampleVideoCount} placeholder videos (nothing added yet)`
          : `${customVideos.length} of your videos`

  return (
    <section className="mt-6 rounded-xl border border-line p-4">
      <h2 className="text-[16px] font-semibold text-fg">What the app shows</h2>
      <p className="mt-1 text-[13px] text-fg2">
        Currently showing: <strong className="font-medium text-fg">{showing}</strong>
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:gap-3">
        {options.map((o) => {
          const active = o.value === libraryMode
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => setLibraryMode(o.value)}
              className={classNames(
                'flex-1 rounded-lg border px-3 py-2 text-left transition-colors',
                active
                  ? 'border-[#065fd4] bg-[#065fd4]/10'
                  : 'border-line hover:bg-chip',
              )}
            >
              <span className="flex items-center gap-2 text-[13px] font-medium text-fg">
                {active ? <CheckIcon size={16} /> : <span className="inline-block h-4 w-4" />}
                {o.label}
              </span>
              <span className="mt-0.5 block pl-6 text-[12px] leading-4 text-fg2">{o.hint}</span>
            </button>
          )
        })}
      </div>

      <p className="mt-3 flex items-start gap-2 text-[12px] leading-5 text-fg2">
        <AlertIcon size={16} className="mt-px shrink-0" />
        <span>
          Until the Supabase database is connected, this setting and your added videos live in
          <strong className="font-medium text-fg"> this browser only</strong>. On the iPad the app
          will still show the placeholders — not a bug, just the missing database.
        </span>
      </p>
    </section>
  )
}

function AddSingleVideo({
  categories,
  addVideo,
}: {
  categories: { id: string; name: string }[]
  addVideo: ReturnType<typeof useLibrary>['addVideo']
}) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [categoryId, setCategoryId] = useState('all')
  const [looking, setLooking] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const previewId = parseYouTubeId(url)

  async function lookup(id: string) {
    setLooking(true)
    setMessage(null)
    const info = await fetchOEmbed(id)
    setLooking(false)
    if (info) {
      setTitle((t) => t || info.title)
      setAuthorName((a) => a || info.authorName)
      setMessage({ kind: 'ok', text: 'Details filled in from YouTube. Check them, then add.' })
    } else {
      setMessage({
        kind: 'err',
        text: 'Could not read the title automatically. Type one in, or add it as-is.',
      })
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const result = addVideo({ url, title, authorName, categoryId })
    if (!result.ok) {
      setMessage({ kind: 'err', text: result.error ?? 'Could not add that video.' })
      return
    }
    setMessage({ kind: 'ok', text: `Added “${result.video?.title}”.` })
    setUrl('')
    setTitle('')
    setAuthorName('')
  }

  return (
    <section className="rounded-xl border border-line p-4">
      <h2 className="text-[16px] font-semibold text-fg">Add a video</h2>
      <p className="mt-1 text-[13px] text-fg2">Paste a YouTube link. Details are read automatically.</p>

      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-medium text-fg2">YouTube link</span>
          <div className="flex gap-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onBlur={() => {
                if (previewId && !title) void lookup(previewId)
              }}
              placeholder="https://www.youtube.com/watch?v=..."
              className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-search px-3 text-[14px] text-fg outline-none focus:border-[#1c62b9]"
            />
            <button
              type="button"
              disabled={!previewId || looking}
              onClick={() => previewId && lookup(previewId)}
              className="h-10 shrink-0 rounded-lg bg-chip px-3 text-[13px] font-medium text-fg hover:bg-chip-hover disabled:opacity-40"
            >
              {looking ? <SpinnerIcon size={18} className="animate-spin" /> : 'Fetch'}
            </button>
          </div>
        </label>

        {previewId ? (
          <div className="flex items-center gap-3 rounded-lg border border-line p-2">
            <img
              src={youTubeThumbnail(previewId, 'mq')}
              alt=""
              className="h-[45px] w-20 rounded object-cover"
            />
            <span className="text-[12px] text-fg2">Video {previewId}</span>
          </div>
        ) : null}

        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-medium text-fg2">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Video title"
            className="h-10 rounded-lg border border-line bg-search px-3 text-[14px] text-fg outline-none focus:border-[#1c62b9]"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-fg2">Channel</span>
            <input
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="My Channel"
              className="h-10 rounded-lg border border-line bg-search px-3 text-[14px] text-fg outline-none focus:border-[#1c62b9]"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-fg2">Category</span>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="h-10 rounded-lg border border-line bg-search px-3 text-[14px] text-fg outline-none focus:border-[#1c62b9]"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          type="submit"
          disabled={!previewId}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#065fd4] text-[14px] font-medium text-white hover:brightness-110 disabled:opacity-40"
        >
          <PlusIcon size={20} />
          Add to library
        </button>

        <StatusMessage message={message} />
      </form>
    </section>
  )
}

function BulkAdd({
  categories,
  addVideo,
}: {
  categories: { id: string; name: string }[]
  addVideo: ReturnType<typeof useLibrary>['addVideo']
}) {
  const [text, setText] = useState('')
  const [categoryId, setCategoryId] = useState('all')
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const lines = text
      .split(/[\n,\s]+/)
      .map((l) => l.trim())
      .filter(Boolean)

    if (lines.length === 0) {
      setMessage({ kind: 'err', text: 'Paste one or more links first.' })
      return
    }

    let added = 0
    let skipped = 0
    for (const line of lines) {
      if (!parseYouTubeId(line)) {
        skipped += 1
        continue
      }
      const result = addVideo({ url: line, categoryId, title: 'Untitled video' })
      if (result.ok) added += 1
      else skipped += 1
    }

    setMessage({
      kind: added > 0 ? 'ok' : 'err',
      text: `Added ${added} video${added === 1 ? '' : 's'}${
        skipped ? `, skipped ${skipped}` : ''
      }. Titles can be filled in with “Fetch” on each row below.`,
    })
    if (added > 0) setText('')
  }

  return (
    <section className="rounded-xl border border-line p-4">
      <h2 className="text-[16px] font-semibold text-fg">Bulk add</h2>
      <p className="mt-1 text-[13px] text-fg2">
        One link per line. Titles start as “Untitled video” — fetch them individually after.
      </p>
      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder={'https://youtu.be/...\nhttps://www.youtube.com/watch?v=...'}
          className="rounded-lg border border-line bg-search p-3 font-mono text-[13px] text-fg outline-none focus:border-[#1c62b9]"
        />
        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-medium text-fg2">Category for all</span>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="h-10 rounded-lg border border-line bg-search px-3 text-[14px] text-fg outline-none focus:border-[#1c62b9]"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="h-10 rounded-lg bg-[#065fd4] text-[14px] font-medium text-white hover:brightness-110"
        >
          Add all
        </button>
        <StatusMessage message={message} />
      </form>
    </section>
  )
}

/**
 * Real YouTube search needs a Data API key. Kept as a visible reminder that
 * the key is required before search can return non-library results.
 */
function YoutubeSearchKeyCard() {
  const [key, setKey] = useLocalStorage('jk.youtubeApiKey', '')
  return (
    <section className="mt-6 rounded-xl border border-line p-4">
      <h2 className="text-[16px] font-semibold text-fg">Search behaviour</h2>
      <p className="mt-1 text-[13px] leading-5 text-fg2">
        To make search return real YouTube results (filtered to what you allow), a YouTube Data
        API key is needed. Without one, search only covers this library — which is the easiest
        way for a curious viewer to notice.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="YouTube Data API key (optional)"
          className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-search px-3 text-[14px] text-fg outline-none focus:border-[#1c62b9]"
        />
        <button
          type="button"
          onClick={() => setKey('')}
          className="h-10 shrink-0 rounded-lg bg-chip px-3 text-[13px] font-medium text-fg hover:bg-chip-hover"
        >
          Clear
        </button>
      </div>
      <p className="mt-2 text-[12px] text-fg2">
        Not wired up yet — stored here ready for Phase 2.
      </p>
    </section>
  )
}

/* ----------------------------------------------------------------- library */

function MyLibrary({
  videos,
  onRemove,
  onReset,
  categories,
}: {
  videos: Video[]
  onRemove: (id: string) => void
  onReset: () => void
  categories: { id: string; name: string }[]
}) {
  const { updateVideo } = useLibrary()
  const [busyId, setBusyId] = useState<string | null>(null)

  const categoryName = (id?: string) =>
    categories.find((c) => c.id === id)?.name ?? 'Uncategorised'

  async function refetch(video: Video) {
    if (!video.youtubeId) return
    setBusyId(video.id)
    const info = await fetchOEmbed(video.youtubeId)
    setBusyId(null)
    if (info) updateVideo(video.id, { title: info.title })
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(videos, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'jkyoutube-library.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="mt-6 rounded-xl border border-line">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
        <h2 className="text-[16px] font-semibold text-fg">
          Added by you <span className="text-fg2">({videos.length})</span>
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportJson}
            disabled={videos.length === 0}
            className="rounded-lg bg-chip px-3 py-2 text-[13px] font-medium text-fg hover:bg-chip-hover disabled:opacity-40"
          >
            Export JSON
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Remove every video you have added?')) onReset()
            }}
            disabled={videos.length === 0}
            className="rounded-lg bg-chip px-3 py-2 text-[13px] font-medium text-[#ff4e45] hover:bg-chip-hover disabled:opacity-40"
          >
            Clear all
          </button>
        </div>
      </div>

      {videos.length === 0 ? (
        <p className="p-6 text-center text-[13px] text-fg2">
          Nothing added yet. The app is currently showing the built-in sample library.
        </p>
      ) : (
        <ul className="divide-y divide-[color:var(--yt-line)]">
          {videos.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center gap-3 p-3">
              <img
                src={v.thumbnailUrl}
                alt=""
                className="h-[45px] w-20 shrink-0 rounded object-cover"
              />
              <div className="min-w-0 flex-1">
                <input
                  value={v.title}
                  onChange={(e) => updateVideo(v.id, { title: e.target.value })}
                  className="w-full rounded border border-transparent bg-transparent px-1 py-1 text-[14px] font-medium text-fg outline-none hover:border-line focus:border-[#1c62b9] focus:bg-search"
                />
                <p className="truncate px-1 text-[12px] text-fg2">
                  {categoryName(v.categoryId)} · added {timeAgo(v.publishedAt)} ·{' '}
                  {v.youtubeId}
                </p>
              </div>
              <button
                type="button"
                onClick={() => refetch(v)}
                className="rounded-lg bg-chip px-3 py-1.5 text-[12px] font-medium text-fg hover:bg-chip-hover"
              >
                {busyId === v.id ? 'Fetching…' : 'Refetch title'}
              </button>
              <a
                href={`/watch/${v.id}`}
                className="rounded-lg bg-chip px-3 py-1.5 text-[12px] font-medium text-fg hover:bg-chip-hover"
              >
                Preview
              </a>
              <button
                type="button"
                aria-label="Remove"
                onClick={() => onRemove(v.id)}
                className="yt-icon-btn h-8 w-8 text-[#ff4e45]"
              >
                <CloseIcon size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function StatusMessage({ message }: { message: { kind: 'ok' | 'err'; text: string } | null }) {
  if (!message) return null
  return (
    <p
      className={classNames(
        'flex items-start gap-2 text-[13px] leading-5',
        message.kind === 'ok' ? 'text-[#2ba640]' : 'text-[#ff9d00]',
      )}
    >
      {message.kind === 'ok' ? (
        <CheckIcon size={18} className="mt-px shrink-0" />
      ) : (
        <AlertIcon size={18} className="mt-px shrink-0" />
      )}
      {message.text}
    </p>
  )
}
