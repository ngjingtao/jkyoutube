/**
 * Bilibili search proxy.
 *
 * Why this exists: Bilibili's search API returns
 * `Access-Control-Allow-Origin: https://www.bilibili.com`, so a browser page on
 * any other origin is refused by CORS. The data is public, but only readable
 * from a same-origin context, which rules out calling it from the app directly.
 *
 * Verified before building this:
 *   /x/web-interface/search/type      -> HTTP 412 (risk control)
 *   /x/web-interface/wbi/search/type  -> HTTP 200, code 0, 20 results
 * so this proxies the wbi variant.
 *
 * Nothing secret is used: no cookies, no tokens, no API key. It only relays a
 * public search, and it strips the fields the app does not need.
 *
 * Deploy: Supabase dashboard -> Edge Functions -> Deploy a new function ->
 * name it `bilibili-search` -> replace the code with this file -> Deploy.
 */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

// Public search results, so any origin may read them.
const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

interface RawResult {
  bvid?: string
  title?: string
  description?: string
  pic?: string
  author?: string
  play?: number
  pubdate?: number
  duration?: string
  typename?: string
}

/** Bilibili highlights matches with <em> tags, and escapes HTML entities. */
function cleanTitle(raw: string | undefined): string {
  if (!raw) return ''
  return raw
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .trim()
}

/** Cover URLs come back protocol-relative: //i0.hdslb.com/... */
function cleanPic(raw: string | undefined): string {
  if (!raw) return ''
  const url = raw.startsWith('//') ? `https:${raw}` : raw
  // Ask for a sane size rather than the full original.
  return url.replace(/@[^/]*$/, '') + '@480w_270h_1c.webp'
}

function durationToSeconds(value: string | undefined): number {
  if (!value) return 0
  const parts = value.split(':').map((p) => Number(p))
  if (parts.some((n) => !Number.isFinite(n))) return 0
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return 0
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const url = new URL(req.url)
    const q = (url.searchParams.get('q') ?? '').trim()
    const page = Math.max(1, Math.min(5, Number(url.searchParams.get('page') ?? 1) || 1))

    if (q.length < 1) {
      return new Response(JSON.stringify({ error: 'missing q' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const target =
      'https://api.bilibili.com/x/web-interface/wbi/search/type' +
      `?search_type=video&page=${page}&keyword=${encodeURIComponent(q)}`

    const upstream = await fetch(target, {
      headers: {
        'User-Agent': UA,
        Referer: 'https://www.bilibili.com/',
        Origin: 'https://www.bilibili.com',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        Accept: 'application/json',
      },
    })

    if (!upstream.ok) {
      return new Response(
        JSON.stringify({
          error: `Bilibili answered ${upstream.status}. Its risk control sometimes blocks datacentre addresses; try again in a moment.`,
        }),
        { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } },
      )
    }

    const body = await upstream.json()

    if (body?.code !== 0) {
      return new Response(
        JSON.stringify({
          error: `Bilibili returned code ${body?.code ?? '?'}: ${body?.message ?? 'no message'}`,
        }),
        { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } },
      )
    }

    const raw: RawResult[] = body?.data?.result ?? []
    const results = raw
      .filter((r) => r.bvid)
      .map((r) => ({
        bvid: r.bvid as string,
        title: cleanTitle(r.title),
        description: cleanTitle(r.description),
        thumbnail: cleanPic(r.pic),
        author: cleanTitle(r.author),
        views: Number(r.play ?? 0),
        publishedAt: r.pubdate ? new Date(r.pubdate * 1000).toISOString() : null,
        durationSeconds: durationToSeconds(r.duration),
        category: r.typename ?? null,
      }))

    return new Response(JSON.stringify({ results }), {
      headers: {
        ...CORS,
        'Content-Type': 'application/json',
        // Search results change slowly and the proxy is only used from the admin
        // screen, so a short cache keeps repeated lookups off Bilibili.
        'Cache-Control': 'public, max-age=300',
      },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'unknown error' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  }
})
