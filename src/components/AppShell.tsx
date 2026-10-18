import { useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { useMediaQuery } from '../lib/hooks'
import { classNames } from '../lib/format'

/**
 * Header + guide + content, reproducing YouTube's responsive guide behaviour:
 *   < 768px   no rail, hamburger opens an overlay drawer
 *   768-1312  permanent 72px mini rail
 *   >= 1313   permanent 240px guide, hamburger collapses it to the mini rail
 */
export function AppShell({ children }: { children: ReactNode }) {
  const isMedium = useMediaQuery('(min-width: 768px)')
  const isWide = useMediaQuery('(min-width: 1313px)')

  // User's explicit preference on wide screens: keep it collapsed to the rail.
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname, location.search])

  useEffect(() => {
    if (isMedium) setDrawerOpen(false)
  }, [isMedium])

  const expanded = isMedium && isWide && !collapsed

  function handleToggle() {
    if (!isMedium) setDrawerOpen((v) => !v)
    else setCollapsed((v) => !v)
  }

  return (
    <>
      <TopBar onToggleSidebar={handleToggle} />

      {isMedium ? (
        <div className="fixed bottom-0 left-0 top-14 z-40 bg-bg">
          <Sidebar expanded={expanded} />
        </div>
      ) : null}

      {!isMedium && drawerOpen ? (
        <>
          <button
            type="button"
            aria-label="Close guide"
            onClick={() => setDrawerOpen(false)}
            className="fixed inset-0 top-14 z-40 bg-black/50"
          />
          <div className="fixed bottom-0 left-0 top-14 z-50 w-60 overflow-y-auto bg-bg">
            <Sidebar expanded onNavigate={() => setDrawerOpen(false)} />
          </div>
        </>
      ) : null}

      <main className={classNames('pt-14', isMedium ? (expanded ? 'ml-60' : 'ml-[72px]') : 'ml-0')}>
        {children}
      </main>
    </>
  )
}
