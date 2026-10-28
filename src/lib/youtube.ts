/**
 * YouTube Data API v3 client.
 *
 * Why this exists: the public oEmbed endpoint only returns a title, an author
 * name and a thumbnail. It has no view counts, no like counts, no subscriber
 * counts, no duration and no real publish date. All of that lives in the Data
 * API, which is why pasting a link without it produces "0 views • just now".
 *
 * Cost: `videos.list` and `channels.list` each cost 1 quota unit and accept up
 * to 50 ids per call, so enriching a whole library costs almost nothing. The
 * free daily allowance is 10,000 units.
 *
 * Security: this runs in the browser, so the key is visible to anyone who opens
 * the app. Restrict it in Google Cloud Console to the YouTube Data API *and* to
 * your site's HTTP referrers before using it on a public URL.
 */

const API_BASE = 'https://www.googleapis.com/youtube/v3'

export interface YtVideoMetadata {
  id: string
  title: string
  description: string
  channelId: string
  channelTitle: string
  publishedAt: string
  durationSeconds: number
  viewCount: number
  likeCount: number
  thumbnailUrl: string
  isLive: boolean
  /** YouTube's numeric category id, e.g. "10" for Music. */
  categoryId: string
  /** False when the owner disabled embedding; such videos cannot play here. */
  embeddable: boolean
}

export interface YtVideoCategory {
  id: string
  title: string
}

export interface YtChannelMetadata {
  id: string
  title: string
  handle: string
  description: string
  subscriberCount: number
  avatarUrl: string
  bannerUrl: string
}

