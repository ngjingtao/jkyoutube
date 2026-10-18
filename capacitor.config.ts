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
  },
}

export default config
