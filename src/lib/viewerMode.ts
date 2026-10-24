import { Capacitor } from '@capacitor/core'
import { isIOS } from './hooks'
import { fetchSetting } from './remote'

/**
 * Which experience the viewer devices open.
 *
 * `curated` is the JKYoutube app. `youtube` means the app deliberately hands
 * the screen over to the real youtube.com, using whichever Google account the
 * browser is already signed into.
 *
 * The setting is shared through Supabase (like `libraryMode`), so flipping it
 * on the PC applies to the iPad and the Android app. There is no switch on the
 * viewer side: the iPad only ever sees one of the two, never a control.
 *
 * YouTube's main site cannot be embedded — it refuses to render inside a
 * frame — so this is a navigation, not an in-app screen.
 */
export type ViewerMode = 'curated' | 'youtube'

export const NORMAL_YOUTUBE_URL = 'https://www.youtube.com/'

/**
 * True on the devices that are actually viewers rather than the admin's PC.
 *
 * The mode must not redirect the desktop browser the admin is working in, or
 * the "Open the app" link would leave the content manager for YouTube. An
 * installed PWA, the Capacitor APK and mobile browsers all count as viewers;
 * an ordinary desktop window does not.
 */
export function isViewerDevice(): boolean {
  if (typeof window === 'undefined') return false
  if (Capacitor.isNativePlatform()) return true
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  if (isIOS()) return true
  return /Android/i.test(navigator.userAgent)
}

/** Resolves `curated` on any failure, so a database hiccup never breaks the app. */
export async function fetchViewerMode(): Promise<ViewerMode> {
  try {
    const mode = await fetchSetting<ViewerMode>('viewerMode')
    return mode === 'youtube' ? 'youtube' : 'curated'
  } catch {
    return 'curated'
  }
}
