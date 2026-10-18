import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  categories as allCategories,
  channels as seedChannels,
  playlists as seedPlaylists,
  videos as seedVideos,
} from '../data/mock'
import { useLocalStorage } from '../lib/hooks'
import { bilibiliPlaceholderThumbnail, bilibiliVideoId, bilibiliWatchUrl } from '../lib/bilibili'
import {
  isBilibiliShortLink,
  parseBilibiliId,
  parseYouTubeId,
  youTubeThumbnail,
} from '../lib/format'
import type { BilibiliRef } from '../lib/format'
import {
  deleteAllUserVideos,
  deleteVideoRow,
  fetchLibrary,
  fetchSetting,
  getSessionEmail,
  patchVideoRow,
  saveSetting,
  supabaseConfigured,
  upsertChannels,
  upsertVideos,
} from '../lib/remote'
import type { Category, Channel, Playlist, Video } from '../types'

/**
 * Single seam between the UI and its data.
 *
 * The shared library (videos and channels) now lives in Supabase, so the PC,
 * the iPad and the Android APK all see the same content.
 *
 * Per-viewer state stays in this browser on purpose: watch history, likes and
 * "watch later" are personal to a device until real user accounts exist.
 *
 * Anything added while signed out is kept in localStorage and shown alongside
 * the shared library, so nothing is ever silently lost — the admin screen
 * offers to move it up to the database.
 */

export type Reaction = 'like' | 'dislike' | null

export type LibraryMode = 'auto' | 'mine' | 'samples'

export type LibraryStatus = 'loading' | 'ready' | 'error'

export interface NewVideoInput {
  url: string
  title?: string
  description?: string
  categoryId?: string
  authorName?: string
  durationSeconds?: number
  /* Fields copied from the YouTube Data API when a key is configured. */
  youtubeChannelId?: string
  channelAvatarUrl?: string
  subscriberCount?: number
  handle?: string
  viewCount?: number
  likeCount?: number
  publishedAt?: string
  thumbnailUrl?: string
  isLive?: boolean
}

export interface AddVideoResult {
  ok: boolean
  video?: Video
  /** True when the write landed in the shared database rather than this browser. */
  savedToDatabase?: boolean
  error?: string
}

interface LibraryValue {
  videos: Video[]
  channels: Channel[]
  categories: Category[]
  playlists: Playlist[]

  getVideo: (id: string) => Video | undefined
  getChannel: (id: string) => Channel | undefined
  getChannelVideos: (channelId: string) => Video[]
  getPlaylist: (id: string) => Playlist | undefined
  getPlaylistVideos: (id: string) => Video[]
  upNext: (videoId: string, limit?: number) => Video[]
  search: (query: string) => Video[]

  reactions: Record<string, Reaction>
  setReaction: (videoId: string, value: Reaction) => void

  history: string[]
  addToHistory: (videoId: string) => void
  clearHistory: () => void

  watchLater: string[]
  toggleWatchLater: (videoId: string) => void

  subscriptions: string[]
  isSubscribed: (channelId: string) => boolean
  toggleSubscribe: (channelId: string) => void

  status: LibraryStatus
  error: string | null
  reload: () => Promise<void>
  databaseEnabled: boolean

  signedInAs: string | null
  refreshAuth: () => Promise<void>

  /* ---------------------------------------------------------- admin side */
  customVideos: Video[]
  customChannels: Channel[]
  pendingLocalVideos: Video[]
  sampleVideoCount: number
  libraryMode: LibraryMode
  setLibraryMode: (mode: LibraryMode) => void
  addVideo: (input: NewVideoInput) => Promise<AddVideoResult>
  updateVideo: (id: string, patch: Partial<Video>) => Promise<void>
  updateChannel: (id: string, patch: Partial<Channel>) => Promise<void>
  removeVideo: (id: string) => Promise<void>
  clearAllVideos: () => Promise<void>
  migrateLocalVideos: () => Promise<{ uploaded: number }>
}

const LibraryContext = createContext<LibraryValue | null>(null)

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}

/**
 * Best-effort metadata lookup. YouTube's own oEmbed endpoint does not send CORS
 * headers, so we try it and fall back to noembed.com. Thumbnails never depend on
 * this — they are derived from the video id.
 */
