import { channelAvatar } from '../data/mock'
import { classNames } from '../lib/format'
import type { Channel } from '../types'

/** Circular channel avatar at YouTube's standard 36px (card) / 40px (watch). */
export function ChannelAvatar({
  channel,
  size = 36,
  className,
}: {
  channel?: Channel
  size?: number
  className?: string
}) {
  if (!channel) return null
  return (
    <img
      src={channelAvatar(channel)}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={classNames('shrink-0 rounded-full object-cover', className)}
      style={{ width: size, height: size }}
    />
  )
}
