import { bilibiliEmbedUrl } from '../../lib/bilibili'
import type { BilibiliRef } from '../../lib/format'

/**
 * Bilibili playback.
 *
 * This is a plain iframe to Bilibili's official embed player — the only
 * supported way to play their videos. Two consequences worth knowing:
 *
 *  - The controls, logo and quality menu belong to Bilibili. They cannot be
 *    restyled into YouTube's player without re-hosting their video streams,
 *    which this project deliberately does not do.
 *  - There is no scripting API for this embed, so there is no reliable
 *    "video ended" event. Autoplay-next therefore does not fire for Bilibili
 *    videos; the viewer picks the next video themselves.
 *
 * `danmaku=0` (set in bilibiliEmbedUrl) suppresses the scrolling bullet
 * comments, which is the most un-YouTube element of their player.
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
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        allowFullScreen
        scrolling="no"
        frameBorder={0}
      />
    </div>
  )
}
