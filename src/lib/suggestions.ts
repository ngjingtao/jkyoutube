import { supabase } from './supabase'
import { upsertChannels, upsertVideos } from './remote'
import type { Channel, Video } from '../types'

/**
 * YouTube suggestions, mixed into Up next at a ratio the owner controls.
 *
 * Quota is the whole design constraint here. `search.list` costs 100 units
 * against a free allowance of 10,000 per day, so it is 100 searches per day and
 * no more. Everything below exists to avoid spending them:
 *
 *  - A lookup is cached per seed video in `suggestion_cache` for 24 hours.
 *  - Results are stored once as ordinary rows flagged `suggested`, so they play
 *    through exactly the same path as curated videos.
 *  - Any failure is silent; suggestions are a bonus, never a requirement.
 */

const SEARCH_ENDPOINT = 'https://www.googleapis.com/youtube/v3/search'
const CACHE_HOURS = 24
const MAX_RESULTS = 8

interface SearchItem {
  id?: { videoId?: string }
  snippet?: {
    title?: string
    description?: string
    channelId?: string
    channelTitle?: string
    publishedAt?: string
    thumbnails?: Record<string, { url?: string }>
  }
}

function bestThumb(thumbs: Record<string, { url?: string }> | undefined): string {
  if (!thumbs) return ''
  for (const key of ['maxres', 'standard', 'high', 'medium', 'default']) {
    const url = thumbs[key]?.url
    if (url) return url
  }
  return ''
}

/** Trims a title into something usable as a search query. */
function toQuery(title: string): string {
  return title
    .replace(/[☆★【】\[\]()（）|/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100)
}

async function cacheIsFresh(seedVideoId: string): Promise<boolean> {
  if (!supabase) return false
  const { data } = await supabase
    .from('suggestion_cache')
    .select('fetched_at')
    .eq('seed_video_id', seedVideoId)
    .maybeSingle()
  if (!data?.fetched_at) return false
  const ageMs = Date.now() - new Date(data.fetched_at).getTime()
  return ageMs < CACHE_HOURS * 3600_000
}

async function existingSuggestions(seedVideoId: string): Promise<Video[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('videos')
    .select('*')
    .eq('suggested_for', seedVideoId)
    .eq('suggested', true)
    .limit(MAX_RESULTS * 2)
  if (!data) return []
  // Reuse the shared mapper by going through the same shape the store expects.
  return (data as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    title: String(row.title ?? ''),
    description: String(row.description ?? ''),
    sourceType: 'youtube',
    sourceUrl: String(row.source_url ?? ''),
    youtubeId: row.youtube_id ? String(row.youtube_id) : undefined,
    thumbnailUrl: String(row.thumbnail_url ?? ''),
    durationSeconds: Number(row.duration_seconds ?? 0),
    channelId: String(row.channel_id ?? ''),
    categoryId: String(row.category_id ?? 'all'),
    publishedAt: String(row.published_at ?? new Date().toISOString()),
    viewCount: Number(row.view_count ?? 0),
    likeCount: Number(row.like_count ?? 0),
    statsUnknown: true,
    status: 'published',
    suggested: true,
    suggestedFor: seedVideoId,
  }))
}

async function markCache(seedVideoId: string, count: number): Promise<void> {
  if (!supabase) return
  await supabase
    .from('suggestion_cache')
    .upsert(
      { seed_video_id: seedVideoId, fetched_at: new Date().toISOString(), result_count: count },
      { onConflict: 'seed_video_id' },
    )
}

/**
 * Returns suggestions for a seed video, fetching them only when the cache has
 * expired. Never throws.
 */
export async function ensureSuggestions(
  seed: Video,
  apiKey: string,
  ratio: number,
): Promise<Video[]> {
  if (!supabase || !apiKey.trim() || ratio <= 0) return []
  if (seed.sourceType !== 'youtube') return []

  try {
    if (await cacheIsFresh(seed.id)) {
      return await existingSuggestions(seed.id)
    }

    const query = toQuery(seed.title)
    if (!query) return []

    const params = new URLSearchParams({
      part: 'snippet',
      type: 'video',
      maxResults: String(MAX_RESULTS),
      q: query,
      // Only ask for videos that can actually be embedded here.
      videoEmbeddable: 'true',
      // This app is for a child.
      safeSearch: 'moderate',
      key: apiKey.trim(),
    })

    const res = await fetch(`${SEARCH_ENDPOINT}?${params.toString()}`)
    if (!res.ok) return []
    const data = (await res.json()) as { items?: SearchItem[] }
    const items = (data.items ?? []).filter((i) => i.id?.videoId)
    if (items.length === 0) {
      await markCache(seed.id, 0)
      return []
    }

    const channels = new Map<string, Channel>()
    const videos: Video[] = []

    for (const item of items) {
      const youtubeId = item.id?.videoId as string
      // Never suggest the video being watched.
      if (youtubeId === seed.youtubeId) continue
      const snippet = item.snippet ?? {}
      const channelId = snippet.channelId ? `ch-yt-${snippet.channelId}` : ''

      if (snippet.channelId && snippet.channelTitle) {
        channels.set(channelId, {
          id: channelId,
          name: snippet.channelTitle,
          handle: '',
          avatarUrl: '',
          description: '',
        })
      }

      videos.push({
        id: `v-${youtubeId}`,
        title: snippet.title ?? 'Untitled video',
        description: snippet.description ?? '',
        sourceType: 'youtube',
        sourceUrl: `https://www.youtube.com/watch?v=${youtubeId}`,
        youtubeId,
        thumbnailUrl: bestThumb(snippet.thumbnails),
        // search.list does not return durations or view counts, so these stay
        // unknown rather than being faked as zero.
        durationSeconds: 0,
        channelId,
        categoryId: seed.categoryId ?? 'all',
        publishedAt: snippet.publishedAt ?? new Date().toISOString(),
        viewCount: 0,
        likeCount: 0,
        statsUnknown: true,
        status: 'published',
        suggested: true,
        suggestedFor: seed.id,
      })
    }

    if (videos.length === 0) {
      await markCache(seed.id, 0)
      return []
    }

    await upsertChannels([...channels.values()])
    // ignoreDuplicates so a row suggested by another seed is not rewritten.
    await supabase
      .from('videos')
      .upsert(
        videos.map((v) => ({
          id: v.id,
          title: v.title,
          description: v.description,
          source_type: v.sourceType,
          source_url: v.sourceUrl,
          youtube_id: v.youtubeId ?? null,
          bilibili_id: null,
          thumbnail_url: v.thumbnailUrl || null,
          thumbnail_is_generated: false,
          duration_seconds: 0,
          is_live: false,
          stats_unknown: true,
          channel_id: v.channelId || null,
          category_id: v.categoryId ?? 'all',
          published_at: v.publishedAt,
          view_count: 0,
          like_count: 0,
          status: 'published',
          pinned: false,
          suggested: true,
          suggested_for: v.suggestedFor ?? null,
        })),
        { onConflict: 'id', ignoreDuplicates: true },
      )

    await markCache(seed.id, videos.length)
    return videos
  } catch {
    // Quota exhausted, network down, table missing: none of these should ever
    // interrupt playback.
    return []
  }
}

/** How many lookups the cache says have been spent recently, for the admin. */
export async function recentLookups(): Promise<number> {
  if (!supabase) return 0
  const since = new Date(Date.now() - 24 * 3600_000).toISOString()
  const { count } = await supabase
    .from('suggestion_cache')
    .select('*', { count: 'exact', head: true })
    .gte('fetched_at', since)
  return count ?? 0
}
