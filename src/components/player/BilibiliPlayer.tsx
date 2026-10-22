import { bilibiliEmbedUrl } from '../../lib/bilibili'
import type { BilibiliRef } from '../../lib/format'
import { useWakeLock } from '../../lib/wakelock'

/**
 * Bilibili playback.
 *
 * This is a plain iframe to Bilibili's official embed player — the only
 * supported way to play their videos. Everything inside it belongs to Bilibili
 * and is rendered by their code in a cross-origin frame.
 *
 * Verified, not assumed: there is NO way to control this player.
 *   - `window.addEventListener("message")` occurs zero times in their bundle, so
 *     it does not accept commands from the parent page. The two
 *     `addEventListener("message")` hits are a setImmediate polyfill and a
 *     `MediaKeySession` DRM handler, unrelated to playback.
 *   - it does not post to the parent either, so there is no way to detect that a
 *     video ended.
 *   - the classic NanoEmbed parameters that used to hide their overlay UI
 *     (hideCoverInfo, noShareButton, hideDanmakuButton, noFullScreenButton,
 *     hideRecommend, autonext) occur zero times in the current bundle.
 *
 * The consequence is a genuine trade-off with no clever way around it, because
 * their player already implements YouTube's shortcuts — single click to
 * play/pause, double click for fullscreen — and any overlay we place intercepts
 * them before they reach it.
 *
 * So the shield covers ONLY the top band, where their hover overlay lives: the
 * uploader block, the follow button, "enter Bilibili", "watch in higher
 * quality" and "pop out this video". Those are the one-click ways out, and they
 * stay blocked. Everything below is left alone, so the shortcuts work and the
 * control bar is untouched.
 *
 * What this gives up: the recommendations shown when a video finishes fill the
 * middle of the frame, so they are clickable again. Their pop-ups stay blocked by
 * the sandbox, but a link that navigates inside the frame will load Bilibili
 * within the app rather than in a new tab.
 *
 * Double clicking the shielded band triggers our own fill-screen mode, since the
 * click there cannot reach the player. That matters on iOS, where the player's
 * own fullscreen does not work at all.
 *
 * The trade-off in one line: previously nothing could be clicked and the player
 * felt dead; now the shortcuts behave like YouTube and the end-of-video
 * recommendations are reachable.
 */
export function BilibiliPlayer({
  bilibiliRef,
  autoplay = false,
  startSeconds = 0,
  onBlockedClick,
  onToggleFullscreen,
  className,
}: {
  bilibiliRef: BilibiliRef
  /**
   * Off by default, and deliberately so on iOS.
   *
   * iOS refuses to autoplay media with sound, so a player told to autoplay
   * responds by muting itself — which is exactly the "it opens muted on the iPad
   * but not on the PC" report. On iOS playback therefore waits for a tap, which
   * gives the browser a user gesture to attach audio to.
   *
   * Everywhere else autoplay is safe: Chrome allows it, and the Android WebView
   * has the gesture requirement switched off by Capacitor. The caller decides,
   * via isIOS(), so the tablet gets a silent-free experience and the phone still
   * starts straight away.
   */
  autoplay?: boolean
  startSeconds?: number
  /** Called when the viewer clicks the shielded band. */
  onBlockedClick?: () => void
  /** Called on double click of the shielded band. */
  onToggleFullscreen?: () => void
  className?: string
}) {
  const src = bilibiliEmbedUrl(bilibiliRef, { autoplay, startSeconds })

  // Held for the whole life of the watch page, not just while "playing": the
  // Bilibili embed exposes no playback events at all (see above), so there is
  // no way to know when it pauses. The viewer opened a watch page, which is
  // the closest available signal that the screen should stay on.
  useWakeLock(true)

  return (
    <div className={`relative ${className ?? ''}`}>
      <iframe
        src={src}
        title="Bilibili video player"
        className="h-full w-full border-0 bg-black"
        sandbox="allow-scripts allow-same-origin allow-presentation"
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        allowFullScreen
        scrolling="no"
        frameBorder={0}
      />

      {/*
        Transparent band over their hover overlay. A positioned element receives
        pointer events by default, so nothing underneath can be clicked, and
        clicks here are recorded as blocked attempts.
      */}
      <div
        aria-hidden="true"
        onClick={onBlockedClick}
        onDoubleClick={onToggleFullscreen}
        className="absolute inset-x-0 top-0 z-10 h-[22%] cursor-default"
      />
    </div>
  )
}
