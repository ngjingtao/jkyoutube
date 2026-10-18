import { bilibiliEmbedUrl } from '../../lib/bilibili'
import type { BilibiliRef } from '../../lib/format'

/**
 * Bilibili playback.
 *
 * This is a plain iframe to Bilibili's official embed player — the only
 * supported way to play their videos. Everything visible inside it belongs to
 * Bilibili and is rendered by their code in a cross-origin frame, so it cannot
 * be restyled, hidden or scripted from here.
 *
 * Two things were verified rather than assumed:
 *
 *  1. There is NO player parameter that hides their overlay UI. The classic
 *     NanoEmbed parameters (hideCoverInfo, noShareButton, hideDanmakuButton,
 *     noFullScreenButton, hideRecommend, autonext) are all absent from the
 *     current player bundle — zero occurrences — so passing them does nothing.
 *     Those overlays carry the uploader block, the follow button, "enter
 *     Bilibili", "watch in higher quality", "pop out this video", and the
 *     like/comment/share/more row, plus the end-screen recommendations.
 *
 *  2. Their bundle leaves the page with window.open(), from a click handler
 *     covering "play", "main" and "download" targets. The sandbox below omits
 *     allow-popups, which makes every one of those a no-op.
 *
 * Because the UI cannot be removed, it is blocked instead: a transparent shield
 * covers the whole player except a strip at the bottom, where the play/pause,
 * progress and fullscreen controls live. Every button listed above sits above
 * that strip, so none of them can be activated — including the end-screen
 * recommendations, which fill the middle of the frame once a video finishes.
 *
 * The trade-off is deliberate: tapping the middle of the video no longer pauses
 * it, because that area is shielded. Use the play/pause button in the control
 * bar. Blocking the viewer's escape is the higher priority here.
 *
 * `allow-same-origin` is required or the player loses its cookies and storage
 * and stops working, and it is safe on a cross-origin frame: the risky pairing
 * is allow-scripts + allow-same-origin on same-origin content.
 *
 * Known limit: this blocks pop-ups and clicks, not the frame navigating itself.
 * If Bilibili ever auto-advances at the end without a click, that cannot be
 * intercepted — there is no scripting API and no reliable ended event.
 */
export function BilibiliPlayer({
  bilibiliRef,
  autoplay = true,
  startSeconds = 0,
  className,
}: {
  bilibiliRef: BilibiliRef
  autoplay?: boolean
  startSeconds?: number
  className?: string
}) {
  const src = bilibiliEmbedUrl(bilibiliRef, { autoplay, startSeconds })

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
        Click shield. Transparent, and by default a positioned element still
        receives pointer events, so nothing underneath can be clicked. The gap
        at the bottom is the player's own control bar.
      */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 z-10"
        style={{ bottom: 'max(56px, 15%)' }}
      />
    </div>
  )
}
