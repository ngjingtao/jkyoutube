import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Supabase client.
 *
 * The publishable key is designed to be public and ships inside the web bundle.
 * It is safe there *only* because Row-Level Security in the database restricts
 * writes to signed-in users — see supabase/schema.sql. Never replace this with a
 * secret key or a service-role key: those bypass RLS entirely and would hand
 * anyone who opens the app full write access.
 *
 * The defaults below mean the app works with no configuration, including inside
 * the Android APK. Override them with VITE_SUPABASE_URL and
 * VITE_SUPABASE_PUBLISHABLE_KEY (see .env.example).
 */

const DEFAULT_URL = 'https://iixacidjgxqqbhqgouvw.supabase.co'
const DEFAULT_KEY = 'sb_publishable_aJQ9ErOuU_JX19Nm85-wJA_xZNZALjZ'

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? DEFAULT_URL
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? DEFAULT_KEY

export const supabaseConfigured = Boolean(url && key)

/**
 * Needed when calling an Edge Function directly with fetch().
 *
 * Supabase's gateway rejects an unauthenticated request to a function with
 * HTTP 401 "Missing authorization header", before the function code even runs.
 * The supabase-js client adds this header itself, but a plain fetch does not.
 */
export const supabasePublishableKey = key
export const supabaseUrl = url

export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(url, key, {
      auth: {
        // Keep the admin signed in between visits.
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'jk.auth',
      },
    })
  : null