export async function fetchOEmbed(
  videoId: string,
): Promise<{ title: string; authorName: string; authorUrl?: string } | null> {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`
  const endpoints = [
    `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`,
    `https://noembed.com/embed?url=${encodeURIComponent(watchUrl)}`,
  ]
  for (const url of endpoints) {
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const data = (await res.json()) as { title?: string; author_name?: string; author_url?: string }
      if (data?.title) {
        return {
          title: data.title,
          authorName: data.author_name ?? 'Unknown',
          authorUrl: data.author_url,
        }
      }
    } catch {
      /* try the next endpoint */
    }
  }
  return null
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [reactions, setReactions] = useLocalStorage<Record<string, Reaction>>('jk.reactions', {})
  const [history, setHistory] = useLocalStorage<string[]>('jk.history', [])
  const [watchLater, setWatchLater] = useLocalStorage<string[]>('jk.watchLater', [])
  const [subscriptions, setSubscriptions] = useLocalStorage<string[]>('jk.subscriptions', [
    'ch-lofi',
    'ch-music',
  ])

  // Shared library, from Supabase.
  const [dbVideos, setDbVideos] = useState<Video[]>([])
  const [dbChannels, setDbChannels] = useState<Channel[]>([])
  const [status, setStatus] = useState<LibraryStatus>(supabaseConfigured ? 'loading' : 'ready')
  const [error, setError] = useState<string | null>(null)
  const [signedInAs, setSignedInAs] = useState<string | null>(null)

  // Videos added while signed out. Kept so nothing is lost; migratable.
  const [localVideos, setLocalVideos] = useLocalStorage<Video[]>('jk.videos', [])
  const [localChannels, setLocalChannels] = useLocalStorage<Channel[]>('jk.channels', [])

  const [libraryMode, setLibraryModeState] = useLocalStorage<LibraryMode>('jk.libraryMode', 'auto')
  const modeLoadedFromDb = useRef(false)

  /* ------------------------------------------------------------- loading */

  const load = useCallback(async () => {
    if (!supabaseConfigured) {
      setStatus('ready')
      return
    }
    setStatus('loading')
    try {
      const { videos, channels } = await fetchLibrary()
      setDbVideos(videos)
      setDbChannels(channels)
      setError(null)
      setStatus('ready')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the database.')
      setStatus('error')
    }
  }, [])

  const refreshAuth = useCallback(async () => {
    setSignedInAs(await getSessionEmail())
  }, [])

  useEffect(() => {
    void load()
    void refreshAuth()
  }, [load, refreshAuth])

  // Adopt the shared sample-library setting once, without clobbering a choice
  // the viewer just made on this device.
  useEffect(() => {
    if (!supabaseConfigured || modeLoadedFromDb.current) return
    modeLoadedFromDb.current = true
    void fetchSetting<LibraryMode>('libraryMode').then((mode) => {
      if (mode === 'auto' || mode === 'mine' || mode === 'samples') setLibraryModeState(mode)
    })
  }, [setLibraryModeState])

  /* ------------------------------------------------------------ deriving */

  /** Local videos not yet in the database (matched by id). */
  const pendingLocalVideos = useMemo(
    () => localVideos.filter((lv) => !dbVideos.some((dv) => dv.id === lv.id)),
    [localVideos, dbVideos],
  )

  const customVideos = useMemo(
    () => [...dbVideos].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
    [dbVideos],
  )

  const customChannels = useMemo(() => {
    const map = new Map<string, Channel>()
    for (const c of [...localChannels, ...dbChannels]) map.set(c.id, c)
    return [...map.values()]
  }, [localChannels, dbChannels])

  const channels = useMemo(() => {
    const map = new Map<string, Channel>()
    for (const c of seedChannels) map.set(c.id, c)
    for (const c of customChannels) map.set(c.id, c)
    return [...map.values()]
  }, [customChannels])

  const includeSamples = useMemo(() => {
    if (libraryMode === 'samples') return true
    if (libraryMode === 'mine') return false
    // Auto: placeholders only until there is something of your own, counting
    // both the shared library and anything still held locally.
    return dbVideos.length === 0 && pendingLocalVideos.length === 0
  }, [libraryMode, dbVideos.length, pendingLocalVideos.length])

  const videos = useMemo(() => {
    const own = [...dbVideos, ...pendingLocalVideos]
    const source =
      libraryMode === 'samples' ? seedVideos : includeSamples ? [...seedVideos, ...own] : own

    const seen = new Set<string>()
    return source
      .filter((v) => v.status === 'published')
      .filter((v) => (seen.has(v.id) ? false : (seen.add(v.id), true)))
      .sort((a, b) => {
        if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      })
  }, [includeSamples, libraryMode, dbVideos, pendingLocalVideos])

  const videoById = useMemo(() => {
    const map = new Map<string, Video>()
    for (const v of [...seedVideos, ...dbVideos, ...pendingLocalVideos]) map.set(v.id, v)
    return map
  }, [dbVideos, pendingLocalVideos])

  const channelById = useMemo(() => {
    const map = new Map<string, Channel>()
    for (const c of channels) map.set(c.id, c)
    return map
  }, [channels])

  const byChannel = useMemo(() => {
    const map = new Map<string, Video[]>()
    for (const v of videos) {
      const list = map.get(v.channelId) ?? []
      list.push(v)
      map.set(v.channelId, list)
    }
    return map
  }, [videos])

  const getVideo = useCallback((id: string) => videoById.get(id), [videoById])
  const getChannel = useCallback((id: string) => channelById.get(id), [channelById])
  const getChannelVideos = useCallback((channelId: string) => byChannel.get(channelId) ?? [], [byChannel])
  const getPlaylist = useCallback((id: string) => seedPlaylists.find((p) => p.id === id), [])
  const getPlaylistVideos = useCallback(
    (id: string) => {
      if (id === 'pl-watch-later') {
        return watchLater.map((vid) => videoById.get(vid)).filter(Boolean) as Video[]
      }
      if (id === 'pl-liked') {
        return Object.entries(reactions)
          .filter(([, v]) => v === 'like')
          .map(([vid]) => videoById.get(vid))
          .filter(Boolean) as Video[]
      }
      const pl = seedPlaylists.find((p) => p.id === id)
      if (!pl) return []
      return pl.videoIds.map((vid) => videoById.get(vid)).filter(Boolean) as Video[]
    },
    [videoById, watchLater, reactions],
  )

  const upNext = useCallback(
    (videoId: string, limit = 20) => {
      const current = videoById.get(videoId)
      const rest = videos.filter((v) => v.id !== videoId)
      if (!current) return rest.slice(0, limit)
      const sameCategory = rest.filter((v) => v.categoryId === current.categoryId)
      const others = rest.filter((v) => v.categoryId !== current.categoryId)
      return [...sameCategory, ...others].slice(0, limit)
    },
    [videos, videoById],
  )

  const search = useCallback(
    (query: string) => {
      const q = query.trim().toLowerCase()
      if (!q) return []
      const terms = q.split(/\s+/)
      return videos.filter((v) => {
        const channel = channelById.get(v.channelId)
        const haystack = `${v.title} ${v.description} ${channel?.name ?? ''} ${
          channel?.handle ?? ''
        }`.toLowerCase()
        return terms.every((t) => haystack.includes(t))
      })
    },
    [videos, channelById],
  )

  /* ------------------------------------------------------- per-viewer state */

  const setReaction = useCallback(
    (videoId: string, value: Reaction) => {
      setReactions((prev) => {
        const next = { ...prev }
        if (next[videoId] === value || value === null) delete next[videoId]
        else next[videoId] = value
        return next
      })
    },
    [setReactions],
  )

  const addToHistory = useCallback(
    (videoId: string) => {
      setHistory((prev) => [videoId, ...prev.filter((id) => id !== videoId)].slice(0, 200))
    },
    [setHistory],
  )

  const clearHistory = useCallback(() => setHistory([]), [setHistory])

  const toggleWatchLater = useCallback(
    (videoId: string) => {
      setWatchLater((prev) =>
        prev.includes(videoId) ? prev.filter((id) => id !== videoId) : [videoId, ...prev],
      )
    },
    [setWatchLater],
  )

  const isSubscribed = useCallback(
    (channelId: string) => subscriptions.includes(channelId),
    [subscriptions],
  )

  const toggleSubscribe = useCallback(
    (channelId: string) => {
      setSubscriptions((prev) =>
        prev.includes(channelId) ? prev.filter((id) => id !== channelId) : [...prev, channelId],
      )
    },
    [setSubscriptions],
  )

  const setLibraryMode = useCallback(
    (mode: LibraryMode) => {
      setLibraryModeState(mode)
      // Share the setting so every device agrees. Silently ignored when signed
      // out, because the database refuses writes from the public key.
      void saveSetting('libraryMode', mode).catch(() => undefined)
    },
    [setLibraryModeState],
  )

  /* ------------------------------------------------------------ writing */

  /** Resolves or creates the channel row for a video. */
  const resolveChannel = useCallback(
    (input: NewVideoInput): { channel: Channel; existing: boolean } => {
      const author = (input.authorName ?? 'My Channel').trim() || 'My Channel'
      const handle = input.handle?.trim() || `@${slugify(author) || 'mychannel'}`

      let channel = input.youtubeChannelId
        ? channels.find((c) => c.id === `ch-yt-${input.youtubeChannelId}`)
        : undefined
      if (!channel) channel = channels.find((c) => c.name.toLowerCase() === author.toLowerCase())

      if (channel) {
        return {
          channel: {
            ...channel,
            name: author || channel.name,
            handle: handle || channel.handle,
            avatarUrl: input.channelAvatarUrl || channel.avatarUrl,
            ...(input.subscriberCount !== undefined
              ? { subscriberCount: input.subscriberCount }
              : {}),
          },
          existing: true,
        }
      }

      return {
        channel: {
          id: input.youtubeChannelId
            ? `ch-yt-${input.youtubeChannelId}`
            : `ch-name-${slugify(author) || 'mychannel'}`,
          name: author,
          handle,
          avatarUrl: input.channelAvatarUrl ?? '',
          description: '',
          ...(input.subscriberCount !== undefined
            ? { subscriberCount: input.subscriberCount }
            : {}),
        },
        existing: false,
      }
    },
    [channels],
  )

  const buildVideo = useCallback(
    (input: NewVideoInput, channelId: string): AddVideoResult => {
      if (isBilibiliShortLink(input.url)) {
        return {
          ok: false,
          error:
            'Short b23.tv links cannot be read. Open the link in a browser, then copy the full bilibili.com/video/BV… address.',
        }
      }

      const youtubeId = parseYouTubeId(input.url)
      const bilibiliRef = youtubeId ? null : parseBilibiliId(input.url)
      if (!youtubeId && !bilibiliRef) {
        return { ok: false, error: 'That does not look like a YouTube or Bilibili link.' }
      }

      const bilibiliId = bilibiliRef ? bilibiliVideoId(bilibiliRef) : undefined
      const id = youtubeId ? `v-${youtubeId}` : `v-bili-${bilibiliId}`
      if (videoById.has(id)) {
        return { ok: false, error: 'That video is already in your library.' }
      }

      const title = input.title?.trim() || 'Untitled video'
      const thumbnailUrl =
        input.thumbnailUrl ||
        (bilibiliRef
          ? bilibiliPlaceholderThumbnail(title, bilibiliId ?? title)
          : youTubeThumbnail(youtubeId as string))

      return {
        ok: true,
        video: {
          id,
          title,
          description: input.description?.trim() ?? '',
          sourceType: youtubeId ? 'youtube' : 'bilibili',
          sourceUrl: youtubeId
            ? `https://www.youtube.com/watch?v=${youtubeId}`
            : bilibiliWatchUrl(bilibiliRef as BilibiliRef),
          ...(youtubeId ? { youtubeId } : {}),
          ...(bilibiliId ? { bilibiliId } : {}),
          embeddable: true,
          thumbnailUrl,
          thumbnailIsGenerated: Boolean(bilibiliRef && !input.thumbnailUrl),
          durationSeconds: input.durationSeconds ?? 0,
          channelId,
          categoryId: input.categoryId ?? 'all',
          publishedAt: input.publishedAt ?? new Date().toISOString(),
          viewCount: input.viewCount ?? 0,
          likeCount: input.likeCount ?? 0,
          isLive: input.isLive ?? false,
          statsUnknown: Boolean(bilibiliRef) && input.viewCount === undefined,
          status: 'published',
        },
      }
    },
    [videoById],
  )

  const addVideo = useCallback(
    async (input: NewVideoInput): Promise<AddVideoResult> => {
      const { channel } = resolveChannel(input)
      const built = buildVideo(input, channel.id)
      if (!built.ok || !built.video) return built
      const video = built.video

      if (signedInAs) {
        try {
          await upsertChannels([channel])
          await upsertVideos([video])
          setDbChannels((prev) =>
            prev.some((c) => c.id === channel.id)
              ? prev.map((c) => (c.id === channel.id ? channel : c))
              : [...prev, channel],
          )
          setDbVideos((prev) => [video, ...prev.filter((v) => v.id !== video.id)])
          return { ok: true, video, savedToDatabase: true }
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : 'Could not save.' }
        }
      }

      // Signed out: keep it locally so nothing is lost, and say so.
      setLocalChannels((prev) =>
        prev.some((c) => c.id === channel.id)
          ? prev.map((c) => (c.id === channel.id ? channel : c))
          : [...prev, channel],
      )
      setLocalVideos((prev) => [video, ...prev.filter((v) => v.id !== video.id)])
      return { ok: true, video, savedToDatabase: false }
    },
    [resolveChannel, buildVideo, signedInAs, setLocalChannels, setLocalVideos],
  )

  const updateVideo = useCallback(
    async (id: string, patch: Partial<Video>) => {
      const isLocal = localVideos.some((v) => v.id === id) && !dbVideos.some((v) => v.id === id)
      if (isLocal) {
        setLocalVideos((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)))
        return
      }
      if (!signedInAs) {
        setDbVideos((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)))
        return
      }
      try {
        await patchVideoRow(id, patch)
      } catch {
        /* fall through to the local update so the UI stays consistent */
      }
      setDbVideos((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)))
    },
    [localVideos, dbVideos, signedInAs, setLocalVideos],
  )

  const updateChannel = useCallback(
    async (id: string, patch: Partial<Channel>) => {
      const apply = (prev: Channel[]) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c))
      setLocalChannels(apply)
      setDbChannels(apply)
      if (!signedInAs) return
      const existing = dbChannels.find((c) => c.id === id)
      if (existing) {
        try {
          await upsertChannels([{ ...existing, ...patch }])
        } catch {
          /* non-fatal */
        }
      }
    },
    [signedInAs, dbChannels, setLocalChannels],
  )

  const removeVideo = useCallback(
    async (id: string) => {
      setLocalVideos((prev) => prev.filter((v) => v.id !== id))
      setDbVideos((prev) => prev.filter((v) => v.id !== id))
      if (signedInAs) {
        try {
          await deleteVideoRow(id)
        } catch {
          /* already gone locally */
        }
      }
    },
    [signedInAs, setLocalVideos],
  )

  const clearAllVideos = useCallback(async () => {
    const ids = dbVideos.map((v) => v.id)
    setLocalVideos([])
    setLocalChannels([])
    setDbVideos([])
    if (signedInAs && ids.length) {
      await deleteAllUserVideos(ids).catch(() => undefined)
    }
  }, [signedInAs, dbVideos, setLocalVideos, setLocalChannels])

  const migrateLocalVideos = useCallback(async () => {
    if (!signedInAs) throw new Error('Sign in first, then the videos can be uploaded.')
    const videosToSend = pendingLocalVideos
    if (videosToSend.length === 0) return { uploaded: 0 }

    const channelIds = [...new Set(videosToSend.map((v) => v.channelId))]
    const channelsToSend = localChannels.filter((c) => channelIds.includes(c.id))

    await upsertChannels(channelsToSend)
    await upsertVideos(videosToSend)

    setDbChannels((prev) => {
      const map = new Map(prev.map((c) => [c.id, c]))
      for (const c of channelsToSend) map.set(c.id, c)
      return [...map.values()]
    })
    setDbVideos((prev) => {
      const map = new Map(prev.map((v) => [v.id, v]))
      for (const v of videosToSend) map.set(v.id, v)
      return [...map.values()]
    })
    setLocalVideos((prev) => prev.filter((v) => !videosToSend.some((s) => s.id === v.id)))
    setLocalChannels((prev) => prev.filter((c) => !channelsToSend.some((s) => s.id === c.id)))

    return { uploaded: videosToSend.length }
  }, [
    signedInAs,
    pendingLocalVideos,
    localChannels,
    setDbChannels,
    setDbVideos,
    setLocalVideos,
    setLocalChannels,
  ])

  const value: LibraryValue = {
    videos,
    channels,
    categories: allCategories,
    playlists: seedPlaylists,
    getVideo,
    getChannel,
    getChannelVideos,
    getPlaylist,
    getPlaylistVideos,
    upNext,
    search,
    reactions,
    setReaction,
    history,
    addToHistory,
    clearHistory,
    watchLater,
    toggleWatchLater,
    subscriptions,
    isSubscribed,
    toggleSubscribe,
    status,
    error,
    reload: load,
    databaseEnabled: supabaseConfigured,
    signedInAs,
    refreshAuth,
    customVideos,
    customChannels,
    pendingLocalVideos,
    sampleVideoCount: seedVideos.length,
    libraryMode,
    setLibraryMode,
    addVideo,
    updateVideo,
    updateChannel,
    removeVideo,
    clearAllVideos,
    migrateLocalVideos,
  }

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
}

export function useLibrary(): LibraryValue {
  const ctx = useContext(LibraryContext)
  if (!ctx) throw new Error('useLibrary must be used inside <LibraryProvider>')
  return ctx
}
