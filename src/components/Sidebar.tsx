import { Link, useLocation } from 'react-router-dom'
import { useLibrary } from '../store/library'
import { classNames, formatSubscribers } from '../lib/format'
import { ChannelAvatar } from './ChannelAvatar'
import { UserAvatar } from './TopBar'
import type { IconProps } from './icons'
import {
  ChevronRightIcon,
  ClockIcon,
  DownloadIcon,
  FeedbackIcon,
  GamingIcon,
  HelpIcon,
  HistoryIcon,
  HomeFilledIcon,
  HomeIcon,
  LibraryFilledIcon,
  LibraryIcon,
  LikeFilledIcon,
  LikeIcon,
  MusicIcon,
  NewsIcon,
  PlaySquareFilledIcon,
  PlaySquareIcon,
  SettingsIcon,
  ShortsFilledIcon,
  ShortsIcon,
  SubscriptionsFilledIcon,
  SubscriptionsIcon,
  TrendingIcon,
  YouTubeLogo,
} from './icons'

interface NavItemProps {
  to: string
  label: string
  icon: (p: IconProps) => React.ReactElement
  activeIcon?: (p: IconProps) => React.ReactElement
  onClick?: () => void
}

function NavItem({ to, label, icon: Icon, activeIcon: ActiveIcon, onClick }: NavItemProps) {
  const { pathname, search } = useLocation()
  const [path, query] = to.split('?')
  const active = pathname === path && (!query || search.includes(query))

  const Glyph = active && ActiveIcon ? ActiveIcon : Icon

  return (
    <Link
      to={to}
      onClick={onClick}
      className={classNames(
        'mx-3 flex h-10 items-center gap-6 rounded-lg px-3 transition-colors',
        active ? 'bg-hover font-medium' : 'hover:bg-hover',
      )}
    >
      <Glyph size={24} />
      <span className="truncate text-[14px]">{label}</span>
    </Link>
  )
}

function MiniItem({ to, label, icon: Icon, onClick }: NavItemProps) {
  const { pathname } = useLocation()
  const active = pathname === to.split('?')[0]
  return (
    <Link
      to={to}
      onClick={onClick}
      className={classNames(
        'mx-1 flex flex-col items-center gap-1.5 rounded-lg py-4 transition-colors',
        active ? 'bg-hover' : 'hover:bg-hover',
      )}
    >
      <Icon size={24} />
      <span className="text-[10px] leading-3">{label}</span>
    </Link>
  )
}

function Divider() {
  return <hr className="my-3 border-0 border-t border-line" />
}

function SectionHeader({ label, to }: { label: string; to?: string }) {
  const content = (
    <span className="flex items-center gap-1 text-[16px] font-medium text-fg">
      {label}
      {to ? <ChevronRightIcon size={18} /> : null}
    </span>
  )
  return (
    <div className="mx-3 flex h-10 items-center rounded-lg px-3 hover:bg-hover">
      {to ? <Link to={to}>{content}</Link> : content}
    </div>
  )
}

const explore = [
  { to: '/feed/trending', label: 'Trending', icon: TrendingIcon },
  { to: '/feed/music', label: 'Music', icon: MusicIcon },
  { to: '/feed/gaming', label: 'Gaming', icon: GamingIcon },
  { to: '/feed/news', label: 'News', icon: NewsIcon },
]

/**
 * The full guide. On wide screens it renders either the 240px expanded list or
 * the 72px mini rail; on phones it is shown as an overlay drawer.
 */
