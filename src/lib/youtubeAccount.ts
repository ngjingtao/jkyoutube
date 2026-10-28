import { useEffect, useState } from 'react'
import { GOOGLE_AUTH_EVENT, storedGoogleToken } from './googleAuth'
import {
  fetchChannelMetadataAuthorized,
  fetchJsonAuthorized,
  fetchVideoMetadataAuthorized,
  YouTubeApiError,
} from './youtube'
import {
  rememberYouTubeVideos,
  toYouTubeVideo,
  YT_CHANNEL_PREFIX,
  YT_VIDEO_PREFIX,
} from './youtubeFeed'
import type { Channel, Video } from '../types'

/**
 * The viewer's own YouTube content: newest uploads from the channels they
 * subscribe to, plus videos they have liked.
 *
 * This needs a Google sign-in (youtube.readonly). It is deliberately not the
 * algorithmic home feed: Google deprecated the API's `home` feed and never
 * exposed personalised recommendations to third-party sites. Subscriptions and
 * likes are the account-specific lists that are actually available.
 *
 * Quota: about 1 subscription call, 1 channel-details call, up to 30 uploads
 * calls and a few video-detail calls — roughly 35 units per refresh. The feed is
 * cached for 20 minutes so a device left open does not drain the daily 10,000.
 */

const API_BASE = 'https://www.googleapis.com/youtube/v3'
const FEED_TTL_MS = 20 * 60_000
const MAX_SUBSCRIPTIONS = 30
const UPLOADS_PER_CHANNEL = 4
const MAX_VIDEOS = 60

interface MyChannel {
  items?: Array<{
    id?: string
    snippet?: { title?: string }
    contentDetails?: { relatedPlaylists?: { likes?: string } }
  }>
}

interface SubscriptionList {
  items?: Array<{ snippet?: { resourceId?: { channelId?: string } } }>
}

interface ChannelDetails {
  items?: Array<{
    id?: string
    contentDetails?: { relatedPlaylists?: { uploads?: string } }
  }>
}

interface PlaylistItems {
  items?: Array<{ contentDetails?: { videoId?: string } }>
}

export interface YouTubeAccountFeed {
  /** Everything, newest first — what Home shows. */
  videos: Video[]
  /** Uploads from subscribed channels only. */
  subscriptionVideos: Video[]
  /** Videos this account has liked. */
  likedVideos: Video[]
  channels: Record<string, Channel>
  accountTitle: string
}

let cache: { at: number; token: string; feed: YouTubeAccountFeed } | null = null
let inflight: Promise<YouTubeAccountFeed> | null = null

export function forgetYouTubeAccountCache(): void {
  cache = null
  inflight = null
}

function describe(err: unknown): string {
  if (err instanceof YouTubeApiError) return err.message
  if (err instanceof Error) return err.message
  return 'Could not load your YouTube account.'
}

