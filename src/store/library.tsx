import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react'
import {
  categories as allCategories,
  channels as seedChannels,
  playlists as seedPlaylists,
  videos as seedVideos,
} from '../data/mock'
import { useLocalStorage } from '../lib/hooks'
import { parseYouTubeId, youTubeThumbnail } from '../lib/format'
import type { Category, Channel, Playlist, Video } from '../types'

/**
 * Single seam between the UI and its data.
 *
 * Today: the bundled placeholder library plus admin-added videos kept in
 * localStorage. Phase 3 swaps the storage for Supabase — the surface below
 * stays identical, so no component has to change.
 */

export type Reaction = 'like' | 'dislike' | null

export interface NewVideoInput {
  url: string
  title?: string
  description?: string
  categoryId?: string
  authorName?: string
  durationSeconds?: number
}

export interface AddVideoResult {
  ok: boolean
  video?: Video
  error?: string
}

/** Shape returned by YouTube's public oEmbed endpoint. */
export interface OEmbedInfo {
  title: string
  authorName: string
  authorUrl?: string
  thumbnailUrl?: string
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

  /* ---------------------------------------------------------- admin side */
  customVideos: Video[]
  addVideo: (input: NewVideoInput) => AddVideoResult
  updateVideo: (id: string, patch: Partial<Video>) => void
  removeVideo: (id: string) => void
  resetToSeed: () => void
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
 * Best-effort metadata lookup. YouTube's own oEmbed endpoint does not send
 * CORS headers, so we try it and fall back to noembed.com. Thumbnails never
 * depend on this — they are derived from the video id.
 */
export async function fetchOEmbed(videoId: string): Promise<OEmbedInfo | null> {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`
  const endpoints = [
    `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`,
    `https://noembed.com/embed?url=${encodeURIComponent(watchUrl)}`,
  ]
  for (const url of endpoints) {
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const data = (await res.json()) as {
        title?: string
        author_name?: string
        author_url?: string
        thumbnail_url?: string
      }
      if (data?.title) {
        return {
          title: data.title,
          authorName: data.author_name ?? 'Unknown',
          authorUrl: data.author_url,
          thumbnailUrl: data.thumbnail_url,
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
  const [subscriptions, setSubscriptions] = useLocalStorage<string[]>(
    'jk.subscriptions',
    ['ch-lofi', 'ch-music'],
  )
  const [customVideos, setCustomVideos] = useLocalStorage<Video[]>('jk.videos', [])
  const [customChannels, setCustomChannels] = useLocalStorage<Channel[]>('jk.channels', [])

  const channels = useMemo(
    () => [...seedChannels, ...customChannels],
    [customChannels],
  )

  const allVideos = useMemo(
    () => [...seedVideos, ...customVideos],
    [customVideos],
  )

  const videos = useMemo(
    () =>
      [...allVideos]
        .filter((v) => v.status === 'published')
        .sort((a, b) => {
          if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1
          return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
        }),
    [allVideos],
  )

  const videoById = useMemo(() => {
    const map = new Map<string, Video>()
    for (const v of allVideos) map.set(v.id, v)
    return map
  }, [allVideos])

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
  const getChannelVideos = useCallback(
    (channelId: string) => byChannel.get(channelId) ?? [],
    [byChannel],
  )
  const getPlaylist = useCallback(
    (id: string) => seedPlaylists.find((p) => p.id === id),
    [],
  )
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

  /* ------------------------------------------------------------ admin API */

  const addVideo = useCallback(
    (input: NewVideoInput): AddVideoResult => {
      const videoId = parseYouTubeId(input.url)
      if (!videoId) {
        return { ok: false, error: 'That does not look like a YouTube link.' }
      }
      const duplicate = allVideos.some((v) => v.youtubeId === videoId)
      if (duplicate) {
        return { ok: false, error: 'That video is already in your library.' }
      }

      const author = (input.authorName ?? 'My Channel').trim() || 'My Channel'
      const handle = `@${slugify(author) || 'mychannel'}`
      let channel = channels.find((c) => c.name.toLowerCase() === author.toLowerCase())

      if (!channel) {
        channel = {
          id: `ch-${slugify(author) || 'mychannel'}-${Date.now().toString(36)}`,
          name: author,
          handle,
          avatarUrl: '',
          description: '',
          subscriberCount: 0,
        }
        setCustomChannels((prev) => [...prev, channel as Channel])
      }

      const created: Video = {
        id: `v-${videoId}`,
        title: input.title?.trim() || 'Untitled video',
        description: input.description?.trim() ?? '',
        sourceType: 'youtube',
        sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
        youtubeId: videoId,
        embeddable: true,
        thumbnailUrl: youTubeThumbnail(videoId),
        durationSeconds: input.durationSeconds ?? 0,
        channelId: channel.id,
        categoryId: input.categoryId ?? 'all',
        publishedAt: new Date().toISOString(),
        viewCount: 0,
        likeCount: 0,
        status: 'published',
      }

      setCustomVideos((prev) => [created, ...prev])
      return { ok: true, video: created }
    },
    [allVideos, channels, setCustomChannels, setCustomVideos],
  )

  const updateVideo = useCallback(
    (id: string, patch: Partial<Video>) => {
      setCustomVideos((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)))
    },
    [setCustomVideos],
  )

  const removeVideo = useCallback(
    (id: string) => {
      setCustomVideos((prev) => prev.filter((v) => v.id !== id))
    },
    [setCustomVideos],
  )

  const resetToSeed = useCallback(() => {
    setCustomVideos([])
    setCustomChannels([])
  }, [setCustomVideos, setCustomChannels])

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
    customVideos,
    addVideo,
    updateVideo,
    removeVideo,
    resetToSeed,
  }

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
}

export function useLibrary(): LibraryValue {
  const ctx = useContext(LibraryContext)
  if (!ctx) throw new Error('useLibrary must be used inside <LibraryProvider>')
  return ctx
}
