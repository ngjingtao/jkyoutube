import { createContext, useContext } from 'react'
import { fetchSetting } from './remote'

/**
 * Which content the viewer routes show.
 *
 * `curated` is the library built in Admin. `youtube` keeps the same layout,
 * cards and player, but fills them from YouTube's own most-popular list. The
 * fetching and mapping live in youtubeFeed.ts.
 *
 * The setting is shared through Supabase (like `libraryMode`), so flipping it
 * on the PC applies to every device that opens the site. There is no switch on
 * the viewer side: a viewer only ever sees one of the two, never a control.
 */
export type ViewerMode = 'curated' | 'youtube'

/** Which content the viewer routes render. `/admin` is outside this. */
export const ViewerModeContext = createContext<ViewerMode>('curated')

export function useViewerMode(): ViewerMode {
  return useContext(ViewerModeContext)
}

export const NORMAL_YOUTUBE_URL = 'https://www.youtube.com/'

/**
 * True when the URL asks for the curated app even though Viewer mode is set to
 * normal YouTube.
 *
 * The admin needs this: `/admin` is never redirected, but "Open the app" would
 * otherwise leave the content manager for youtube.com. Add `?preview=curated`
 * to any viewer URL to look at the curated app without changing the setting.
 */
export function isCuratedPreview(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('preview') === 'curated'
}

/** The viewer URL that shows the curated app once, whatever Viewer mode says. */
export const CURATED_PREVIEW_PATH = '/?preview=curated'

/** Resolves `curated` on any failure, so a database hiccup never breaks the app. */
export async function fetchViewerMode(): Promise<ViewerMode> {
  try {
    const mode = await fetchSetting<ViewerMode>('viewerMode')
    return mode === 'youtube' ? 'youtube' : 'curated'
  } catch {
    return 'curated'
  }
}
