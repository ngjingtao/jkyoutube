import { useEffect, useState } from 'react'
import { fetchSetting } from './remote'
import {
  fetchChannelMetadata,
  fetchChannelUploads,
  fetchTrendingVideos,
  fetchVideoCategories,
  fetchVideoMetadata,
  searchYouTubeVideos,
  YouTubeApiError,
  type YtChannelMetadata,
  type YtVideoMetadata,
} from './youtube'
import type { Category, Channel, Video } from '../types'

/**
 * Real YouTube content, adapted to the shapes the app already renders.
 *
 * While Viewer mode is "Normal YouTube" the pages use this instead of the
 * curated library: Home shows YouTube's most-popular list, watch pages play
 * those videos, and channel pages show the channel's recent uploads.
 *
 * Google does not expose youtube.com's personalised home feed to other sites,
 * so "most popular" is the closest list that can be fetched from a browser.
 * Everything here is cached because every call costs API quota.
 */

const FEED_TTL_MS = 10 * 60_000
const CHANNEL_TTL_MS = 10 * 60_000
const SEARCH_TTL_MS = 60 * 60_000
const KEY_TTL_MS = 60_000

export const YT_VIDEO_PREFIX = 'v-'
export const YT_CHANNEL_PREFIX = 'ch-yt-'
export const YT_CATEGORY_PREFIX = 'yt-cat-'

export interface YouTubeFeed {
  videos: Video[]
  channels: Record<string, Channel>
  categories: Category[]
}

export type YouTubeStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface YouTubeFeedState extends YouTubeFeed {
  status: YouTubeStatus
  error: string | null
}

/* ------------------------------------------------------------------ key --- */

let keyCache: { value: string; at: number } | null = null

function localApiKey(): string {
  if (typeof window === 'undefined') return ''
  try {
    const raw = window.localStorage.getItem('jk.youtubeApiKey')
    if (!raw) return ''
    const parsed = JSON.parse(raw) as unknown
    return typeof parsed === 'string' ? parsed.trim() : ''
  } catch {
    return ''
  }
}

/**
 * The admin's key is shared through Supabase settings so viewers can use it
 * without ever visiting the content manager. A local copy wins on the admin's
 * own browser, where it may be newer than the shared row.
 */
export async function resolveYouTubeApiKey(): Promise<string> {
  if (keyCache && Date.now() - keyCache.at < KEY_TTL_MS) return keyCache.value
  const local = localApiKey()
  let shared = ''
  try {
    const value = await fetchSetting<string>('youtubeApiKey')
    if (typeof value === 'string') shared = value.trim()
  } catch {
    /* a missing settings table must not break the viewer */
  }
  const value = local || shared
  keyCache = { value, at: Date.now() }
  return value
}

/** Called after the admin changes the key so the next fetch sees it. */
export function forgetYouTubeCache(): void {
  keyCache = null
  feedCache = null
  feedPromise = null
  channelFeedCache.clear()
  channelFeedPromises.clear()
  searchCache.clear()
}

/* --------------------------------------------------------------- mapping --- */

function describeError(err: unknown): string {
  if (err instanceof YouTubeApiError) return err.message
  if (err instanceof Error) return err.message
  return 'Could not load videos from YouTube.'
}

function regionCode(): string {
  try {
    const parts = (navigator.language || 'en-US').split('-')
    const region = parts.length > 1 ? parts[parts.length - 1] : ''
    return /^[A-Z]{2}$/i.test(region) ? region.toUpperCase() : 'US'
  } catch {
    return 'US'
  }
}

function toChannel(channel: YtChannelMetadata): Channel {
  return {
    id: `${YT_CHANNEL_PREFIX}${channel.id}`,
    name: channel.title,
    handle: channel.handle,
    avatarUrl: channel.avatarUrl,
    bannerUrl: channel.bannerUrl,
    description: channel.description,
    subscriberCount: channel.subscriberCount,
  }
}

export function toYouTubeVideo(video: YtVideoMetadata): Video {
  return {
    id: `${YT_VIDEO_PREFIX}${video.id}`,
    title: video.title,
    description: video.description,
    sourceType: 'youtube',
    sourceUrl: `https://www.youtube.com/watch?v=${video.id}`,
    youtubeId: video.id,
    thumbnailUrl: video.thumbnailUrl,
    durationSeconds: video.durationSeconds,
    channelId: `${YT_CHANNEL_PREFIX}${video.channelId}`,
    categoryId: video.categoryId ? `${YT_CATEGORY_PREFIX}${video.categoryId}` : 'all',
    publishedAt: video.publishedAt,
    viewCount: video.viewCount,
    likeCount: video.likeCount,
    isLive: video.isLive,
    embeddable: video.embeddable,
    status: 'published',
  }
}

/* ----------------------------------------------------------------- caches --- */

let feedCache: { at: number; feed: YouTubeFeed } | null = null
let feedPromise: Promise<YouTubeFeed> | null = null