/** Thrown for anything the admin needs to explain to the user. */
export class YouTubeApiError extends Error {
  readonly reason: string
  constructor(message: string, reason = 'unknown') {
    super(message)
    this.name = 'YouTubeApiError'
    this.reason = reason
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** "PT1H2M3S" -> 3723. "P1DT2H" -> 93600. Never throws. */
export function parseIsoDuration(iso: string | undefined): number {
  if (!iso) return 0
  const m = /^-?P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(iso)
  if (!m) return 0
  const [, d, h, min, s] = m
  return (
    Number(d ?? 0) * 86_400 +
    Number(h ?? 0) * 3600 +
    Number(min ?? 0) * 60 +
    Math.floor(Number(s ?? 0))
  )
}

/** Turns an API error body into something worth showing a human. */
async function toApiError(res: Response): Promise<YouTubeApiError> {
  let reason = 'unknown'
  let message = `YouTube returned ${res.status}.`
  try {
    const body = (await res.json()) as {
      error?: { message?: string; errors?: Array<{ reason?: string }> }
    }
    reason = body.error?.errors?.[0]?.reason ?? reason
    if (body.error?.message) message = body.error.message
  } catch {
    /* non-JSON error body */
  }

  if (res.status === 401) {
    return new YouTubeApiError('Your Google sign-in has expired. Sign in again.', 'unauthorized')
  }
  if (res.status === 400 && /API key not valid/i.test(message)) {
    return new YouTubeApiError('That API key was rejected by Google. Check it was copied whole.', 'keyInvalid')
  }
  if (res.status === 403) {
    if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
      return new YouTubeApiError(
        'The daily YouTube API quota is used up. It resets at midnight Pacific time.',
        'quotaExceeded',
      )
    }
    if (reason === 'ipRefererBlocked' || /referer/i.test(message)) {
      return new YouTubeApiError(
        'This API key is restricted to certain websites, and this address is not on the list. Add it as an allowed referrer in Google Cloud Console.',
        'refererBlocked',
      )
    }
    return new YouTubeApiError(
      'Google refused the request. The key may be restricted to a different API, or the YouTube Data API may not be enabled for this project.',
      reason,
    )
  }
  return new YouTubeApiError(message, reason)
}

export async function fetchVideoMetadata(
  videoIds: string[],
  apiKey: string,
): Promise<YtVideoMetadata[]> {
  const unique = [...new Set(videoIds.filter(Boolean))]
  if (unique.length === 0) return []
  const out: YtVideoMetadata[] = []

  for (const ids of chunk(unique, 50)) {
    const url = `${API_BASE}/videos?part=snippet,statistics,contentDetails,status&id=${ids.join(',')}&key=${encodeURIComponent(apiKey)}`
    const res = await fetch(url)
    if (!res.ok) throw await toApiError(res)
    const data = (await res.json()) as { items?: RawVideo[] }
    for (const item of data.items ?? []) out.push(mapVideo(item))
  }
  return out
}

export async function fetchChannelMetadata(
  channelIds: string[],
  apiKey: string,
): Promise<YtChannelMetadata[]> {
  const unique = [...new Set(channelIds.filter(Boolean))]
  if (unique.length === 0) return []
  const out: YtChannelMetadata[] = []

  for (const ids of chunk(unique, 50)) {
    const url = `${API_BASE}/channels?part=snippet,statistics&id=${ids.join(',')}&key=${encodeURIComponent(apiKey)}`
    const res = await fetch(url)
    if (!res.ok) throw await toApiError(res)
    const data = (await res.json()) as { items?: RawChannel[] }
    for (const item of data.items ?? []) out.push(mapChannel(item))
  }
  return out
}

/**
 * Signed-in calls use the OAuth token in a header instead of the API key.
 * Used for private data such as subscriptions and the liked-videos playlist.
 */
export async function fetchJsonAuthorized<T>(url: string, accessToken: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw await toApiError(res)
  return (await res.json()) as T
}

export async function fetchVideoMetadataAuthorized(
  videoIds: string[],
  accessToken: string,
): Promise<YtVideoMetadata[]> {
  const unique = [...new Set(videoIds.filter(Boolean))]
  if (unique.length === 0) return []
  const out: YtVideoMetadata[] = []
  for (const ids of chunk(unique, 50)) {
    const url = `${API_BASE}/videos?part=snippet,statistics,contentDetails,status&id=${ids.join(',')}`
    const data = await fetchJsonAuthorized<{ items?: RawVideo[] }>(url, accessToken)
    for (const item of data.items ?? []) out.push(mapVideo(item))
  }
  return out
}

export async function fetchChannelMetadataAuthorized(
  channelIds: string[],
  accessToken: string,
): Promise<YtChannelMetadata[]> {
  const unique = [...new Set(channelIds.filter(Boolean))]
  if (unique.length === 0) return []
  const out: YtChannelMetadata[] = []
  for (const ids of chunk(unique, 50)) {
    const url = `${API_BASE}/channels?part=snippet,statistics&id=${ids.join(',')}`
    const data = await fetchJsonAuthorized<{ items?: RawChannel[] }>(url, accessToken)
    for (const item of data.items ?? []) out.push(mapChannel(item))
  }
  return out
}

/**
 * YouTube's most-popular list for a region, in YouTube's own order.
 *
 * Cost: 1 unit. This is what fills Home while Viewer mode is "Normal YouTube":
 * it is real YouTube content, though not the personalised feed from youtube.com
 * (Google only serves that to a signed-in session on its own site).
 */
export async function fetchTrendingVideos(
  apiKey: string,
  regionCode = 'US',
): Promise<YtVideoMetadata[]> {
  const params = new URLSearchParams({
    part: 'snippet,statistics,contentDetails,status',
    chart: 'mostPopular',
    maxResults: '50',
    regionCode,
    key: apiKey,
  })
  const res = await fetch(`${API_BASE}/videos?${params.toString()}`)
  if (!res.ok) throw await toApiError(res)
  const data = (await res.json()) as { items?: RawVideo[] }
  // Embedding can be disabled per video; those would show a dead player.
  return (data.items ?? []).map(mapVideo).filter((v) => v.embeddable)
}

/** The category names YouTube uses in a region. Cost: 1 unit. */
export async function fetchVideoCategories(
  apiKey: string,
  regionCode = 'US',
): Promise<YtVideoCategory[]> {
  const params = new URLSearchParams({
    part: 'snippet',
    regionCode,
    key: apiKey,
  })
  const res = await fetch(`${API_BASE}/videoCategories?${params.toString()}`)
  if (!res.ok) throw await toApiError(res)
  const data = (await res.json()) as {
    items?: Array<{ id?: string; snippet?: { title?: string; assignable?: boolean } }>
  }
  return (data.items ?? [])
    .filter((item) => item.id && item.snippet?.assignable !== false)
    .map((item) => ({ id: item.id as string, title: item.snippet?.title ?? 'Videos' }))
}

export interface YtChannelWithVideos {
  channel: YtChannelMetadata
  videos: YtVideoMetadata[]
}

/**
 * A channel plus its recent uploads, for the channel page in Normal YouTube
 * mode. Cost: 3 units (channel, uploads playlist, then the video details).
 */
export async function fetchChannelUploads(
  channelId: string,
  apiKey: string,
): Promise<YtChannelWithVideos | null> {
  const channelUrl = `${API_BASE}/channels?part=snippet,statistics,brandingSettings,contentDetails&id=${encodeURIComponent(channelId)}&key=${encodeURIComponent(apiKey)}`
  const channelRes = await fetch(channelUrl)
  if (!channelRes.ok) throw await toApiError(channelRes)
  const channelData = (await channelRes.json()) as { items?: RawChannel[] }
  const raw = channelData.items?.[0]
  if (!raw) return null

  const channel = mapChannel(raw)
  const uploads = raw.contentDetails?.relatedPlaylists?.uploads
  if (!uploads) return { channel, videos: [] }

  const listUrl = `${API_BASE}/playlistItems?part=contentDetails&maxResults=50&playlistId=${encodeURIComponent(uploads)}&key=${encodeURIComponent(apiKey)}`
  const listRes = await fetch(listUrl)
  if (!listRes.ok) throw await toApiError(listRes)
  const listData = (await listRes.json()) as {
    items?: Array<{ contentDetails?: { videoId?: string } }>
  }
  const ids = (listData.items ?? [])
    .map((item) => item.contentDetails?.videoId)
    .filter((id): id is string => Boolean(id))

  const videos = ids.length ? await fetchVideoMetadata(ids, apiKey) : []
  return { channel, videos: videos.filter((v) => v.embeddable) }
}

/**
 * Search YouTube itself, for the app's search box in Normal YouTube mode.
 *
 * Cost: 100 units for the search plus 1 for the details, so callers must cache
 * the result aggressively. The free allowance is 10,000 units a day.
 */
export async function searchYouTubeVideos(
  query: string,
  apiKey: string,
  maxResults = 25,
): Promise<YtVideoMetadata[]> {
  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    maxResults: String(maxResults),
    q: query,
    videoEmbeddable: 'true',
    safeSearch: 'moderate',
    key: apiKey,
  })
  const res = await fetch(`${API_BASE}/search?${params.toString()}`)
  if (!res.ok) throw await toApiError(res)
  const data = (await res.json()) as {
    items?: Array<{ id?: { videoId?: string } }>
  }
  const ids = (data.items ?? [])
    .map((item) => item.id?.videoId)
    .filter((id): id is string => Boolean(id))
  return ids.length ? fetchVideoMetadata(ids, apiKey) : []
}

