import { fetchSetting } from './remote'

/**
 * Which experience the site opens.
 *
 * `curated` is the JKYoutube app. `youtube` means the app deliberately hands
 * the screen over to the real youtube.com, using whichever Google account the
 * browser is already signed into.
 *
 * The setting is shared through Supabase (like `libraryMode`), so flipping it
 * on the PC applies to every device that opens the site. There is no switch on
 * the viewer side: a viewer only ever sees one of the two, never a control.
 *
 * YouTube's main site cannot be embedded — it refuses to render inside a
 * frame — so this is a navigation, not an in-app screen.
 */
export type ViewerMode = 'curated' | 'youtube'

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
