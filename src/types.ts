/**
 * Core domain types.
 *
 * `sourceType` is an enum from day one so that adding real uploaded files
 * (or HLS streams) later is a small change rather than a rewrite.
 */

export type SourceType = 'youtube' | 'bilibili' | 'mp4' | 'hls'

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
  /**
   * Present when sourceType is 'bilibili' — the storage id, e.g. `BV1GJ411x7h7`
   * or `av12345`, with `-p2` appended for multi-part videos.
   */
  bilibiliId?: string
  /** True when `thumbnailUrl` is a generated stand-in rather than a real image. */
  thumbnailIsGenerated?: boolean
  /** Set to false when the owner disabled embedding — handled at runtime. */
  embeddable?: boolean
  thumbnailUrl: string
  durationSeconds: number
  channelId: string
  categoryId?: string
  publishedAt: string
  viewCount: number
  likeCount?: number
  /** True only for an actual live stream; duration 0 alone does not mean live. */
  isLive?: boolean
  /**
   * True when the view count and upload date are genuinely unknown (Bilibili,
   * whose API is unreachable). The UI omits those figures rather than printing
   * a misleading "0 views • just now".
   */
  statsUnknown?: boolean
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
