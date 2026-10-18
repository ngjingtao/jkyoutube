import { Link } from 'react-router-dom'

/**
 * Shorts shell. Rendering the vertical snap-feed is Phase 7; this keeps the
 * route and the guide entry working exactly as on YouTube.
 */
export function ShortsPage() {
  return (
    <div className="mx-auto max-w-[480px] px-6 py-24 text-center">
      <h1 className="text-[24px] font-bold text-fg">Shorts</h1>
      <p className="mt-3 text-[14px] leading-6 text-fg2">
        Shorts are not enabled yet. Vertical short-form playback is planned for a later phase.
      </p>
      <Link to="/" className="mt-6 inline-block text-[14px] font-medium text-[#065fd4]">
        Back to Home
      </Link>
    </div>
  )
}

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-[480px] px-6 py-24 text-center">
      <h1 className="text-[24px] font-bold text-fg">This page isn't available</h1>
      <p className="mt-3 text-[14px] text-fg2">
        The link may be broken, or the page may have been removed.
      </p>
      <Link to="/" className="mt-6 inline-block text-[14px] font-medium text-[#065fd4]">
        Go to Home
      </Link>
    </div>
  )
}
