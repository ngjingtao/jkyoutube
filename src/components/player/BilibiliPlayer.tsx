import { bilibiliEmbedUrl } from '../../lib/bilibili'
import type { BilibiliRef } from '../../lib/format'

/**
 * Bilibili playback.
 *
 * This is a plain iframe to Bilibili's official embed player — the only
 * supported way to play their videos. Three consequences worth knowing:
 *
 *  - The controls, logo and quality menu belong to Bilibili. They cannot be
 *    restyled into YouTube's player without re-hosting their video streams,
 *    which this project deliberately does not do.
 *  - There is no scripting API, so there is no reliable "video ended" event.
 *    Autoplay-next therefore does not fire for Bilibili videos.
 *  - `danmaku=0` (set in bilibiliEmbedUrl) suppresses the scrolling bullet
 *    comments, which is the most un-YouTube element of their player.
 *
 * The `sandbox` attribute is the one lever we have over its behaviour. Their
 * bundle leaves the page with `window.open()` — in a click handler that handles
 * `"play"`, `"main"` and `"download"` targets, i.e. the related-video and logo
 * links. Omitting `allow-popups` makes every one of those a no-op, so a click
 * cannot drop the viewer onto the real bilibili.com.
 *
 * `allow-same-origin` is required or the player loses its cookies and storage
 * and stops working, and it is safe here because the frame is cross-origin:
 * the risky combination is `allow-scripts` + `allow-same-origin` on
 * same-origin content.
 *
 * Known limit: this blocks pop-ups, not the frame navigating *itself*. If a
 * link loads a page inside the frame, the viewer sees Bilibili inside the app
 * rather than in a new tab.
 */
export function BilibiliPlayer({
  bilibiliRef,
  autoplay = false,
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
    <div className={className}>
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
    </div>
  )
}
