import { useCallback, useEffect, useState } from 'react'

/** Persisted state that survives reloads and works inside the installed PWA. */
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key)
      return raw === null ? initial : (JSON.parse(raw) as T)
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* storage full or blocked — non-fatal */
    }
  }, [key, value])

  return [value, setValue] as const
}

export type Theme = 'light' | 'dark' | 'system'

/** Applies the theme class to <html> and keeps the browser UI colour in sync. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const stored = window.localStorage.getItem('theme')
      return stored === 'dark' || stored === 'light' ? stored : 'system'
    } catch {
      return 'system'
    }
  })

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches)
      document.documentElement.classList.toggle('dark', dark)
    }
    apply()
    if (theme !== 'system') return
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])

  useEffect(() => {
    try {
      if (theme === 'system') window.localStorage.removeItem('theme')
      else window.localStorage.setItem('theme', theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  const resolved: 'light' | 'dark' =
    theme === 'system'
      ? typeof window !== 'undefined' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme

  const toggle = useCallback(() => {
    setTheme(resolved === 'dark' ? 'light' : 'dark')
  }, [resolved])

  return { theme, setTheme, resolved, toggle }
}

/** Tailwind-style min-width media query hook. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  )
  useEffect(() => {
    const media = window.matchMedia(query)
    const handler = () => setMatches(media.matches)
    handler()
    media.addEventListener('change', handler)
    return () => media.removeEventListener('change', handler)
  }, [query])
  return matches
}

/** True on devices without a precise pointer (iPad, Android phone). */
export function useTouchDevice(): boolean {
  return useMediaQuery('(hover: none) and (pointer: coarse)')
}

/**
 * True on iOS and iPadOS.
 *
 * The second check matters: since iPadOS 13, an iPad reports its platform as
 * "MacIntel" and is only distinguishable by the touch point count. Without it,
 * an iPad looks like a desktop Mac and gets desktop behaviour.
 *
 * Used to decide whether media may autoplay. iOS refuses to autoplay media with
 * sound, so a player told to autoplay responds by muting itself — which is worth
 * avoiding rather than silently shipping a video that opens silent.
 */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua)) return true
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
}
