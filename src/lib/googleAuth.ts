import { useCallback, useEffect, useState } from 'react'
import { fetchSetting } from './remote'

/**
 * "Sign in with Google" for the viewer, using Google Identity Services.
 *
 * The app is a static site, so there is no server to hold a client secret. A
 * token client is the supported browser-only flow: the user consents once, an
 * access token comes back, and the YouTube Data API accepts it in an
 * Authorization header. The token can only read (youtube.readonly).
 *
 * This is what lets Normal YouTube show content tied to the owner's account —
 * their subscriptions and liked videos. Google does not expose the algorithmic
 * home feed to any third party, even with this sign-in.
 */

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'
const TOKEN_KEY = 'jk.googleAuth'
const SCOPE = 'https://www.googleapis.com/auth/youtube.readonly'

/** Fired after sign-in/sign-out so every mounted feed refreshes. */
export const GOOGLE_AUTH_EVENT = 'jk-google-auth'

export interface GoogleToken {
  accessToken: string
  expiresAt: number
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (response: {
              access_token?: string
              expires_in?: number | string
              error?: string
              error_description?: string
            }) => void
            error_callback?: (error: { message?: string; type?: string }) => void
          }) => { requestAccessToken: (overrides?: { prompt?: string }) => void }
        }
      }
    }
  }
}

let scriptPromise: Promise<void> | null = null

function loadGoogleScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Could not load Google sign-in. Check the connection.'))
    document.head.appendChild(script)
  })
  return scriptPromise
}

export function storedGoogleToken(): GoogleToken | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(TOKEN_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<GoogleToken>
    if (!parsed.accessToken || !parsed.expiresAt) return null
    // Treat a token about to expire as already gone, so callers ask for a new one.
    if (parsed.expiresAt - 60_000 <= Date.now()) {
      window.localStorage.removeItem(TOKEN_KEY)
      return null
    }
    return { accessToken: parsed.accessToken, expiresAt: parsed.expiresAt }
  } catch {
    return null
  }
}

function storeGoogleToken(token: GoogleToken): void {
  try {
    window.localStorage.setItem(TOKEN_KEY, JSON.stringify(token))
  } catch {
    /* storage blocked: the in-memory state still works for this session */
  }
}

export function signOutGoogle(): void {
  try {
    window.localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(GOOGLE_AUTH_EVENT))
}

export async function signInWithGoogle(clientId: string): Promise<GoogleToken> {
  if (!clientId.trim()) throw new Error('Google sign-in is not configured yet.')
  await loadGoogleScript()

  return new Promise<GoogleToken>((resolve, reject) => {
    const oauth2 = window.google?.accounts?.oauth2
    if (!oauth2) {
      reject(new Error('Google sign-in did not load. Check the connection.'))
      return
    }

    let settled = false
    const succeed = (token: GoogleToken) => {
      if (settled) return
      settled = true
      resolve(token)
    }
    const fail = (message: string) => {
      if (settled) return
      settled = true
      reject(new Error(message))
    }

    const client = oauth2.initTokenClient({
      client_id: clientId.trim(),
      scope: SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          fail(response.error_description || response.error || 'Google sign-in was cancelled.')
          return
        }
        const token: GoogleToken = {
          accessToken: response.access_token,
          expiresAt: Date.now() + Number(response.expires_in ?? 3600) * 1000,
        }
        storeGoogleToken(token)
        window.dispatchEvent(new Event(GOOGLE_AUTH_EVENT))
        succeed(token)
      },
      error_callback: (error) => {
        fail(error.message || 'Google sign-in was cancelled.')
      },
    })

    client.requestAccessToken()
  })
}

/* ------------------------------------------------------------ client id --- */

let clientIdCache: string | null = null
let clientIdPromise: Promise<string> | null = null

/**
 * The OAuth client id is public, so the admin stores it in the shared settings
 * table. It is not a secret — the API key is the part that must be restricted.
 */
export async function resolveGoogleClientId(): Promise<string> {
  if (clientIdCache !== null) return clientIdCache
  if (!clientIdPromise) {
    clientIdPromise = fetchSetting<string>('googleClientId')
      .then((value) => {
        clientIdCache = typeof value === 'string' ? value.trim() : ''
        return clientIdCache
      })
      .catch(() => '')
      .finally(() => {
        clientIdPromise = null
      })
  }
  return clientIdPromise
}

export function forgetGoogleClientId(): void {
  clientIdCache = null
  clientIdPromise = null
}

export function useGoogleClientId(): { clientId: string; ready: boolean } {
  const [state, setState] = useState(() =>
    clientIdCache !== null
      ? { clientId: clientIdCache, ready: true }
      : { clientId: '', ready: false },
  )

  useEffect(() => {
    if (clientIdCache !== null) {
      setState({ clientId: clientIdCache, ready: true })
      return
    }
    let cancelled = false
    void resolveGoogleClientId().then((clientId) => {
      if (!cancelled) setState({ clientId, ready: true })
    })
    return () => {
      cancelled = true
    }
  }, [])

  return state
}

/* --------------------------------------------------------------- status --- */

export interface GoogleAccountState {
  token: GoogleToken | null
  busy: boolean
  error: string | null
  signIn: () => Promise<void>
  signOut: () => void
}

export function useGoogleAccount(clientId: string): GoogleAccountState {
  const [token, setToken] = useState<GoogleToken | null>(storedGoogleToken)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const sync = () => setToken(storedGoogleToken())
    window.addEventListener(GOOGLE_AUTH_EVENT, sync)
    return () => window.removeEventListener(GOOGLE_AUTH_EVENT, sync)
  }, [])

  const signIn = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const next = await signInWithGoogle(clientId)
      setToken(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.')
    } finally {
      setBusy(false)
    }
  }, [clientId])

  const signOut = useCallback(() => {
    signOutGoogle()
    setToken(null)
    setError(null)
  }, [])

  return { token, busy, error, signIn, signOut }
}
