import { VideoCard } from './VideoCard'
import type { Video } from '../types'

/**
 * Responsive card grid. Column counts follow YouTube's own breakpoints,
 * measured against the content area rather than the viewport (container query),
 * so reflow stays correct when the guide expands.
 *
 * The first row loads eagerly, exactly as YouTube does — lazy-loading
 * above-the-fold thumbnails delays the very thing the viewer is looking at.
 */
const EAGER_COUNT = 4

export function VideoGrid({ videos, showAvatar = true }: { videos: Video[]; showAvatar?: boolean }) {
  return (
    <div className="@container">
      <div
        className="grid grid-cols-1 gap-x-4 gap-y-8 @[480px]:grid-cols-2 @[760px]:grid-cols-3 @[1100px]:grid-cols-4 @[1500px]:grid-cols-5"
      >
        {videos.map((v, i) => (
          <VideoCard key={v.id} video={v} showAvatar={showAvatar} priority={i < EAGER_COUNT} />
        ))}
      </div>
    </div>
  )
}