async function load(token: string): Promise<YouTubeAccountFeed> {
  if (cache && cache.token === token && Date.now() - cache.at < FEED_TTL_MS) return cache.feed
  if (inflight) return inflight

  inflight = (async () => {
    const me = await fetchJsonAuthorized<MyChannel>(
      `${API_BASE}/channels?part=snippet,contentDetails&mine=true`,
      token,
    )
    const myChannel = me.items?.[0]
    const accountTitle = myChannel?.snippet?.title ?? 'Your account'
    const likedPlaylist = myChannel?.contentDetails?.relatedPlaylists?.likes

    const subscriptions = await fetchJsonAuthorized<SubscriptionList>(
      `${API_BASE}/subscriptions?part=snippet&mine=true&maxResults=50`,
      token,
    )
    const subscribedIds = (subscriptions.items ?? [])
      .map((item) => item.snippet?.resourceId?.channelId)
      .filter((id): id is string => Boolean(id))
      .slice(0, MAX_SUBSCRIPTIONS)

    const uploadIds: string[] = []

    if (subscribedIds.length > 0) {
      const details = await fetchJsonAuthorized<ChannelDetails>(
        `${API_BASE}/channels?part=contentDetails&id=${subscribedIds.join(',')}`,
        token,
      )
      const uploads = (details.items ?? [])
        .map((item) => item.contentDetails?.relatedPlaylists?.uploads)
        .filter((id): id is string => Boolean(id))

      // Small batches: 30 parallel requests would be unkind to the quota and
      // the browser's connection limit, and a partial feed is still useful.
      for (let i = 0; i < uploads.length; i += 8) {
        const batch = uploads.slice(i, i + 8)
        const lists = await Promise.all(
          batch.map(async (playlistId) => {
            const data = await fetchJsonAuthorized<PlaylistItems>(
              `${API_BASE}/playlistItems?part=contentDetails&maxResults=${UPLOADS_PER_CHANNEL}&playlistId=${playlistId}`,
              token,
            )
            return (data.items ?? [])
              .map((item) => item.contentDetails?.videoId)
              .filter((id): id is string => Boolean(id))
          }),
        )
        for (const list of lists) uploadIds.push(...list)
        if (uploadIds.length >= MAX_VIDEOS * 2) break
      }
    }

    const likedIds: string[] = []
    if (likedPlaylist) {
      const liked = await fetchJsonAuthorized<PlaylistItems>(
        `${API_BASE}/playlistItems?part=contentDetails&maxResults=25&playlistId=${likedPlaylist}`,
        token,
      )
      for (const item of liked.items ?? []) {
        const id = item.contentDetails?.videoId
        if (id) likedIds.push(id)
      }
    }

    const uniqueUploads = [...new Set(uploadIds)]
    const uniqueLikes = [...new Set(likedIds)]
    const uniqueIds = [...new Set([...uniqueUploads, ...uniqueLikes])]
    if (uniqueIds.length === 0) {
      const feed: YouTubeAccountFeed = {
        videos: [],
        subscriptionVideos: [],
        likedVideos: [],
        channels: {},
        accountTitle,
      }
      cache = { at: Date.now(), token, feed }
      return feed
    }

    const metadata = await fetchVideoMetadataAuthorized(uniqueIds, token)
    const channelIds = [...new Set(metadata.map((video) => video.channelId).filter(Boolean))]
    const ytChannels = channelIds.length
      ? await fetchChannelMetadataAuthorized(channelIds, token).catch(() => [])
      : []

    const channels: Record<string, Channel> = {}
    for (const channel of ytChannels) {
      const id = `${YT_CHANNEL_PREFIX}${channel.id}`
      channels[id] = {
        id,
        name: channel.title,
        handle: channel.handle,
        avatarUrl: channel.avatarUrl,
        bannerUrl: channel.bannerUrl,
        description: channel.description,
        subscriberCount: channel.subscriberCount,
      }
    }
    for (const video of metadata) {
      const id = `${YT_CHANNEL_PREFIX}${video.channelId}`
      if (!channels[id]) {
        channels[id] = { id, name: video.channelTitle, handle: '', avatarUrl: '' }
      }
    }

    const mapped = metadata.map(toYouTubeVideo)
    const byId = new Map(mapped.map((video) => [video.id, video]))
    const pick = (ids: string[]) =>
      ids
        .map((id) => byId.get(`${YT_VIDEO_PREFIX}${id}`))
        .filter((video): video is Video => Boolean(video))
    const newestFirst = (list: Video[]) =>
      list.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())

    const subscriptionVideos = newestFirst(pick(uniqueUploads)).slice(0, MAX_VIDEOS)
    const likedVideos = newestFirst(pick(uniqueLikes)).slice(0, MAX_VIDEOS)

    const combined = new Map<string, Video>()
    for (const video of [...subscriptionVideos, ...likedVideos]) combined.set(video.id, video)
    const videos = newestFirst([...combined.values()]).slice(0, MAX_VIDEOS)
    rememberYouTubeVideos(videos, channels)

    const feed: YouTubeAccountFeed = {
      videos,
      subscriptionVideos,
      likedVideos,
      channels,
      accountTitle,
    }
    cache = { at: Date.now(), token, feed }
    return feed
  })()

  try {
    return await inflight
  } finally {
    inflight = null
  }
}

export type YouTubeAccountStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface YouTubeAccountState extends YouTubeAccountFeed {
  status: YouTubeAccountStatus
  signedIn: boolean
  error: string | null
}

function cachedState(token: string | null): YouTubeAccountState {
  if (token && cache && cache.token === token && Date.now() - cache.at < FEED_TTL_MS) {
    return { status: 'ready', signedIn: true, error: null, ...cache.feed }
  }
  return {
    status: 'idle',
    signedIn: Boolean(token),
    error: null,
    videos: [],
    subscriptionVideos: [],
    likedVideos: [],
    channels: {},
    accountTitle: '',
  }
}

/**
 * Loads the signed-in feed when `enabled`, and re-runs after sign-in/sign-out.
 * Safe to call from several pages: requests and results are shared.
 */
export function useYouTubeAccountFeed(enabled = true): YouTubeAccountState {
  const [token, setToken] = useState<string | null>(() => storedGoogleToken()?.accessToken ?? null)
  const [state, setState] = useState<YouTubeAccountState>(() => cachedState(token))

  useEffect(() => {
    const sync = () => {
      const next = storedGoogleToken()
      if (!next) forgetYouTubeAccountCache()
      setToken(next?.accessToken ?? null)
    }
    window.addEventListener(GOOGLE_AUTH_EVENT, sync)
    return () => window.removeEventListener(GOOGLE_AUTH_EVENT, sync)
  }, [])

  useEffect(() => {
    if (!token) {
      setState(cachedState(null))
      return
    }
    if (!enabled) return

    if (cache && cache.token === token && Date.now() - cache.at < FEED_TTL_MS) {
      setState({ status: 'ready', signedIn: true, error: null, ...cache.feed })
      return
    }

    let cancelled = false
    setState((prev) => ({ ...prev, status: 'loading', signedIn: true, error: null }))

    void load(token)
      .then((feed) => {
        if (!cancelled) setState({ status: 'ready', signedIn: true, error: null, ...feed })
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            signedIn: true,
            error: describe(err),
            videos: [],
            subscriptionVideos: [],
            likedVideos: [],
            channels: {},
            accountTitle: '',
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [token, enabled])

  return state
}
