import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../lib/hooks'
import { classNames } from '../lib/format'
import {
  BackIcon,
  BellIcon,
  CloseIcon,
  CreateIcon,
  MenuIcon,
  MicIcon,
  MoonIcon,
  SearchIcon,
  SunIcon,
  YouTubeLogo,
} from './icons'

/**
 * Optional country superscript beside the logo (YouTube shows the account
 * region there in most markets). Set to a two-letter code, or '' to hide.
 */
const LOGO_COUNTRY_CODE = ''

function UserAvatar({ size = 32 }: { size?: number }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size * 2}" height="${size * 2}">
    <rect width="100%" height="100%" fill="#7b5cff"/>
    <text x="50%" y="52%" font-family="Roboto,Arial,sans-serif" font-size="${size}"
      font-weight="500" fill="#fff" text-anchor="middle" dominant-baseline="central">J</text>
  </svg>`
  return (
    <img
      src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`}
      alt="Account"
      width={size}
      height={size}
      className="rounded-full"
      style={{ width: size, height: size }}
    />
  )
}

export function TopBar({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const navigate = useNavigate()
  const { resolved, toggle } = useTheme()
  const [query, setQuery] = useState('')
  const [mobileSearch, setMobileSearch] = useState(false)
  const mobileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (mobileSearch) mobileInputRef.current?.focus()
  }, [mobileSearch])

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    setMobileSearch(false)
    navigate(`/results?search_query=${encodeURIComponent(q)}`)
  }

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 flex items-center gap-2 bg-bg px-4"
      style={{ height: 'var(--app-header-h)', paddingTop: 'var(--app-safe-top)' }}
    >
      {/* -------------------------------------------------- left: logo */}
      <div className="flex min-w-0 items-center gap-4 md:flex-1">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Guide"
          className="yt-icon-btn h-10 w-10 shrink-0"
        >
          <MenuIcon size={24} />
        </button>

        <button
          type="button"
          onClick={() => navigate('/')}
          aria-label="YouTube Home"
          className="flex shrink-0 items-center"
        >
          <YouTubeLogo height={20} />
          {LOGO_COUNTRY_CODE ? (
            <span
              className="ml-0.5 text-fg2"
              style={{ fontSize: 10, alignSelf: 'flex-start', marginTop: 0 }}
            >
              {LOGO_COUNTRY_CODE}
            </span>
          ) : null}
        </button>
      </div>

      {/* ------------------------------------------------ center: search */}
      <div className="hidden flex-1 justify-center md:flex">
        <form onSubmit={submitSearch} className="flex w-full max-w-[732px] items-center">
          <div className="relative flex h-10 flex-1 items-center">
            <div className="pointer-events-none absolute left-4 flex items-center text-fg2">
              <SearchIcon size={20} />
            </div>
            <input
              type="search"
              name="search_query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              autoComplete="off"
              className="h-10 w-full rounded-l-full border border-line bg-search pl-11 pr-4 text-[16px] text-fg outline-none placeholder:text-fg2 focus:border-[#1c62b9]"
            />
          </div>
          <button
            type="submit"
            aria-label="Search"
            className="h-10 w-16 shrink-0 rounded-r-full border border-l-0 border-line bg-search-btn text-fg hover:bg-chip-hover"
          >
            <span className="flex justify-center">
              <SearchIcon size={24} />
            </span>
          </button>
        </form>

        <button
          type="button"
          aria-label="Search with your voice"
          className="yt-icon-btn ml-3 h-10 w-10 shrink-0 bg-chip"
        >
          <MicIcon size={22} />
        </button>
      </div>

      {/* -------------------------------------------------- right: actions */}
      <div className="ml-auto flex items-center gap-1 md:ml-0 md:flex-1 md:justify-end">
        <button
          type="button"
          aria-label="Search"
          onClick={() => setMobileSearch(true)}
          className="yt-icon-btn h-10 w-10 md:hidden"
        >
          <SearchIcon size={22} />
        </button>

        <button
          type="button"
          aria-label={resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={toggle}
          className="yt-icon-btn hidden h-10 w-10 md:inline-flex"
        >
          {resolved === 'dark' ? <SunIcon size={22} /> : <MoonIcon size={22} />}
        </button>

        <button type="button" aria-label="Create" className="yt-icon-btn hidden h-10 w-10 md:inline-flex">
          <CreateIcon size={24} />
        </button>

        <button type="button" aria-label="Notifications" className="yt-icon-btn h-10 w-10">
          <BellIcon size={22} />
        </button>

        <button type="button" aria-label="Account" className="ml-1 flex h-8 w-8 items-center justify-center">
          <UserAvatar size={32} />
        </button>
      </div>

      {/* Mobile full-width search overlay */}
      {mobileSearch ? (
        <div className="absolute inset-0 z-50 flex items-center gap-2 bg-bg px-2 md:hidden">
          <button
            type="button"
            aria-label="Back"
            onClick={() => setMobileSearch(false)}
            className="yt-icon-btn h-10 w-10 shrink-0"
          >
            <BackIcon size={24} />
          </button>
          <form onSubmit={submitSearch} className="flex flex-1 items-center">
            <input
              ref={mobileInputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="h-10 w-full rounded-full border border-line bg-search px-4 text-[16px] text-fg outline-none placeholder:text-fg2 focus:border-[#1c62b9]"
            />
          </form>
          {query ? (
            <button
              type="button"
              aria-label="Clear"
              onClick={() => setQuery('')}
              className="yt-icon-btn h-10 w-10 shrink-0"
            >
              <CloseIcon size={24} />
            </button>
          ) : (
            <button type="button" aria-label="Search with your voice" className="yt-icon-btn h-10 w-10 shrink-0">
              <MicIcon size={22} />
            </button>
          )}
        </div>
      ) : null}
    </header>
  )
}

export { UserAvatar }
