import { Capacitor, registerPlugin } from '@capacitor/core'

/**
 * Native-shell integration.
 *
 * Everything here is a no-op in a normal browser and inside the installed PWA,
 * so the same bundle serves the web, the iPad and the Android APK.
 */

interface ThirdPartyCookiesResult {
  applied: boolean
  hasWebView: boolean
  acceptingCookies: boolean
}

interface ThirdPartyCookiesPlugin {
  setEnabled(): Promise<ThirdPartyCookiesResult>
  status(): Promise<ThirdPartyCookiesResult>
}

const ThirdPartyCookies = registerPlugin<ThirdPartyCookiesPlugin>('ThirdPartyCookies')

let lastCookieState: ThirdPartyCookiesResult | null = null

/**
 * Forces third-party cookies on, after the app is running.
 *
 * The plugin also does this in its own load(), but the WebView is not guaranteed
 * to exist at that point, so calling it here removes that doubt entirely. The
 * result is kept so the admin screen can show whether it actually took effect.
 */
export async function enableThirdPartyCookies(): Promise<ThirdPartyCookiesResult | null> {
  if (!Capacitor.isNativePlatform()) return null
  try {
    lastCookieState = await ThirdPartyCookies.setEnabled()
    return lastCookieState
  } catch {
    return null
  }
}

export function getCookieState(): ThirdPartyCookiesResult | null {
  return lastCookieState
}

export async function initNativeShell(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  // Third-party cookies first: embedded players depend on it.
  await enableThirdPartyCookies()

  try {
    // Dynamic import keeps the Capacitor bridge out of the web bundle.
    const { App } = await import('@capacitor/app')

    await App.addListener('backButton', ({ canGoBack }) => {
      // On Android the hardware back button would otherwise close the app from
      // any screen. Walk back through history instead, and only exit from Home.
      const atRoot = window.location.pathname === '/'
      if (!atRoot && (canGoBack || window.history.length > 1)) {
        window.history.back()
      } else {
        void App.exitApp()
      }
    })

    // Keep the status bar readable against the dark launch background.
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    await StatusBar.setStyle({ style: Style.Dark })
    await StatusBar.setBackgroundColor({ color: '#0f0f0f' })
  } catch {
    // A missing plugin is not worth breaking startup over.
  }
}
