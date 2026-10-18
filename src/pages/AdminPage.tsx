import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchOEmbed, useLibrary } from '../store/library'
import type { LibraryMode } from '../store/library'
import { signIn, signOut } from '../lib/remote'
import {
  classNames,
  isBilibiliShortLink,
  parseBilibiliId,
  parseDurationInput,
  parseYouTubeId,
  timeAgo,
  youTubeThumbnail,
} from '../lib/format'
import { useLocalStorage } from '../lib/hooks'
import {
  YouTubeApiError,
  fetchChannelMetadata,
  fetchVideoMetadata,
  verifyApiKey,
} from '../lib/youtube'
import { AlertIcon, CheckIcon, CloseIcon, PlusIcon, SpinnerIcon } from '../components/icons'
import type { Channel, Video } from '../types'

/**
 * The PC-side control panel.
 *
 * Not part of the viewer experience, so it deliberately looks like a tool
 * rather than like YouTube.
 *
 * NOTE: the passcode below is a *preview* gate only — there is no server yet
 * and everything is stored in this browser. Real per-user authentication
 * arrives with Supabase in Phase 3.
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
        Preview gate only. Until Supabase authentication is wired up, this password lives in
        the page source and data is stored in this browser.
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

/* ------------------------------------------------------------------ helpers */

interface EnrichResult {
  videos: Awaited<ReturnType<typeof fetchVideoMetadata>>
  channels: Awaited<ReturnType<typeof fetchChannelMetadata>>
}

/**
 * Copies real YouTube metadata using the Data API.
 *
 * Without a key we can only reach the public oEmbed endpoint, which supplies a
 * title and channel name and nothing else — hence view counts, likes,
 * subscriber counts and durations would all be wrong.
 */
function useEnrichment() {
  const [apiKey, setApiKeyState] = useLocalStorage('jk.youtubeApiKey', '')

  const enrich = useCallback(
    async (videoIds: string[]): Promise<EnrichResult | null> => {
      const key = apiKey.trim()
      if (!key || videoIds.length === 0) return null

      const videos = await fetchVideoMetadata(videoIds, key)
      const channelIds = [...new Set(videos.map((v) => v.channelId).filter(Boolean))]
      const channels = channelIds.length ? await fetchChannelMetadata(channelIds, key) : []
      return { videos, channels }
    },
    [apiKey],
  )

  return { apiKey, setApiKey: setApiKeyState, hasKey: apiKey.trim().length > 0, enrich }
}

function describeError(err: unknown): string {
  if (err instanceof YouTubeApiError) return err.message
  if (err instanceof Error) return `Could not reach YouTube: ${err.message}`
  return 'Something went wrong talking to YouTube.'
}

/* -------------------------------------------------------------- dashboard */

function AdminDashboard({ onSignOut }: { onSignOut: () => void }) {
  const { categories, customVideos, removeVideo, clearAllVideos, videos } = useLibrary()
  const [libraryUrl] = useState(() => window.location.origin)

  return (
    <div className="mx-auto max-w-[1000px] px-4 pb-24 pt-8 md:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold text-fg">Content manager</h1>
          <p className="mt-1 text-[13px] text-fg2">
            {videos.length} videos live · {customVideos.length} in the shared library
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

      <DatabaseCard />

      <PendingLocalCard />

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
        </div>
      </div>

      <ApiKeyCard />

      <LibraryContentsCard />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <AddSingleVideo categories={categories} />
        <AddBilibiliVideo categories={categories} />
        <BulkAdd categories={categories} />
      </div>

      <MyLibrary
        videos={customVideos}
        onRemove={removeVideo}
        onClearAll={clearAllVideos}
        categories={categories}
      />
    </div>
  )
}

/* --------------------------------------------------------- database/auth -- */

/**
 * Connection status plus admin sign-in.
 *
 * Writes are restricted by Row-Level Security to signed-in users, so this is
 * what actually protects the shared library — the passcode screen earlier is
 * only a convenience gate over the UI.
 */
