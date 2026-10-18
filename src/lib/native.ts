import { Capacitor } from '@capacitor/core'

/**
 * Native-shell integration.
 *
 * Everything here is a no-op in a normal browser and inside the installed PWA,
 * so the same bundle serves the web, the iPad and the Android APK.
 */
export async function initNativeShell(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

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