const videoCache = new Map<string, Video>()
const channelCache = new Map<string, Channel>()
const channelFeedCache = new Map<string, { at: number; channel: Channel; videos: Video[] }>()
const channelFeedPromises = new Map<string, Promise<{ channel: Channel; videos: Video[] }>>()
const searchCache = new Map<string, { at: number; videos: Video[] }>()

function remember(videos: Video[], channels: Record<string, Channel> = {}): void {
  for (const video of videos) videoCache.set(video.id, video)
  for (const [id, channel] of Object.entries(channels)) channelCache.set(id, channel)
}

function channelsFromVideos(videos: YtVideoMetadata[]): Record<string, Channel> {
  const out: Record<string, Channel> = {}
  for (const video of videos) {
    if (!video.channelId) continue
    const id = `${YT_CHANNEL_PREFIX}${video.channelId}`
    if (!out[id]) {
      out[id] = { id, name: video.channelTitle, handle: '', avatarUrl: '' }
    }
  }
  return out
}

export function getYouTubeVideo(id: string): Video | undefined {
  return videoCache.get(id)
}

export function getYouTubeChannel(id: string): Channel | undefined {
  return channelCache.get(id)
}

export function peekYouTubeFeed(): YouTubeFeed | null {
  return feedCache?.feed ?? null
}

/* ------------------------------------------------------------------ feed --- */

export async function loadYouTubeFeed(force = false): Promise<YouTubeFeed> {
  if (!force && feedCache && Date.now() - feedCache.at < FEED_TTL_MS) return feedCache.feed
  if (!force && feedPromise) return feedPromise

  feedPromise = (async () => {
    const key = await resolveYouTubeApiKey()
    if (!key) throw new Error('No YouTube Data API key has been shared yet.')

    const region = regionCode()
    let items = await fetchTrendingVideos(key, region)
    // Some regions have no chart; fall back rather than showing an empty app.
    if (items.length === 0 && region !== 'US') items = await fetchTrendingVideos(key, 'US')
    if (items.length === 0) throw new Error('YouTube returned no popular videos right now.')

    const [ytCategories, ytChannels] = await Promise.all([
      fetchVideoCategories(key, region).catch(() => []),
      fetchChannelMetadata(
        [...new Set(items.map((item) => item.channelId).filter(Boolean))],
        key,
      ).catch(() => []),
    ])

    const channels: Record<string, Channel> = channelsFromVideos(items)
    for (const channel of ytChannels) {
      const mapped = toChannel(channel)
      channels[mapped.id] = mapped
    }

    const videos = items.map(toYouTubeVideo)
    remember(videos, channels)

    const used = new Set(items.map((item) => item.categoryId).filter(Boolean))
    const categories: Category[] = [{ id: 'all', name: 'All' }]
    for (const category of ytCategories) {
      if (used.has(category.id)) {
        categories.push({ id: `${YT_CATEGORY_PREFIX}${category.id}`, name: category.title })
      }
    }
    // The category call is a nicety; keep usable chips if it failed.
    if (categories.length === 1) {
      for (const id of used) {
        categories.push({ id: `${YT_CATEGORY_PREFIX}${id}`, name: 'More videos' })
      }
    }

    const feed: YouTubeFeed = { videos, channels, categories }
    feedCache = { at: Date.now(), feed }
    return feed
  })()

  try {
    return await feedPromise
  } finally {
    feedPromise = null
  }
}

function cachedFeedState(): YouTubeFeedState {
  if (feedCache && Date.now() - feedCache.at < FEED_TTL_MS) {
    return { status: 'ready', error: null, ...feedCache.feed }
  }
  return { status: 'idle', error: null, videos: [], channels: {}, categories: [] }
}