/** Cheapest possible call that proves a key works: 1 unit. */
export async function verifyApiKey(apiKey: string): Promise<void> {
  const url = `${API_BASE}/videos?part=id&chart=mostPopular&maxResults=1&key=${encodeURIComponent(apiKey)}`
  const res = await fetch(url)
  if (!res.ok) throw await toApiError(res)
}

/* ------------------------------------------------------------------ mapping */

interface RawVideo {
  id: string
  snippet?: {
    title?: string
    description?: string
    channelId?: string
    channelTitle?: string
    publishedAt?: string
    liveBroadcastContent?: string
    categoryId?: string
    thumbnails?: Record<string, { url?: string }>
  }
  statistics?: { viewCount?: string; likeCount?: string }
  contentDetails?: { duration?: string }
  status?: { embeddable?: boolean }
}

interface RawChannel {
  id: string
  snippet?: {
    title?: string
    customUrl?: string
    description?: string
    thumbnails?: Record<string, { url?: string }>
  }
  statistics?: { subscriberCount?: string }
  brandingSettings?: { image?: { bannerExternalUrl?: string } }
  contentDetails?: { relatedPlaylists?: { uploads?: string } }
}

function bestThumb(thumbs: Record<string, { url?: string }> | undefined): string {
  if (!thumbs) return ''
  for (const key of ['maxres', 'standard', 'high', 'medium', 'default']) {
    const url = thumbs[key]?.url
    if (url) return url
  }
  return ''
}

function mapVideo(item: RawVideo): YtVideoMetadata {
  const s = item.snippet ?? {}
  const liveState = s.liveBroadcastContent
  return {
    id: item.id,
    title: s.title ?? '',
    description: s.description ?? '',
    channelId: s.channelId ?? '',
    channelTitle: s.channelTitle ?? '',
    publishedAt: s.publishedAt ?? new Date().toISOString(),
    durationSeconds: parseIsoDuration(item.contentDetails?.duration),
    viewCount: Number(item.statistics?.viewCount ?? 0),
    likeCount: Number(item.statistics?.likeCount ?? 0),
    thumbnailUrl: bestThumb(s.thumbnails),
    isLive: liveState === 'live',
    categoryId: s.categoryId ?? '',
    embeddable: item.status?.embeddable !== false,
  }
}

function mapChannel(item: RawChannel): YtChannelMetadata {
  const s = item.snippet ?? {}
  return {
    id: item.id,
    title: s.title ?? '',
    handle: s.customUrl ? `@${s.customUrl.replace(/^@/, '')}` : '',
    description: s.description ?? '',
    subscriberCount: Number(item.statistics?.subscriberCount ?? 0),
    avatarUrl: bestThumb(s.thumbnails),
    bannerUrl: item.brandingSettings?.image?.bannerExternalUrl ?? '',
  }
}
