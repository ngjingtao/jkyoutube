/**
 * Core domain types.
 *
 * `sourceType` is an enum from day one so that adding real uploaded files
 * (or HLS streams) later is a small change rather than a rewrite.
 */

export type SourceType = 'youtube' | 'mp4' | 'hls'

export type VideoStatus = 'draft' | 'published'

export interface Channel {
  id: string
  name: string
  handle: string
  avatarUrl: string
  bannerUrl?: string
  description?: string
  subscriberCount?: number
  verified?: boolean
}

export interface Video {
  id: string
  title: string
  description: string
  sourceType: SourceType
  /** Original link the admin pasted. */
  sourceUrl: string
  /** Present when sourceType is 'youtube'. */
  youtubeId?: string
  /** Set to false when the owner disabled embedding — handled at runtime. */
  embeddable?: boolean
  thumbnailUrl: string
  durationSeconds: number
  channelId: string
  categoryId?: string
  publishedAt: string
  viewCount: number
  likeCount?: number
  status: VideoStatus
  pinned?: boolean
}

export interface Category {
  id: string
  name: string
}

export interface Playlist {
  id: string
  title: string
  description?: string
  channelId?: string
  videoIds: string[]
  updatedAt: string
}

export interface WatchProgress {
  videoId: string
  positionSeconds: number
  watchedAt: string
}