export function useYouTubeFeed(enabled = true): YouTubeFeedState {
  const [state, setState] = useState<YouTubeFeedState>(cachedFeedState)

  useEffect(() => {
    if (!enabled) return
    if (feedCache && Date.now() - feedCache.at < FEED_TTL_MS) {
      setState({ status: 'ready', error: null, ...feedCache.feed })
      return
    }

    let cancelled = false
    setState((prev) => ({ ...prev, status: 'loading', error: null }))
    void loadYouTubeFeed()
      .then((feed) => {
        if (!cancelled) setState({ status: 'ready', error: null, ...feed })
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            error: describeError(err),
            videos: [],
            channels: {},
            categories: [],
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [enabled])

  return state
}

/* ---------------------------------------------------------------- video --- */

export interface YouTubeVideoState {
  status: YouTubeStatus
  video: Video | null
  channel: Channel | null
  error: string | null
}

export function useYouTubeVideo(id: string, enabled = true): YouTubeVideoState {
  const [state, setState] = useState<YouTubeVideoState>(() => {
    const video = videoCache.get(id) ?? null
    return {
      status: video ? 'ready' : 'idle',
      video,
      channel: video ? (channelCache.get(video.channelId) ?? null) : null,
      error: null,
    }
  })

  useEffect(() => {
    if (!enabled) return

    const cached = videoCache.get(id)
    if (cached) {
      setState({
        status: 'ready',
        video: cached,
        channel: channelCache.get(cached.channelId) ?? null,
        error: null,
      })
      return
    }

    const raw = id.startsWith(YT_VIDEO_PREFIX) ? id.slice(YT_VIDEO_PREFIX.length) : id
    if (!raw) return

    let cancelled = false
    setState({ status: 'loading', video: null, channel: null, error: null })

    void (async () => {
      const key = await resolveYouTubeApiKey()
      if (!key) throw new Error('No YouTube Data API key has been shared yet.')
      const [found] = await fetchVideoMetadata([raw], key)
      if (!found) throw new Error('That video is not available on YouTube.')
      const video = toYouTubeVideo(found)
      const channel: Channel =
        channelCache.get(video.channelId) ?? {
          id: video.channelId,
          name: found.channelTitle,
          handle: '',
          avatarUrl: '',
        }
      remember([video], { [channel.id]: channel })
      if (!cancelled) setState({ status: 'ready', video, channel, error: null })
    })().catch((err: unknown) => {
      if (!cancelled) setState({ status: 'error', video: null, channel: null, error: describeError(err) })
    })

    return () => {
      cancelled = true
    }
  }, [id, enabled])

  return state
}

/* -------------------------------------------------------------- channel --- */

export interface YouTubeChannelState {
  status: YouTubeStatus
  channel: Channel | null
  videos: Video[]
  error: string | null
}

async function loadChannel(rawId: string): Promise<{ channel: Channel; videos: Video[] }> {
  const key = await resolveYouTubeApiKey()
  if (!key) throw new Error('No YouTube Data API key has been shared yet.')

  const data = await fetchChannelUploads(rawId, key)
  if (!data) throw new Error('This channel is not available on YouTube.')

  const channel = toChannel(data.channel)
  const videos = data.videos.map(toYouTubeVideo)
  remember(videos, { [channel.id]: channel })
  const result = { channel, videos }
  channelFeedCache.set(channel.id, { at: Date.now(), ...result })
  return result
}

export function useYouTubeChannel(id: string, enabled = true): YouTubeChannelState {
  const [state, setState] = useState<YouTubeChannelState>(() => {
    const cached = channelFeedCache.get(id)
    return {
      status: cached ? 'ready' : 'idle',
      channel: cached?.channel ?? channelCache.get(id) ?? null,
      videos: cached?.videos ?? [],
      error: null,
    }
  })

  useEffect(() => {
    if (!enabled) return

    const cached = channelFeedCache.get(id)
    if (cached && Date.now() - cached.at < CHANNEL_TTL_MS) {
      setState({ status: 'ready', channel: cached.channel, videos: cached.videos, error: null })
      return
    }

    const raw = id.startsWith(YT_CHANNEL_PREFIX) ? id.slice(YT_CHANNEL_PREFIX.length) : id
    if (!raw) return

    let cancelled = false
    setState((prev) => ({ ...prev, status: 'loading', error: null }))

    let pending = channelFeedPromises.get(raw)
    if (!pending) {
      pending = loadChannel(raw)
      channelFeedPromises.set(raw, pending)
      void pending.finally(() => channelFeedPromises.delete(raw))
    }

    void pending
      .then((data) => {
        if (!cancelled) {
          setState({ status: 'ready', channel: data.channel, videos: data.videos, error: null })
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({ status: 'error', channel: null, videos: [], error: describeError(err) })
        }
      })

    return () => {
      cancelled = true
    }
  }, [id, enabled])

  return state
}

/* --------------------------------------------------------------- search --- */

export interface YouTubeSearchState {
  status: YouTubeStatus
  videos: Video[]
  error: string | null
}

/**
 * Searches YouTube itself. Costs 100 units per uncached query, so results are
 * reused for an hour and identical queries are coalesced.
 */
export function useYouTubeSearch(query: string, enabled = true): YouTubeSearchState {
  const key = query.trim().toLowerCase()
  const [state, setState] = useState<YouTubeSearchState>(() => {
    const cached = searchCache.get(key)
    return {
      status: cached ? 'ready' : 'idle',
      videos: cached?.videos ?? [],
      error: null,
    }
  })

  useEffect(() => {
    if (!enabled || !key) return

    const cached = searchCache.get(key)
    if (cached && Date.now() - cached.at < SEARCH_TTL_MS) {
      setState({ status: 'ready', videos: cached.videos, error: null })
      return
    }

    let cancelled = false
    setState({ status: 'loading', videos: [], error: null })

    void (async () => {
      const apiKey = await resolveYouTubeApiKey()
      if (!apiKey) throw new Error('No YouTube Data API key has been shared yet.')
      const found = await searchYouTubeVideos(query.trim(), apiKey)
      const videos = found.map(toYouTubeVideo)
      remember(videos, channelsFromVideos(found))
      searchCache.set(key, { at: Date.now(), videos })
      if (!cancelled) setState({ status: 'ready', videos, error: null })
    })().catch((err: unknown) => {
      if (!cancelled) setState({ status: 'error', videos: [], error: describeError(err) })
    })

    return () => {
      cancelled = true
    }
  }, [key, query, enabled])

  return state
}
