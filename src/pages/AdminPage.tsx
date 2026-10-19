import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { fetchOEmbed, useLibrary } from '../store/library'
import type { LibraryMode } from '../store/library'
import { signIn, signOut } from '../lib/remote'
import {
  classNames,
  formatDuration,
  isBilibiliShortLink,
  parseBilibiliId,
  parseDurationInput,
  parseYouTubeId,
  timeAgo,
  youTubeThumbnail,
} from '../lib/format'
import { useLocalStorage } from '../lib/hooks'
import { supabase } from '../lib/supabase'
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

      <DiagnosticsCard />

      <StatsCard />

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

/* ------------------------------------------------------------------ stats -- */

interface VideoStat {
  video_id: string
  opens: number
  blocked_clicks: number
  viewers: number
  duration_seconds: number
  furthest_position: number
  watched_seconds: number
  first_seen: string
  last_seen: string
}

/**
 * What the telemetry has collected, grouped per video.
 *
 * Read through the video_stats view, which is security_invoker, so these rows
 * are only visible to a signed-in account — the same public key that records
 * events cannot read them back.
 */
function StatsCard() {
  const { signedInAs, getVideo } = useLibrary()
  const [rows, setRows] = useState<VideoStat[]>([])
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase) return
    setBusy(true)
    setError(null)
    try {
      const { data, error: queryError } = await supabase
        .from('video_stats')
        .select('*')
        .order('opens', { ascending: false })
        .limit(100)
      if (queryError) throw new Error(queryError.message)
      setRows((data ?? []) as VideoStat[])
      setLoaded(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      // PostgREST words this as "Could not find the table ... in the schema
      // cache", which my first attempt at this message failed to recognise.
      setError(
        /could not find|schema cache|does not exist|relation/i.test(message)
          ? 'Not set up yet. Run supabase/schema-events.sql in the Supabase SQL editor — that one file creates both the view_events table and the video_stats view this card reads.'
          : message,
      )
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    if (signedInAs) void load()
  }, [signedInAs, load])

  const totals = rows.reduce(
    (acc, r) => ({
      opens: acc.opens + Number(r.opens ?? 0),
      watched: acc.watched + Number(r.watched_seconds ?? 0),
      blocked: acc.blocked + Number(r.blocked_clicks ?? 0),
    }),
    { opens: 0, watched: 0, blocked: 0 },
  )

  if (!signedInAs) {
    return (
      <section className="mt-6 rounded-xl border border-line p-4">
        <h2 className="text-[16px] font-semibold text-fg">Watch statistics</h2>
        <p className="mt-1 text-[13px] text-fg2">
          Sign in to the database above to read the recorded events.
        </p>
      </section>
    )
  }

  return (
    <section className="mt-6 rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[16px] font-semibold text-fg">Watch statistics</h2>
        <button
          type="button"
          onClick={() => void load()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-chip px-3 py-2 text-[13px] font-medium text-fg hover:bg-chip-hover disabled:opacity-40"
        >
          {busy ? <SpinnerIcon size={16} className="animate-spin" /> : null}
          Refresh
        </button>
      </div>

      <p className="mt-1 text-[13px] leading-5 text-fg2">
        Opens: <strong className="font-medium text-fg">{totals.opens}</strong> · Total time on
        watch pages: <strong className="font-medium text-fg">{formatDuration(totals.watched)}</strong> ·
        Clicks stopped inside the player:{' '}
        <strong className="font-medium text-fg">{totals.blocked}</strong>
      </p>

      {error ? <p className="mt-2 text-[13px] leading-5 text-[#ff9d00]">{error}</p> : null}

      {loaded && rows.length === 0 ? (
        <p className="mt-3 text-[13px] text-fg2">Nothing recorded yet.</p>
      ) : null}

      {rows.length > 0 ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead className="text-fg2">
              <tr>
                <th className="py-1 pr-3 font-medium">Video</th>
                <th className="py-1 pr-3 font-medium">Opens</th>
                <th className="py-1 pr-3 font-medium">Viewers</th>
                <th className="py-1 pr-3 font-medium">Time watched</th>
                <th className="py-1 pr-3 font-medium">Furthest point</th>
                <th className="py-1 pr-3 font-medium">Blocked clicks</th>
                <th className="py-1 pr-3 font-medium">Last seen</th>
              </tr>
            </thead>
            <tbody className="text-fg">
              {rows.map((r) => {
                const video = getVideo(r.video_id)
                const length = Number(r.duration_seconds ?? 0)
                const furthest = Number(r.furthest_position ?? 0)
                return (
                  <tr key={r.video_id} className="border-t border-line">
                    <td className="max-w-[280px] py-1.5 pr-3">
                      <span className="yt-clamp-1 block">
                        {video?.title ?? r.video_id}
                      </span>
                    </td>
                    <td className="py-1.5 pr-3 tabular-nums">{r.opens}</td>
                    <td className="py-1.5 pr-3 tabular-nums">{r.viewers}</td>
                    <td className="py-1.5 pr-3 tabular-nums">
                      {formatDuration(Number(r.watched_seconds ?? 0))}
                    </td>
                    <td className="py-1.5 pr-3 tabular-nums">
                      {length > 0
                        ? `${formatDuration(furthest)} of ${formatDuration(length)}`
                        : furthest > 0
                          ? formatDuration(furthest)
                          : '—'}
                    </td>
                    <td className="py-1.5 pr-3 tabular-nums">{r.blocked_clicks}</td>
                    <td className="py-1.5 pr-3 text-fg2">{timeAgo(r.last_seen)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className="mt-3 text-[12px] leading-5 text-fg2">
        "Furthest point" comes from the YouTube player, which reports real playback positions.
        Bilibili's embed exposes no events, so for those videos the only measurable figure is time
        spent on the page. "Blocked clicks" counts clicks stopped by the shield over the player —
        they cannot be told apart from a viewer trying to pause, so treat it as interest, not
        proof of a link click.
      </p>
    </section>
  )
}

/* ------------------------------------------------------------ diagnostics -- */
interface DiagRow {
  label: string
  value: string
  verdict: 'ok' | 'bad' | 'info'
}

/**
 * Runs the checks that distinguish an Android WebView problem from a Bilibili
 * one, and can be copied to the clipboard. Built because the same embed works
 * in Safari and desktop Chrome but failed in the APK, and guessing had already
 * cost one wrong fix.
 */
function DiagnosticsCard() {
  const [rows, setRows] = useState<DiagRow[]>([])
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  async function run() {
    setBusy(true)
    setCopied(false)
    const out: DiagRow[] = []

    // Which shell are we running in?
    out.push({
      label: 'Platform',
      value: Capacitor.isNativePlatform() ? 'native shell (the APK)' : 'browser or installed PWA',
      verdict: 'info',
    })
    out.push({ label: 'User agent', value: navigator.userAgent, verdict: 'info' })

    // Confirms the user-agent override actually reached the WebView. A desktop
    // string means the APK is being served the same embedded Bilibili player as
    // Chrome and the iPad, rather than the mobile one.
    const ua = navigator.userAgent
    const wantsDesktop = Capacitor.isNativePlatform()
    const looksDesktop = !/Mobile/i.test(ua)
    if (wantsDesktop) {
      out.push({
        label: 'Desktop user agent applied',
        value: looksDesktop ? 'yes' : 'no — still falling back to the stock WebView agent',
        verdict: looksDesktop ? 'ok' : 'bad',
      })
    }

    out.push({
      label: 'navigator.cookieEnabled',
      value: String(navigator.cookieEnabled),
      verdict: navigator.cookieEnabled ? 'ok' : 'bad',
    })
    out.push({
      label: 'Third-party cookies usable in this WebView',
      value: typeof document.hasStorageAccess === 'function'
        ? 'storage access API present'
        : 'storage access API absent (cannot be probed further)',
      verdict: 'info',
    })

    // Can we reach Bilibili at all from this device?
    const reachable = await new Promise<boolean>((resolve) => {
      const img = new Image()
      const timer = window.setTimeout(() => resolve(false), 8000)
      img.onload = () => {
        window.clearTimeout(timer)
        resolve(true)
      }
      img.onerror = () => {
        window.clearTimeout(timer)
        // An error still proves the host answered.
        resolve(true)
      }
      img.src = `https://i0.hdslb.com/bfs/static/jinkela/long/images/favicon.ico?cb=${Date.now()}`
    })
    out.push({
      label: 'Bilibili CDN reachable',
      value: reachable ? 'yes' : 'no response in 8s',
      verdict: reachable ? 'ok' : 'bad',
    })

    // Which video codecs can this WebView actually decode?
    const codecs: Array<[string, string]> = [
      ['H.264', 'video/mp4; codecs="avc1.42E01E"'],
      ['HEVC / H.265', 'video/mp4; codecs="hvc1.1.6.L93.B0"'],
      ['AV1', 'video/mp4; codecs="av01.0.05M.08"'],
      ['VP9', 'video/webm; codecs="vp9"'],
    ]
    if (typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported) {
      const supported = codecs
        .filter(([, type]) => {
          try {
            return MediaSource.isTypeSupported(type)
          } catch {
            return false
          }
        })
        .map(([name]) => name)
      out.push({
        label: 'Decodable codecs',
        value: supported.length ? supported.join(', ') : 'none reported',
        verdict: supported.includes('H.264') ? 'ok' : 'bad',
      })
      out.push({
        label: 'MediaSource available',
        value: 'yes',
        verdict: 'ok',
      })
    } else {
      out.push({ label: 'MediaSource available', value: 'no', verdict: 'bad' })
    }

    setRows(out)
    setBusy(false)
  }

  async function copy() {
    const text = rows.map((r) => `${r.label}: ${r.value}`).join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-line p-4">
      <h2 className="text-[16px] font-semibold text-fg">Playback diagnostics</h2>
      <p className="mt-1 text-[13px] leading-5 text-fg2">
        Run this <strong className="font-medium text-fg">on the device that has the problem</strong>{' '}
        — the phone, not this PC — then press Copy and send the result. It reports the things that
        differ between an Android WebView and Safari, which is where the Bilibili failure lives.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-[#065fd4] px-4 py-2 text-[13px] font-medium text-white hover:brightness-110 disabled:opacity-40"
        >
          {busy ? <SpinnerIcon size={16} className="animate-spin" /> : null}
          Run diagnostics
        </button>
        {rows.length > 0 ? (
          <button
            type="button"
            onClick={copy}
            className="rounded-lg bg-chip px-4 py-2 text-[13px] font-medium text-fg hover:bg-chip-hover"
          >
            {copied ? 'Copied' : 'Copy results'}
          </button>
        ) : null}
      </div>

      {rows.length > 0 ? (
        <dl className="mt-4 space-y-2">
          {rows.map((r) => (
            <div key={r.label} className="flex flex-col gap-0.5 border-b border-line pb-2 last:border-0">
              <dt className="text-[12px] font-medium text-fg2">{r.label}</dt>
              <dd
                className={classNames(
                  'break-words text-[13px]',
                  r.verdict === 'ok' ? 'text-[#2ba640]' : r.verdict === 'bad' ? 'text-[#ff4e45]' : 'text-fg',
                )}
              >
                {r.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
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
          Read this before adding Bilibili videos
        </summary>
        <div className="mt-2 space-y-3 text-[12px] leading-5 text-fg2">
          <p>
            <strong className="text-fg">Bilibili actively restricts embedding.</strong> Its player
            checks which site opened it and refuses anything that is not a Bilibili page. That
            produces the message{' '}
            <em>“非常抱歉，视频无法播放”</em> — or its longer form listing 视频失效 / 内容不和谐 /
            UP主删除 / 侵权 — which is a generic notice, <strong className="text-fg">not</strong> a
            report that your video is broken.
          </p>

          <p>
            <strong className="text-fg">Check the video is embeddable first.</strong> On a
            computer, open the video on bilibili.com, click <span className="text-fg">分享</span>{' '}
            (Share), and look for an <span className="text-fg">嵌入代码</span> (embed code) tab. If
            that tab does not exist, the uploader has disabled external embedding and the video
            will <em>never</em> play here. Skip it.
          </p>

          <p>
            <strong className="text-fg">What cannot be embedded at all:</strong> member-only
            (大会员) videos, licensed shows and films, reposted clips, and private or
            followers-only videos.
          </p>

          <p>
            <strong className="text-fg">Expect some failures anyway.</strong> Even for a video with
            embed code, Bilibili's check is enforced unevenly — it can work one day and fail the
            next, and it is notably less reliable from outside mainland China. This is Bilibili's
            policy, not something this app can correct, and not something it should try to
            circumvent.
          </p>

          <p>
            <strong className="text-fg">YouTube does not have this problem.</strong> If you need
            dependable playback, prefer YouTube links.
          </p>

          <p>
            Also: Bilibili's API refuses browser requests (
            <span className="text-fg">HTTP 403</span>), so nothing can be filled in automatically
            — title, thumbnail, duration and views are all manual. There is no oEmbed endpoint
            either. And the player is Bilibili's own, embedded from{' '}
            <span className="text-fg">player.bilibili.com</span>, so its logo and controls are
            theirs and it will not look like YouTube's player. Scrolling bullet comments are
            switched off (<span className="text-fg">danmaku=0</span>). Autoplay-next does not fire,
            because the embed has no scripting API.
          </p>
        </div>
      </details>

      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-medium text-fg2">Bilibili link</span>
          <input
            value={url}
            onChange={(e) => {
              const next = e.target.value
              setUrl(next)
              // The Bilibili app's Share button produces text shaped like
              // "【video title】 https://b23.tv/xxxx". Pulling the title out of
              // that saves typing it, which is the main effort in adding one.
              const fromShare = next.match(/[【\[]([^】\]]{2,140})[】\]]/)
              if (fromShare && !title) setTitle(fromShare[1].trim())
            }}
            placeholder="Paste the link — or the whole Share text from the Bilibili app"
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
            That is a short b23.tv link, which cannot be resolved in a browser. Open it, then copy
            the full <span className="text-fg">bilibili.com/video/BV…</span> address. (If you
            pasted Share text, the title has still been filled in for you.)
          </p>
        ) : null}

        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-medium text-fg2">
            Title <span className="text-[#ff9d00]">(required — Bilibili will not give it to us)</span>
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Copy it from the Bilibili tab, or paste the Share text above"
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

        <details className="rounded-lg border border-line p-3">
          <summary className="cursor-pointer text-[13px] font-medium text-fg">
            Everything else is optional
          </summary>
          <p className="mt-2 text-[12px] leading-5 text-fg2">
            Skip these and the app prints no view line rather than a false “0 views • just now”,
            and draws a neat stand-in thumbnail instead of an empty box.
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
              <span className="text-[12px] font-medium text-fg2">Duration</span>
              <input
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="12:34 or 1:02:03"
                className="h-10 rounded-lg border border-line bg-search px-3 text-[14px] text-fg outline-none focus:border-[#1c62b9]"
              />
            </label>
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-[12px] font-medium text-fg2">
                Thumbnail URL{' '}
                <span className="text-fg2">
                  (the only way to get a real cover — see the note below)
                </span>
              </span>
              <input
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
                placeholder="On Bilibili: right-click the cover → Copy image address, then paste here"
                className="h-10 rounded-lg border border-line bg-search px-3 text-[14px] text-fg outline-none focus:border-[#1c62b9]"
              />
            </label>
            <p className="text-[12px] leading-5 text-fg2 sm:col-span-2">
              Bilibili's cover cannot be looked up automatically — its API refuses browser requests,
              it blocks datacentre addresses, and the image filename is a random hash that cannot be
              worked out from the video id. Paste the address here, or leave it blank and the app
              draws a neat stand-in card with the title on it.
            </p>
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-fg2">Views</span>
              <input
                value={views}
                onChange={(e) => setViews(e.target.value)}
                placeholder="125000"
                inputMode="numeric"
                className="h-10 rounded-lg border border-line bg-search px-3 text-[14px] text-fg outline-none focus:border-[#1c62b9]"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-fg2">Upload date</span>
              <input
                type="date"
                value={published}
                onChange={(e) => setPublished(e.target.value)}
                className="h-10 rounded-lg border border-line bg-search px-3 text-[14px] text-fg outline-none focus:border-[#1c62b9]"
              />
            </label>
          </div>
        </details>

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
        // Real figures have arrived, so the view line may now be shown.
        statsUnknown: false,
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
