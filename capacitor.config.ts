import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Android wrapper configuration.
 *
 * The APK is a thin shell around the deployed web app rather than a bundled
 * copy of it, so content and UI changes ship without rebuilding the APK. That
 * is why `server.url` is set: Capacitor loads the remote site as the app origin
 * and injects its native bridge into it, which is what makes the hardware back
 * button work.
 *
 * Change the address by setting the APP_URL environment variable at build time
 * (the GitHub workflow reads it from the repository variable `APP_URL`).
 */
const APP_URL = process.env.APP_URL ?? 'https://jkyoutube.onrender.com'

const config: CapacitorConfig = {
  appId: 'com.jkyoutube.app',
  // The name shown under the launcher icon.
  appName: 'YouTube',
  webDir: 'dist',
  server: {
    url: APP_URL,
    androidScheme: 'https',
  },
  android: {
    // Matches YouTube's dark theme so there is no white flash on launch.
    backgroundColor: '#0f0f0f',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,

    // A DESKTOP user agent, deliberately.
    //
    // Bilibili's embed redirects any user agent containing "Mobile" to a
    // different player:
    //
    //   const isMobile = !!ua.match(/AppleWebKit.*Mobile.*/)
    //   if (isMobile) location.href = '//www.bilibili.com/blackboard/webplayer/mbplayer.html'
    //
    // That mobile player is built for full-screen phone browsing, not for being
    // framed on a third-party site, and it fails there. The stock Android
    // WebView user agent contains "Mobile", so the APK was getting the mobile
    // player — while desktop Chrome gets the embedded one, and iPad Safari
    // reports itself as "Macintosh" and therefore also gets the embedded one.
    // That matches exactly where playback worked and where it did not.
    //
    // The "; wv" token is gone as a side effect, which also avoids firewalls
    // that treat a WebView as a bot.
    overrideUserAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  },
}

export default config