function DatabaseCard() {
  const { status, error, reload, databaseEnabled, signedInAs, refreshAuth } = useLibrary()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await signIn(email.trim(), password)
      await refreshAuth()
      await reload()
    } catch (err) {
      setSignInError(err instanceof Error ? err.message : 'Sign-in failed.')
    } finally {
      setBusy(false)
    }
  }

  const [signInError, setSignInError] = useState<string | null>(null)

  if (!databaseEnabled) {
    return (
      <section className="mt-6 rounded-xl border border-line p-4">
        <h2 className="text-[16px] font-semibold text-fg">Shared database</h2>
        <p className="mt-1 text-[13px] text-fg2">
          Not configured. Videos are stored in this browser only.
        </p>
      </section>
    )
  }

  return (
    <section className="mt-6 rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[16px] font-semibold text-fg">Shared database</h2>
        <span
          className={classNames(
            'rounded-full px-2 py-0.5 text-[11px] font-medium',
            signedInAs
              ? 'bg-[#2ba640]/15 text-[#2ba640]'
              : status === 'error'
                ? 'bg-[#ff4e45]/15 text-[#ff4e45]'
                : 'bg-[#ff9d00]/15 text-[#ff9d00]',
          )}
        >
          {signedInAs ? `Signed in as ${signedInAs}` : status === 'error' ? 'Not connected' : 'Read only'}
        </span>
      </div>

      {status === 'error' && error ? (
        <p className="mt-2 text-[13px] leading-5 text-[#ff4e45]">{error}</p>
      ) : null}

      {signedInAs ? (
        <>
          <p className="mt-1 text-[13px] leading-5 text-fg2">
            Anything you add is saved to the shared database, so the PC, the iPad and the
            Android app all show the same library.
          </p>
          <button
            type="button"
            onClick={async () => {
              await signOut()
              await refreshAuth()
            }}
            className="mt-3 rounded-lg bg-chip px-3 py-2 text-[13px] font-medium text-fg hover:bg-chip-hover"
          >
            Sign out of the database
          </button>
        </>
      ) : (
        <>
          <p className="mt-1 text-[13px] leading-5 text-fg2">
            <strong className="font-medium text-fg">Sign in to add or change videos.</strong> The
            public key shipped in the app can only read; the database itself refuses writes from
            anyone not signed in. Use the account you created in Supabase →{' '}
            <span className="text-fg">Authentication → Users</span>.
          </p>
          <form onSubmit={submit} className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setSignInError(null)
              }}
              placeholder="you@example.com"
              autoComplete="username"
              className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-search px-3 text-[14px] text-fg outline-none focus:border-[#1c62b9]"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setSignInError(null)
              }}
              placeholder="Password"
              autoComplete="current-password"
              className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-search px-3 text-[14px] text-fg outline-none focus:border-[#1c62b9]"
            />
            <button
              type="submit"
              disabled={busy || !email || !password}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#065fd4] px-4 text-[13px] font-medium text-white hover:brightness-110 disabled:opacity-40"
            >
              {busy ? <SpinnerIcon size={16} className="animate-spin" /> : null}
              Sign in
            </button>
          </form>
          {signInError ? (
            <p className="mt-2 text-[13px] text-[#ff4e45]">{signInError}</p>
          ) : null}
        </>
      )}
    </section>
  )
}

