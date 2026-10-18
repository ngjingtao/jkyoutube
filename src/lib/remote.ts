import { supabase, supabaseConfigured } from './supabase'
import type { Channel, SourceType, Video, VideoStatus } from '../types'

/**
 * Reads and writes the shared library in Supabase.
 *
 * Row shape is snake_case (Postgres convention); the app uses camelCase, so
 * mapping happens here and nowhere else.
 */

interface VideoRow {
  id: string
  title: string
  description: string | null
  source_type: SourceType
  source_url: string
  youtube_id: string | null
  bilibili_id: string | null
  thumbnail_url: string | null
  thumbnail_is_generated: boolean
  duration_seconds: number
  is_live: boolean
  stats_unknown: boolean
  channel_id: string | null
  category_id: string | null
  published_at: string
  view_count: number | string
  like_count: number | string
  status: VideoStatus
  pinned: boolean
}

interface ChannelRow {
  id: string
  name: string
  handle: string | null
  avatar_url: string | null
  banner_url: string | null
  description: string | null
  subscriber_count: number | null
}

function toVideo(row: VideoRow): Video {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    sourceType: row.source_type,
    sourceUrl: row.source_url,
    ...(row.youtube_id ? { youtubeId: row.youtube_id } : {}),
    ...(row.bilibili_id ? { bilibiliId: row.bilibili_id } : {}),
    thumbnailUrl: row.thumbnail_url ?? '',
    thumbnailIsGenerated: row.thumbnail_is_generated,
    durationSeconds: row.duration_seconds,
    isLive: row.is_live,
    statsUnknown: row.stats_unknown,
    channelId: row.channel_id ?? '',
    categoryId: row.category_id ?? 'all',
    publishedAt: row.published_at,
    viewCount: Number(row.view_count ?? 0),
    likeCount: Number(row.like_count ?? 0),
    status: row.status,
    pinned: row.pinned,
  }
}

function fromVideo(video: Video): VideoRow {
  return {
    id: video.id,
    title: video.title,
    description: video.description ?? '',
    source_type: video.sourceType,
    source_url: video.sourceUrl,
    youtube_id: video.youtubeId ?? null,
    bilibili_id: video.bilibiliId ?? null,
    thumbnail_url: video.thumbnailUrl ?? null,
    thumbnail_is_generated: video.thumbnailIsGenerated ?? false,
    duration_seconds: video.durationSeconds ?? 0,
    is_live: video.isLive ?? false,
    stats_unknown: video.statsUnknown ?? false,
    channel_id: video.channelId || null,
    category_id: video.categoryId ?? 'all',
    published_at: video.publishedAt,
    view_count: video.viewCount ?? 0,
    like_count: video.likeCount ?? 0,
    status: video.status,
    pinned: video.pinned ?? false,
  }
}

function toChannel(row: ChannelRow): Channel {
  return {
    id: row.id,
    name: row.name,
    handle: row.handle ?? '',
    avatarUrl: row.avatar_url ?? '',
    ...(row.banner_url ? { bannerUrl: row.banner_url } : {}),
    description: row.description ?? '',
    ...(row.subscriber_count !== null ? { subscriberCount: row.subscriber_count } : {}),
  }
}

function fromChannel(channel: Channel): ChannelRow {
  return {
    id: channel.id,
    name: channel.name,
    handle: channel.handle || null,
    avatar_url: channel.avatarUrl || null,
    banner_url: channel.bannerUrl ?? null,
    description: channel.description ?? '',
    subscriber_count: channel.subscriberCount ?? null,
  }
}

/** Turns a PostgREST failure into something worth showing a person. */
function toError(error: { message: string; code?: string }, action: string): Error {
  const code = error.code ?? ''
  if (code === '42P01' || error.message.includes('Could not find the table')) {
    return new Error(
      `${action} failed because the database tables do not exist yet. Run supabase/schema.sql in the Supabase SQL editor.`,
    )
  }
  if (code === '42501' || error.message.includes('row-level security')) {
    return new Error(`${action} was blocked by the database. Sign in with your admin account first.`)
  }
  if (code === '23505') {
    return new Error('That video is already in the shared library.')
  }
  return new Error(`${action} failed: ${error.message}`)
}