export function Sidebar({
  expanded,
  onNavigate,
}: {
  /** When false the mini rail is rendered (wide screens only). */
  expanded: boolean
  onNavigate?: () => void
}) {
  const { channels, subscriptions } = useLibrary()

  if (!expanded) {
    return (
      <nav className="flex w-[72px] flex-col overflow-y-auto pb-4">
        <MiniItem to="/" label="Home" icon={HomeIcon} onClick={onNavigate} />
        <MiniItem to="/shorts" label="Shorts" icon={ShortsIcon} onClick={onNavigate} />
        <MiniItem
          to="/feed/subscriptions"
          label="Subscriptions"
          icon={SubscriptionsIcon}
          onClick={onNavigate}
        />
        <MiniItem to="/feed/library" label="You" icon={LibraryIcon} onClick={onNavigate} />
        <MiniItem to="/feed/downloads" label="Downloads" icon={DownloadIcon} onClick={onNavigate} />
      </nav>
    )
  }

  return (
    <nav className="flex w-60 flex-col overflow-y-auto pb-6">
      <div className="pt-3">
        <NavItem to="/" label="Home" icon={HomeIcon} activeIcon={HomeFilledIcon} onClick={onNavigate} />
        <NavItem to="/shorts" label="Shorts" icon={ShortsIcon} activeIcon={ShortsFilledIcon} onClick={onNavigate} />
        <NavItem
          to="/feed/subscriptions"
          label="Subscriptions"
          icon={SubscriptionsIcon}
          activeIcon={SubscriptionsFilledIcon}
          onClick={onNavigate}
        />
      </div>

      <Divider />

      <div>
        <SectionHeader label="You" to="/feed/you" />
        <NavItem to="/feed/you" label="Your channel" icon={PlaySquareIcon} activeIcon={PlaySquareFilledIcon} onClick={onNavigate} />
        <NavItem to="/feed/history" label="History" icon={HistoryIcon} onClick={onNavigate} />
        <NavItem to="/playlist/pl-watch-later" label="Watch later" icon={ClockIcon} onClick={onNavigate} />
        <NavItem to="/feed/liked" label="Liked videos" icon={LikeIcon} activeIcon={LikeFilledIcon} onClick={onNavigate} />
        <NavItem to="/feed/downloads" label="Downloads" icon={DownloadIcon} onClick={onNavigate} />
      </div>

      <Divider />

      <div>
        <SectionHeader label="Subscriptions" />
        {channels
          .filter((c) => subscriptions.includes(c.id))
          .map((c) => (
            <Link
              key={c.id}
              to={`/channel/${c.id}`}
              onClick={onNavigate}
              className="mx-3 flex h-10 items-center gap-6 rounded-lg px-3 hover:bg-hover"
            >
              <ChannelAvatar channel={c} size={24} />
              <span className="truncate text-[14px]">{c.name}</span>
            </Link>
          ))}
        {subscriptions.length === 0 ? (
          <p className="px-6 py-2 text-[13px] text-fg2">No subscriptions yet</p>
        ) : null}
      </div>

      <Divider />

      <div>
        <SectionHeader label="Explore" />
        {explore.map((item) => (
          <NavItem key={item.to} {...item} onClick={onNavigate} />
        ))}
      </div>

      <Divider />

      <div>
        <SectionHeader label="More from YouTube" />
        <NavItem to="/premium" label="YouTube Premium" icon={YouTubeMarkIcon} onClick={onNavigate} />
        <NavItem to="/music" label="YouTube Music" icon={MusicIcon} onClick={onNavigate} />
        <NavItem to="/kids" label="YouTube Kids" icon={ShortsIcon} onClick={onNavigate} />
      </div>

      <Divider />

      <div>
        <NavItem to="/account" label="Settings" icon={SettingsIcon} onClick={onNavigate} />
        <NavItem to="/help" label="Help" icon={HelpIcon} onClick={onNavigate} />
        <NavItem to="/feedback" label="Send feedback" icon={FeedbackIcon} onClick={onNavigate} />
      </div>

      <Divider />

      <div className="px-6 pb-4 text-[12px] leading-5 text-fg2">
        <p className="font-medium">
          About Press Copyright Contact us Creators Advertise Developers
        </p>
        <p className="mt-3 font-medium">Terms Privacy Policy &amp; Safety How YouTube works</p>
        <p className="mt-3 font-medium">Test new features</p>
        <p className="mt-4">© {new Date().getFullYear()} Google LLC</p>
      </div>
    </nav>
  )
}

/** Small monochrome YouTube mark, used for the Premium row. */
function YouTubeMarkIcon({ size = 24, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 29 20" width={size} height={(size * 20) / 29} aria-hidden="true" {...rest}>
      <path
        fill="currentColor"
        d="M28.4 3.1A3.6 3.6 0 0 0 25.9.6C23.8 0 14.5 0 14.5 0S5.2 0 3.1.6A3.6 3.6 0 0 0 .6 3.1C0 5.2 0 10 0 10s0 4.8.6 6.9a3.6 3.6 0 0 0 2.5 2.5c2.1.6 11.4.6 11.4.6s9.3 0 11.4-.6a3.6 3.6 0 0 0 2.5-2.5c.6-2.1.6-6.9.6-6.9s0-4.8-.6-6.9ZM11.6 14.3V5.7l7.6 4.3-7.6 4.3Z"
      />
    </svg>
  )
}

export { UserAvatar, formatSubscribers, YouTubeLogo }