/** Offers to move videos that were added before the database existed. */
function PendingLocalCard() {
  const { pendingLocalVideos, migrateLocalVideos, signedInAs } = useLibrary()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  if (pendingLocalVideos.length === 0) return null

  async function migrate() {
    setBusy(true)
    setMessage(null)
    try {
      const { uploaded } = await migrateLocalVideos()
      setMessage({ kind: 'ok', text: `Moved ${uploaded} video${uploaded === 1 ? '' : 's'} into the shared database.` })
    } catch (err) {
      setMessage({ kind: 'err', text: err instanceof Error ? err.message : 'Could not move them.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-[#ff9d00]/40 p-4">
      <h2 className="text-[16px] font-semibold text-fg">
        {pendingLocalVideos.length} video{pendingLocalVideos.length === 1 ? '' : 's'} still only in
        this browser
      </h2>
      <p className="mt-1 text-[13px] leading-5 text-fg2">
        These were added before the shared database existed. They are visible here but not on the
        iPad or the phone. Move them up so every device sees them.
      </p>
      <button
        type="button"
        onClick={migrate}
        disabled={busy || !signedInAs}
        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#065fd4] px-4 py-2 text-[13px] font-medium text-white hover:brightness-110 disabled:opacity-40"
      >
        {busy ? <SpinnerIcon size={16} className="animate-spin" /> : null}
        Move to the shared database
      </button>
      {!signedInAs ? (
        <p className="mt-2 text-[12px] text-fg2">Sign in above first.</p>
      ) : null}
      <StatusMessage message={message} />
    </section>
  )
}

/* ------------------------------------------------------------- API key ---- */

function ApiKeyCard() {
  const { apiKey, setApiKey, hasKey } = useEnrichment()
  const [draft, setDraft] = useState(apiKey)
  const [status, setStatus] = useState<{ kind: 'ok' | 'err' | 'busy'; text: string } | null>(null)

  async function test(key: string) {
    if (!key.trim()) {
      setStatus({ kind: 'err', text: 'Paste a key first.' })
      return
    }
    setStatus({ kind: 'busy', text: 'Checking the key with Google…' })
    try {
      await verifyApiKey(key.trim())
      setApiKey(key.trim())
      setStatus({ kind: 'ok', text: 'Key works. Real view counts, likes, subscribers, durations and upload dates will now be copied.' })
    } catch (err) {
      setStatus({ kind: 'err', text: describeError(err) })
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[16px] font-semibold text-fg">YouTube Data API key</h2>
        <span
          className={classNames(
            'rounded-full px-2 py-0.5 text-[11px] font-medium',
            hasKey ? 'bg-[#2ba640]/15 text-[#2ba640]' : 'bg-[#ff9d00]/15 text-[#ff9d00]',
          )}
        >
          {hasKey ? 'Connected' : 'Not set'}
        </span>
      </div>

      <p className="mt-1 text-[13px] leading-5 text-fg2">
        <strong className="font-medium text-fg">This is what makes added videos look real.</strong>{' '}
        Without it we can only read a title and channel name, so view counts, likes, subscriber
        counts, durations and upload dates would all be wrong. With it, every field is copied
        from YouTube itself. Free — lookups cost 1 unit each against a 10,000/day allowance.
      </p>

      <details className="mt-3 rounded-lg border border-line p-3">
        <summary className="cursor-pointer text-[13px] font-medium text-fg">
          How to get a key (2 minutes)
        </summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-[12px] leading-5 text-fg2">
          <li>
            Go to <span className="text-fg">console.cloud.google.com</span> and create a project.
          </li>
          <li>
            <span className="text-fg">APIs &amp; Services → Library</span>, search for{' '}
            <span className="text-fg">YouTube Data API v3</span>, and click Enable.
          </li>
          <li>
            <span className="text-fg">APIs &amp; Services → Credentials → Create credentials →
            API key</span>.
          </li>
          <li>
            Copy it and paste it below. Then click <span className="text-fg">Restrict key</span>{' '}
            and, under <span className="text-fg">API restrictions</span>, allow only YouTube Data
            API v3.
          </li>
          <li>
            Under <span className="text-fg">Application restrictions</span> choose{' '}
            <span className="text-fg">Websites</span> and add your Render address (for example
            <code className="mx-1 rounded bg-chip px-1">https://jkyoutube.onrender.com/*</code>
            plus <code className="mx-1 rounded bg-chip px-1">http://localhost:*</code>). This
            matters because the key travels in the page, so anyone who opens the app could
            otherwise use it.
          </li>
        </ol>
      </details>

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          type="password"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            setStatus(null)
          }}
          placeholder="AIza…"
          className="h-10 min-w-[240px] flex-1 rounded-lg border border-line bg-search px-3 text-[14px] text-fg outline-none focus:border-[#1c62b9]"
        />
        <button
          type="button"
          onClick={() => test(draft)}
          className="h-10 rounded-lg bg-[#065fd4] px-4 text-[13px] font-medium text-white hover:brightness-110"
        >
          Save &amp; test
        </button>
        {hasKey ? (
          <button
            type="button"
            onClick={() => {
              setApiKey('')
              setDraft('')
              setStatus({ kind: 'err', text: 'Key removed. Metadata copying is off.' })
            }}
            className="h-10 rounded-lg bg-chip px-4 text-[13px] font-medium text-fg hover:bg-chip-hover"
          >
            Remove
          </button>
        ) : null}
      </div>

      <StatusMessage message={status} />
    </section>
  )
}

/**
 * Controls whether the bundled placeholder library is shown.
 *
 * The placeholders are hardcoded, so without a control here the app could never
 * show *only* your own content.
 */
function LibraryContentsCard() {
  const { libraryMode, setLibraryMode, sampleVideoCount, customVideos } = useLibrary()

  const options: Array<{ value: LibraryMode; label: string; hint: string }> = [
    { value: 'auto', label: 'Auto', hint: 'Placeholders show only until you add your first video.' },
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
                active ? 'border-[#065fd4] bg-[#065fd4]/10' : 'border-line hover:bg-chip',
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
          Until Supabase is connected, this setting and your added videos live in
          <strong className="font-medium text-fg"> this browser only</strong>. On the iPad the app
          will still show the placeholders — not a bug, just the missing database.
        </span>
      </p>
    </section>
  )
}

/* ------------------------------------------------------------------ adding */

function AddSingleVideo({ categories }: { categories: { id: string; name: string }[] }) {
  const { addVideo } = useLibrary()
  const { hasKey, enrich } = useEnrichment()

  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [categoryId, setCategoryId] = useState('all')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const previewId = parseYouTubeId(url)

  async function lookup(id: string) {
    setBusy(true)
    setMessage(null)
    try {
      if (hasKey) {
        const result = await enrich([id])
        const meta = result?.videos[0]
        if (meta) {
          setTitle(meta.title)
          setAuthorName(meta.channelTitle)
          setMessage({
            kind: 'ok',
            text: `Copied from YouTube: title, channel, description, duration, upload date and ${meta.viewCount.toLocaleString()} views.`,
          })
          return
        }
        setMessage({
          kind: 'err',
          text: 'YouTube returned no data for that id. Check the link — the video may be private or deleted.',
        })
        return
      }

      const info = await fetchOEmbed(id)
      if (info) {
        setTitle((t) => t || info.title)
        setAuthorName((a) => a || info.authorName)
        setMessage({
          kind: 'err',
          text: 'Only the title and channel name could be copied. Without an API key, views, likes, subscribers, duration and the upload date stay missing.',
        })
      } else {
        setMessage({ kind: 'err', text: 'Could not read that video. Type a title in manually.' })
      }
    } catch (err) {
      setMessage({ kind: 'err', text: describeError(err) })
    } finally {
      setBusy(false)
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!previewId) {
      setMessage({ kind: 'err', text: 'That does not look like a YouTube link.' })
      return
    }

    setBusy(true)
    setMessage(null)
    try {
      // Always enrich on add, even if Fetch was never pressed. One request
      // returns the video and its channel together.
      const result = hasKey ? await enrich([previewId]) : null
      const meta = result?.videos[0]
      const chan = result?.channels.find((c) => c.id === meta?.channelId)

      const added = await addVideo({
        url,
        title: meta?.title || title,
        description: meta?.description,
        authorName: meta?.channelTitle || authorName,
        categoryId,
        durationSeconds: meta?.durationSeconds,
        youtubeChannelId: meta?.channelId,
        channelAvatarUrl: chan?.avatarUrl,
        subscriberCount: chan?.subscriberCount,
        handle: chan?.handle,
        viewCount: meta?.viewCount,
        likeCount: meta?.likeCount,
        publishedAt: meta?.publishedAt,
        thumbnailUrl: meta?.thumbnailUrl,
        isLive: meta?.isLive,
      })

      if (!added.ok) {
        setMessage({ kind: 'err', text: added.error ?? 'Could not add that video.' })
        return
      }

      setMessage({
        kind: added.savedToDatabase ? 'ok' : 'err',
        text: added.savedToDatabase
          ? `Added “${added.video?.title}” to the shared library. It will appear on the iPad and the phone.`
          : `Added “${added.video?.title}”, but only in THIS browser — you are not signed in to the database, so other devices will not see it.`,
      })
      setUrl('')
      setTitle('')
      setAuthorName('')
    } catch (err) {
      setMessage({ kind: 'err', text: describeError(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-line p-4">
      <h2 className="text-[16px] font-semibold text-fg">Add a YouTube video</h2>
      <p className="mt-1 text-[13px] text-fg2">
        Paste a YouTube link. All the details are copied automatically.
      </p>

      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-medium text-fg2">YouTube link</span>
          <div className="flex gap-2">
            <input
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
              }}
              onBlur={() => {
                if (previewId && !title) void lookup(previewId)
              }}
              placeholder="https://www.youtube.com/watch?v=..."
              className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-search px-3 text-[14px] text-fg outline-none focus:border-[#1c62b9]"
            />
            <button
              type="button"
              disabled={!previewId || busy}
              onClick={() => previewId && lookup(previewId)}
              className="h-10 shrink-0 rounded-lg bg-chip px-3 text-[13px] font-medium text-fg hover:bg-chip-hover disabled:opacity-40"
            >
              {busy ? <SpinnerIcon size={18} className="animate-spin" /> : 'Fetch'}
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
          disabled={!previewId || busy}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#065fd4] text-[14px] font-medium text-white hover:brightness-110 disabled:opacity-40"
        >
          {busy ? <SpinnerIcon size={18} className="animate-spin" /> : <PlusIcon size={20} />}
          Add to library
        </button>

        <StatusMessage message={message} />
      </form>
    </section>
  )
}

function AddBilibiliVideo({ categories }: { categories: { id: string; name: string }[] }) {
  const { addVideo } = useLibrary()
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [categoryId, setCategoryId] = useState('all')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [duration, setDuration] = useState('')
  const [views, setViews] = useState('')
  const [published, setPublished] = useState('')
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const ref = parseBilibiliId(url)
  const shortLink = isBilibiliShortLink(url)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!ref) {
      setMessage({
        kind: 'err',
        text: shortLink
          ? 'Short b23.tv links cannot be read. Open the link, then copy the full bilibili.com/video/BV… address.'
          : 'Paste a Bilibili link such as https://www.bilibili.com/video/BV1GJ411x7h7',
      })
      return
    }
    if (!title.trim()) {
      setMessage({
        kind: 'err',
        text: 'A title is required for Bilibili videos — their API blocks browsers, so it cannot be read automatically.',
      })
      return
    }

    const viewCount = views.trim() ? Number(views.replace(/[^0-9]/g, '')) : undefined
    const publishedAt = published ? new Date(`${published}T12:00:00`).toISOString() : undefined

    const result = await addVideo({
      url,
      title,
      authorName,
      categoryId,
      thumbnailUrl: thumbnailUrl.trim(),
      durationSeconds: parseDurationInput(duration),
      ...(viewCount !== undefined && Number.isFinite(viewCount) ? { viewCount } : {}),
      ...(publishedAt ? { publishedAt } : {}),
    })

    if (!result.ok) {
      setMessage({ kind: 'err', text: result.error ?? 'Could not add that video.' })
      return
    }

    setMessage({
      kind: result.savedToDatabase ? 'ok' : 'err',
      text: `${result.savedToDatabase ? 'Added to the shared library' : 'Added in THIS browser only (not signed in)'}: “${result.video?.title}”.${
        thumbnailUrl ? '' : ' A placeholder thumbnail was generated — paste an image URL to replace it.'
      }`,
    })
    setUrl('')
    setTitle('')
    setAuthorName('')
    setThumbnailUrl('')
    setDuration('')
    setViews('')
    setPublished('')
  }

  return (
    <section className="rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[16px] font-semibold text-fg">Add a Bilibili video</h2>
        <span className="rounded-full bg-chip px-2 py-0.5 text-[11px] font-medium text-fg2">
          manual details
        </span>
      </div>

      <p className="mt-1 text-[13px] leading-5 text-fg2">
        Plays in an embedded Bilibili player. Everything else — title, thumbnail, duration — has
        to be typed in, because Bilibili's API rejects browser requests.
      </p>

      <details className="mt-3 rounded-lg border border-line p-3">
        <summary className="cursor-pointer text-[13px] font-medium text-fg">
          Why is this different from YouTube?
        </summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[12px] leading-5 text-fg2">
          <li>
            Bilibili's API returns <span className="text-fg">HTTP 403 with no CORS headers</span>,
            so a browser cannot read titles, thumbnails or view counts. There is no oEmbed
            endpoint either.
          </li>
          <li>
            The player is Bilibili's own, embedded from{' '}
            <span className="text-fg">player.bilibili.com</span>. Its logo and controls are
            theirs, so it will not look like YouTube's player.
          </li>
          <li>
            Scrolling bullet comments are switched off (
            <span className="text-fg">danmaku=0</span>), which removes the biggest visual
            difference.
          </li>
          <li>Autoplay-next does not trigger for Bilibili videos; there is no scripting API.</li>
        </ul>
      </details>

      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-medium text-fg2">Bilibili link</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.bilibili.com/video/BV1GJ411x7h7"
            className="h-10 rounded-lg border border-line bg-search px-3 text-[14px] text-fg outline-none focus:border-[#1c62b9]"
          />
        </label>

        {ref ? (
          <p className="text-[12px] text-[#2ba640]">
            Recognised {ref.kind === 'bvid' ? `BV id ${ref.value}` : `av id ${ref.value}`}
            {ref.page > 1 ? `, part ${ref.page}` : ''}
          </p>
        ) : url && shortLink ? (
          <p className="text-[12px] text-[#ff9d00]">
            Short b23.tv links cannot be resolved in the browser. Open it, then copy the full
            bilibili.com address.
          </p>
        ) : null}

        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-medium text-fg2">Title (required)</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What the video is called"
            className="h-10 rounded-lg border border-line bg-search px-3 text-[14px] text-fg outline-none focus:border-[#1c62b9]"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-fg2">Channel</span>
            <input
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="Uploader name"
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

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-fg2">Duration (optional)</span>
            <input
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="12:34 or 1:02:03"
              className="h-10 rounded-lg border border-line bg-search px-3 text-[14px] text-fg outline-none focus:border-[#1c62b9]"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-fg2">Thumbnail URL (optional)</span>
            <input
              value={thumbnailUrl}
              onChange={(e) => setThumbnailUrl(e.target.value)}
              placeholder="https://i0.hdslb.com/…"
              className="h-10 rounded-lg border border-line bg-search px-3 text-[14px] text-fg outline-none focus:border-[#1c62b9]"
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-fg2">Views (optional)</span>
            <input
              value={views}
              onChange={(e) => setViews(e.target.value)}
              placeholder="125000"
              inputMode="numeric"
              className="h-10 rounded-lg border border-line bg-search px-3 text-[14px] text-fg outline-none focus:border-[#1c62b9]"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-fg2">Upload date (optional)</span>
            <input
              type="date"
              value={published}
              onChange={(e) => setPublished(e.target.value)}
              className="h-10 rounded-lg border border-line bg-search px-3 text-[14px] text-fg outline-none focus:border-[#1c62b9]"
            />
          </label>
        </div>

        <p className="text-[12px] leading-5 text-fg2">
          Leave views and the date blank and the app prints no view line at all, rather than a
          false “0 views • just now”.
        </p>

        <p className="text-[12px] leading-5 text-fg2">
          For the thumbnail: open the video on Bilibili, right-click the image, and choose
          <span className="text-fg"> Copy image address</span>. Leave it blank and a tidy stand-in
          card is generated instead.
        </p>

        <button
          type="submit"
          disabled={!ref}
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

function BulkAdd({ categories }: { categories: { id: string; name: string }[] }) {
  const { addVideo } = useLibrary()
  const { hasKey, enrich } = useEnrichment()

  const [text, setText] = useState('')
  const [categoryId, setCategoryId] = useState('all')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const lines = text
      .split(/[\n,\s]+/)
      .map((l) => l.trim())
      .filter(Boolean)

    // Split the pasted lines by which service they belong to.
    const youtubeIds: string[] = []
    const bilibiliUrls: string[] = []
    const unusable: string[] = []

    for (const line of lines) {
      if (isBilibiliShortLink(line)) {
        unusable.push(line)
        continue
      }
      const yt = parseYouTubeId(line)
      if (yt) {
        youtubeIds.push(yt)
        continue
      }
      if (parseBilibiliId(line)) {
        bilibiliUrls.push(line)
        continue
      }
      unusable.push(line)
    }

    if (youtubeIds.length === 0 && bilibiliUrls.length === 0) {
      setMessage({
        kind: 'err',
        text: 'No valid YouTube or Bilibili links found. Note that short b23.tv links cannot be read.',
      })
      return
    }

    setBusy(true)
    setMessage(null)
    try {
      const metaById = new Map<string, Awaited<ReturnType<typeof fetchVideoMetadata>>[number]>()
      const channelById = new Map<
        string,
        Awaited<ReturnType<typeof fetchChannelMetadata>>[number]
      >()

      if (hasKey && youtubeIds.length) {
        const result = await enrich(youtubeIds)
        for (const v of result?.videos ?? []) metaById.set(v.id, v)
        for (const c of result?.channels ?? []) channelById.set(c.id, c)
      }

      let added = 0
      let skipped = 0
      let savedToDatabase = 0

      for (const id of youtubeIds) {
        const meta = metaById.get(id)
        const chan = meta ? channelById.get(meta.channelId) : undefined
        const result = await addVideo({
          url: `https://www.youtube.com/watch?v=${id}`,
          title: meta?.title ?? 'Untitled video',
          description: meta?.description,
          authorName: meta?.channelTitle,
          categoryId,
          durationSeconds: meta?.durationSeconds,
          youtubeChannelId: meta?.channelId,
          channelAvatarUrl: chan?.avatarUrl,
          subscriberCount: chan?.subscriberCount,
          handle: chan?.handle,
          viewCount: meta?.viewCount,
          likeCount: meta?.likeCount,
          publishedAt: meta?.publishedAt,
          thumbnailUrl: meta?.thumbnailUrl,
          isLive: meta?.isLive,
        })
        if (result.ok) {
          added += 1
          if (result.savedToDatabase) savedToDatabase += 1
        } else {
          skipped += 1
        }
      }

      // Bilibili entries cannot be enriched, so they start untitled and get a
      // generated thumbnail. Rename them in the list below.
      for (const url of bilibiliUrls) {
        const result = await addVideo({ url, authorName: '', categoryId })
        if (result.ok) {
          added += 1
          if (result.savedToDatabase) savedToDatabase += 1
        } else {
          skipped += 1
        }
      }

      const parts = [`Added ${added} video${added === 1 ? '' : 's'}`]
      if (skipped) parts.push(`skipped ${skipped}`)
      if (bilibiliUrls.length) {
        parts.push(
          `${bilibiliUrls.length} Bilibili entr${bilibiliUrls.length === 1 ? 'y needs' : 'ies need'} a title and thumbnail typed in`,
        )
      }
      if (!hasKey && youtubeIds.length) {
        parts.push('no API key, so YouTube details are missing until you add one and refresh')
      }
      if (unusable.length) parts.push(`${unusable.length} line(s) ignored`)

      const where =
        added > 0 && savedToDatabase === added
          ? ' Saved to the shared library — visible on every device.'
          : added > 0
            ? ' NOT signed in to the database, so these are in this browser only.'
            : ''

      setMessage({ kind: added > 0 ? 'ok' : 'err', text: `${parts.join(' · ')}.${where}` })
      if (added > 0) setText('')
    } catch (err) {
      setMessage({ kind: 'err', text: describeError(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-line p-4">
      <h2 className="text-[16px] font-semibold text-fg">Bulk add</h2>
      <p className="mt-1 text-[13px] text-fg2">
        One link per line. All details are copied in a single YouTube request.
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
          disabled={busy}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#065fd4] text-[14px] font-medium text-white hover:brightness-110 disabled:opacity-40"
        >
          {busy ? <SpinnerIcon size={18} className="animate-spin" /> : null}
          Add all
        </button>
        <StatusMessage message={message} />
      </form>
    </section>
  )
}

/* ----------------------------------------------------------------- library */

function MyLibrary({
  videos,
  onRemove,
  onClearAll,
  categories,
}: {
  videos: Video[]
  onRemove: (id: string) => Promise<void>
  onClearAll: () => Promise<void>
  categories: { id: string; name: string }[]
}) {
  const { updateVideo, updateChannel, getChannel } = useLibrary()
  const { hasKey, enrich } = useEnrichment()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [refreshBusy, setRefreshBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const categoryName = (id?: string) =>
    categories.find((c) => c.id === id)?.name ?? 'Uncategorised'

  /** Applies fetched metadata onto one video (and its channel). */
  const applyMeta = useCallback(
    (
      id: string,
      meta: Awaited<ReturnType<typeof fetchVideoMetadata>>[number],
      channelMap: Map<string, Awaited<ReturnType<typeof fetchChannelMetadata>>[number]>,
    ) => {
      updateVideo(id, {
        title: meta.title,
        description: meta.description,
        durationSeconds: meta.durationSeconds,
        viewCount: meta.viewCount,
        likeCount: meta.likeCount,
        publishedAt: meta.publishedAt,
        thumbnailUrl: meta.thumbnailUrl,
        isLive: meta.isLive,
      })
      const ch = channelMap.get(meta.channelId)
      if (ch) {
        updateChannel(`ch-yt-${ch.id}`, {
          name: ch.title,
          handle: ch.handle,
          avatarUrl: ch.avatarUrl,
          subscriberCount: ch.subscriberCount,
        })
      }
    },
    [updateVideo, updateChannel],
  )

  async function refreshOne(video: Video) {
    if (!video.youtubeId) return
    if (!hasKey) {
      setMessage({ kind: 'err', text: 'Add a YouTube API key above first.' })
      return
    }
    setBusyId(video.id)
    setMessage(null)
    try {
      const result = await enrich([video.youtubeId])
      const meta = result?.videos[0]
      if (!meta) {
        setMessage({ kind: 'err', text: 'YouTube had no data for that video.' })
        return
      }
      applyMeta(video.id, meta, new Map((result?.channels ?? []).map((c) => [c.id, c])))
      setMessage({ kind: 'ok', text: `Refreshed “${meta.title}”.` })
    } catch (err) {
      setMessage({ kind: 'err', text: describeError(err) })
    } finally {
      setBusyId(null)
    }
  }

  async function refreshAll() {
    const ids = videos.map((v) => v.youtubeId).filter((v): v is string => Boolean(v))
    if (ids.length === 0) return
    if (!hasKey) {
      setMessage({ kind: 'err', text: 'Add a YouTube API key above first.' })
      return
    }
    setRefreshBusy(true)
    setMessage(null)
    try {
      const result = await enrich(ids)
      const channelMap = new Map((result?.channels ?? []).map((c) => [c.id, c]))
      let count = 0
      for (const meta of result?.videos ?? []) {
        const match = videos.find((v) => v.youtubeId === meta.id)
        if (match) {
          applyMeta(match.id, meta, channelMap)
          count += 1
        }
      }
      setMessage({
        kind: 'ok',
        text: `Refreshed ${count} video${count === 1 ? '' : 's'} — view counts, likes, subscribers and dates are now current.`,
      })
    } catch (err) {
      setMessage({ kind: 'err', text: describeError(err) })
    } finally {
      setRefreshBusy(false)
    }
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
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={refreshAll}
            disabled={videos.length === 0 || refreshBusy}
            className="inline-flex items-center gap-2 rounded-lg bg-[#065fd4] px-3 py-2 text-[13px] font-medium text-white hover:brightness-110 disabled:opacity-40"
          >
            {refreshBusy ? <SpinnerIcon size={16} className="animate-spin" /> : null}
            Refresh all from YouTube
          </button>
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
              if (window.confirm('Remove every video from the shared library? This affects all devices.')) {
                void onClearAll()
              }
            }}
            disabled={videos.length === 0}
            className="rounded-lg bg-chip px-3 py-2 text-[13px] font-medium text-[#ff4e45] hover:bg-chip-hover disabled:opacity-40"
          >
            Clear all
          </button>
        </div>
      </div>

      <div className="px-4 pt-3">
        <StatusMessage message={message} />
      </div>

      {videos.length === 0 ? (
        <p className="p-6 text-center text-[13px] text-fg2">
          Nothing added yet. The app is currently showing the built-in sample library.
        </p>
      ) : (
        <ul className="divide-y divide-[color:var(--yt-line)]">
          {videos.map((v) => {
            const channel = getChannel(v.channelId)
            return (
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
                    <span
                      className={classNames(
                        'mr-1 rounded px-1 py-px text-[10px] font-medium uppercase',
                        v.sourceType === 'bilibili'
                          ? 'bg-[#fb7299]/20 text-[#fb7299]'
                          : 'bg-[#ff0000]/15 text-[#ff0000]',
                      )}
                    >
                      {v.sourceType}
                    </span>
                    {channel?.name ?? 'Unknown channel'}
                    {typeof channel?.subscriberCount === 'number'
                      ? ` · ${channel.subscriberCount.toLocaleString()} subscribers`
                      : ''}
                    {' · '}
                    {v.viewCount.toLocaleString()} views
                    {' · '}
                    {categoryName(v.categoryId)}
                    {' · '}
                    {v.durationSeconds > 0 ? `${v.durationSeconds}s` : 'no duration'}
                    {v.thumbnailIsGenerated ? ' · placeholder thumbnail' : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => refreshOne(v)}
                  disabled={busyId === v.id}
                  className="inline-flex items-center gap-2 rounded-lg bg-chip px-3 py-1.5 text-[12px] font-medium text-fg hover:bg-chip-hover disabled:opacity-40"
                >
                  {busyId === v.id ? <SpinnerIcon size={14} className="animate-spin" /> : null}
                  Refresh
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
            )
          })}
        </ul>
      )}
    </section>
  )
}

function StatusMessage({
  message,
}: {
  message: { kind: 'ok' | 'err' | 'busy'; text: string } | null
}) {
  if (!message) return null
  const colour =
    message.kind === 'ok' ? 'text-[#2ba640]' : message.kind === 'err' ? 'text-[#ff9d00]' : 'text-fg2'
  return (
    <p className={classNames('mt-3 flex items-start gap-2 text-[13px] leading-5', colour)}>
      {message.kind === 'ok' ? (
        <CheckIcon size={18} className="mt-px shrink-0" />
      ) : message.kind === 'busy' ? (
        <SpinnerIcon size={18} className="mt-px shrink-0 animate-spin" />
      ) : (
        <AlertIcon size={18} className="mt-px shrink-0" />
      )}
      {message.text}
    </p>
  )
}