export interface RemoteLibrary {
  videos: Video[]
  channels: Channel[]
}

export async function fetchLibrary(): Promise<RemoteLibrary> {
  if (!supabase) throw new Error('Supabase is not configured.')
  const client = supabase

  const [channelsRes, videosRes] = await Promise.all([
    client.from('channels').select('*'),
    client.from('videos').select('*').order('published_at', { ascending: false }),
  ])
  if (channelsRes.error) throw toError(channelsRes.error, 'Loading channels')
  if (videosRes.error) throw toError(videosRes.error, 'Loading videos')

  return {
    channels: (channelsRes.data as ChannelRow[]).map(toChannel),
    videos: (videosRes.data as VideoRow[]).map(toVideo),
  }
}

export async function upsertChannels(channels: Channel[]): Promise<void> {
  if (!supabase || channels.length === 0) return
  const { error } = await supabase
    .from('channels')
    .upsert(channels.map(fromChannel), { onConflict: 'id' })
  if (error) throw toError(error, 'Saving channels')
}

export async function upsertVideos(videos: Video[]): Promise<void> {
  if (!supabase || videos.length === 0) return
  const { error } = await supabase
    .from('videos')
    .upsert(videos.map(fromVideo), { onConflict: 'id' })
  if (error) throw toError(error, 'Saving videos')
}

export async function patchVideoRow(id: string, patch: Partial<Video>): Promise<void> {
  if (!supabase) return
  const row: Record<string, unknown> = {}
  const map: Record<string, string> = {
    title: 'title',
    description: 'description',
    thumbnailUrl: 'thumbnail_url',
    durationSeconds: 'duration_seconds',
    viewCount: 'view_count',
    likeCount: 'like_count',
    publishedAt: 'published_at',
    isLive: 'is_live',
    statsUnknown: 'stats_unknown',
    categoryId: 'category_id',
    channelId: 'channel_id',
    status: 'status',
    pinned: 'pinned',
  }
  for (const [key, column] of Object.entries(map)) {
    if (key in patch) row[column] = (patch as Record<string, unknown>)[key]
  }
  if (Object.keys(row).length === 0) return

  const { error } = await supabase.from('videos').update(row).eq('id', id)
  if (error) throw toError(error, 'Updating the video')
}

export async function deleteVideoRow(id: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('videos').delete().eq('id', id)
  if (error) throw toError(error, 'Deleting the video')
}

export async function deleteAllUserVideos(ids: string[]): Promise<void> {
  if (!supabase || ids.length === 0) return
  const { error } = await supabase.from('videos').delete().in('id', ids)
  if (error) throw toError(error, 'Clearing the library')
}

/* ------------------------------------------------------------- settings --- */

export async function fetchSetting<T>(key: string): Promise<T | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('settings').select('value').eq('key', key).maybeSingle()
  if (error) return null // a missing settings table must not break the app
  return (data?.value as T) ?? null
}

export async function saveSetting(key: string, value: unknown): Promise<void> {
  if (!supabase) return
  const { error } = await supabase
    .from('settings')
    .upsert({ key, value }, { onConflict: 'key' })
  if (error) throw toError(error, 'Saving the setting')
}

/* ----------------------------------------------------------------- auth --- */

export async function getSessionEmail(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.user.email ?? null
}

export async function signIn(email: string, password: string): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    if (/invalid login credentials/i.test(error.message)) {
      throw new Error('That email or password is not right.')
    }
    if (/email not confirmed/i.test(error.message)) {
      throw new Error('That account has not been confirmed yet. Confirm it in Supabase, or recreate it with "Auto Confirm User" ticked.')
    }
    throw new Error(error.message)
  }
}

export async function signOut(): Promise<void> {
  if (!supabase) return
  await supabase.auth.signOut()
}

export { supabaseConfigured }
