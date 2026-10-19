import type { Video } from '../types'

/**
 * Bilibili keyword search, via the Edge Function in
 * supabase/functions/bilibili-search.
 *
 * It cannot be called from the browser directly: Bilibili's search API sets
 * `Access-Control-Allow-Origin: https://www.bilibili.com`, so every other origin
 * is refused by CORS. The function relays it server-side and re-adds CORS.
 */

const PROJECT_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
  'https://iixacidjgxqqbhqgouvw.supabase.co'

export interface BilibiliSearchResult {
  bvid: string
  title: string
  description: string
  thumbnail: string
  author: string
  views: number
  publishedAt: string | null
  durationSeconds: number
  category: string | null
}

export class BilibiliSearchError extends Error {
  readonly hint: string
  constructor(message: string, hint = '') {
    super(message)
    this.name = 'BilibiliSearchError'
    this.hint = hint
  }
}

export async function searchBilibili(keyword: string, page = 1): Promise<BilibiliSearchResult[]> {
  const q = keyword.trim()
  if (!q) return []

  const url = `${PROJECT_URL}/functions/v1/bilibili-search?q=${encodeURIComponent(q)}&page=${page}`

  let res: Response
  try {
    res = await fetch(url)
  } catch {
    throw new BilibiliSearchError(
      'Could not reach the search function.',
      'Check that the bilibili-search Edge Function has been deployed in Supabase.',
    )
  }

  if (res.status === 404) {
    throw new BilibiliSearchError(
      'The bilibili-search function is not deployed.',
      'Supabase dashboard -> Edge Functions -> Deploy a new function, named bilibili-search, using the code in supabase/functions/bilibili-search/index.ts.',
    )
  }

  const text = await res.text()
  let payload: { results?: BilibiliSearchResult[]; error?: string }
  try {
    payload = JSON.parse(text)
  } catch {
    throw new BilibiliSearchError(
      `Search returned something unexpected (HTTP ${res.status}).`,
      'The function may have failed to start. Open its logs in the Supabase dashboard.',
    )
  }

  if (!res.ok) {
    throw new BilibiliSearchError(payload.error ?? `Search failed (HTTP ${res.status}).`)
  }

  return payload.results ?? []
}

/**
 * Turns a search hit into the shape addVideo expects.
 *
 * This is what makes the picker worth having: search returns the cover, the
 * duration, the uploader and the view count, none of which can be looked up from
 * a pasted BV link.
 */
export function resultToInput(result: BilibiliSearchResult) {
  return {
    url: `https://www.bilibili.com/video/${result.bvid}/`,
    title: result.title,
    description: result.description,
    authorName: result.author,
    thumbnailUrl: result.thumbnail,
    durationSeconds: result.durationSeconds,
    viewCount: result.views,
    ...(result.publishedAt ? { publishedAt: result.publishedAt } : {}),
  }
}

/** Preview card data, so the picker can show what addVideo would create. */
export function resultToVideoPreview(result: BilibiliSearchResult): Partial<Video> {
  return {
    title: result.title,
    thumbnailUrl: result.thumbnail,
    durationSeconds: result.durationSeconds,
    viewCount: result.views,
    publishedAt: result.publishedAt ?? new Date().toISOString(),
  }
}
