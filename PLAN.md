# JKYoutube — Build Plan

A private, **parent-curated** video app that is visually indistinguishable from YouTube.

- **Admin (you, on PC):** paste a YouTube link into a web admin panel → it appears in the app.
- **Viewer (your son):** iPad (Safari → Add to Home Screen) and Android (signed APK built by GitHub Actions).
- **Hosting:** Render.com static site + Supabase for database, auth and API.

**Purpose:** control exactly which videos are reachable, while the interface feels like the real YouTube so the viewer simply uses it instead of the real thing.

> **Keep this private and family-only.** Mirroring YouTube's branding and trade dress is acceptable for personal/family use. Publishing it publicly (or to an app store) is where trademark problems begin.

### Known tells to manage
| Tell | Status |
|---|---|
| URL bar visible | **Solved** — PWA/TWA standalone mode hides all browser chrome |
| Player looks fake | **Solved** — we embed YouTube's real IFrame player, incl. YouTube's own logo/menus |
| Search returns nothing for unknown queries | **Open** — decide search strategy (see Open Questions) |
| Real YouTube app / youtube.com still reachable | **Out of scope** — must be blocked via Screen Time (iPad) or Family Link (Android) |
| Video owner disabled embedding | Handled — "Watch on YouTube" fallback; admin warns at paste time |

---

## 1. Confirmed decisions

| Question | Answer |
|---|---|
| Content source | YouTube links now; external `.mp4` links later (design supports both from day one) |
| Visibility | **Private** — per-user accounts with email + password |
| Android delivery | Sideloaded **APK** built by GitHub Actions |
| Media volume | Almost no stored video — mostly links |
| Look & feel | **Exact YouTube replica** — no visible sign it is not YouTube |
| Backend | **Supabase** (Postgres + Auth + REST API + RLS) — never sleeps |
| Hosting | **Render static site** — never sleeps, instant app open |
| Address | Free `*.onrender.com` URL |
| Branding | Identical to YouTube (red accent, YouTube-style logo mark) |
| V1 scope | Core first: Home grid, Watch page, Search, Admin add-link. Then expand. |

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  RENDER.COM — Static Site (never sleeps, free tier)          │
│                                                              │
│   /            → the YouTube-clone PWA (iPad + Android)      │
│   /admin       → the PC admin panel (login-protected)        │
│   /watch/:id   → watch page with player                      │
│   /.well-known/assetlinks.json → Android app verification    │
└───────────────┬──────────────────────────────────────────────┘
                │  HTTPS (REST)
                ▼
┌──────────────────────────────────────────────────────────────┐
│  DATABASE + AUTH + API                                       │
│  Postgres + Auth + Row-Level Security                        │
│  (decision pending: Supabase vs self-hosted Node API on      │
│   Render — see Open Questions)                               │
└──────────────────────────────────────────────────────────────┘
                ▲
                │  GitHub Actions
┌───────────────┴──────────────────────────────────────────────┐
│  ANDROID APK — Trusted Web Activity wrapping the Render PWA  │
│  Built + signed in CI, downloaded and installed on phone     │
└──────────────────────────────────────────────────────────────┘
```

### Why this shape
- **Static site on Render never sleeps** → the app opens instantly on your phone.
- A **free Render Web Service sleeps after 15 min idle**, so a cold start can take ~30–50s. Avoided where possible.
- Video bytes are **never served by our server** — they come straight from YouTube's CDN. Zero bandwidth cost.

---

## 3. Why "exact YouTube" is achievable

YouTube's own player is embeddable legally via the official **IFrame Player API**. So we are not re-streaming anything — we embed, which is exactly what YouTube intends. The rest of the UI (grid, sidebar, chips, watch page) is just our own HTML/CSS.

Consequences to handle in code:
- Some videos have embedding disabled → detect the error and show a *"Watch on YouTube"* fallback button.
- Age-restricted / region-locked videos fail to embed → same fallback.
- We never scrape YouTube; metadata comes from the public oEmbed endpoint (no API key, no quota).

---

## 4. Feature list (v1)

**Viewer app**
- Top bar: hamburger, logo, search box, voice-search icon, create, notifications, avatar
- Left sidebar (collapsible, exactly like YouTube): Home, Shorts, Subscriptions, Library, History, Your videos, Watch Later, Liked videos, plus your channel list
- Home: category filter chips + responsive thumbnail grid (thumbnail, duration badge, avatar, title, channel, views, "3 days ago")
- Watch page: player, title, views/date, Like/Dislike, Share, Save, channel row with Subscribe, expandable description, right-hand **Up Next** column, autoplay-next
- Search: results page + live suggestions from your own library
- Channel page: banner, avatar, tabs (Videos / Playlists / About), Subscribe
- Playlist page with autoplay
- History, Watch Later, Liked videos
- Theatre mode / fullscreen, keyboard shortcuts (space, k, j, l, f, m, arrows)
- Dark & light theme, remembered
- PWA: installable, app icon, splash screen, standalone (no browser chrome), offline app shell

**Admin panel (`/admin`)**
- Login
- **Add video by URL** → auto-fetches title, thumbnail, and channel from YouTube oEmbed
- Bulk paste (paste 50 links, it adds them all)
- Edit title / description / thumbnail / category / channel
- Drag-and-drop reordering, pin to top, feature on home banner
- Publish / unpublish / schedule
- Create & manage channels, playlists, categories
- Manage viewers: create accounts, invite codes, deactivate
- Site settings: app name, logo, accent colour, home layout rows
- Basic stats: views per video, most watched, active users

**Android extras**
- Real app icon + splash screen
- Hardware back button maps to in-app back
- Opens in standalone fullscreen (no address bar)
- Auto-updating: it loads the live site, so shipping new content or UI needs no new APK

---

## 5. Data model (draft)

```
users          id, email, password_hash, role(admin|viewer), display_name, avatar_url
channels       id, name, handle, avatar_url, banner_url, description, owner_user_id
videos         id, title, description, source_type(youtube|mp4|hls), source_url,
               youtube_id, thumbnail_url, duration_seconds, channel_id,
               category_id, published_at, status(draft|published), pinned, views
categories     id, name, slug, position
playlists      id, title, description, channel_id, visibility
playlist_items id, playlist_id, video_id, position
subscriptions  user_id, channel_id
likes          user_id, video_id, value(1|-1)
history        user_id, video_id, watched_at, position_seconds
settings       key, value          -- app name, theme, home rows, etc.
```

`source_type` is a single enum, so adding real `.mp4` uploads later is a small change — not a rewrite.

---

## 6. Phases

**Phase 0 — Toolchain (your PC)**
Install Node.js LTS + Git. Verify `node -v`, `npm -v`, `git --version`. ~15 min.

**Phase 1 — Local skeleton**
Vite + React + TypeScript + Tailwind. Routing, theme, mock data. You can open it in a browser and click around. No accounts needed yet.

**Phase 2 — Pixel-accurate UI**
Top bar, sidebar, home grid, watch page, channel page, search. This is the biggest visual phase. Reviewed on a real iPad-sized viewport.

**Phase 3 — Data layer**
Connect the database + auth. Admin can log in and add a YouTube link; it appears on Home. Real thumbnails, real playlists.

**Phase 4 — Admin panel**
Full CRUD, bulk paste, reordering, publishing, user management, settings.

**Phase 5 — PWA polish**
Manifest, icons, splash screens, service worker, iOS meta tags. Deploy to Render → test Add to Home Screen on the iPad.

**Phase 6 — Android APK**
GitHub repo + Actions workflow → signed APK artifact. Install and test on the Android phone.

**Phase 7 — Nice-to-haves**
`.mp4` external links, offline downloads, watch-party, comments, Shorts, push notifications.

---

## 7. Repo structure (planned)

```
JKYoutube/
├─ src/
│  ├─ app/                    # routes: /, /watch/:id, /admin, /channel/:id ...
│  ├─ components/
│  │  ├─ layout/              # TopBar, Sidebar, AppShell
│  │  ├─ video/               # VideoCard, VideoGrid, Thumbnail, DurationBadge
│  │  ├─ player/              # YouTubePlayer, NativePlayer
│  │  └─ ui/                  # Button, Chip, Avatar, Skeleton ...
│  ├─ features/
│  │  ├─ admin/
│  │  ├─ library/
│  │  └─ auth/
│  ├─ lib/                    # api client, supabase client, youtube helpers
│  └─ styles/
├─ public/
│  ├─ icons/                  # PWA icons (192, 512, maskable)
│  └─ .well-known/assetlinks.json
├─ android/                   # TWA / Capacitor shell
├─ .github/workflows/
│  └─ android.yml             # build + sign APK
├─ render.yaml                # Render blueprint
├─ PLAN.md
└─ README.md
```

---

## 8. Known risks

| Risk | Mitigation |
|---|---|
| Video owner disabled embedding | Catch player error, show "Watch on YouTube" button |
| Age-restricted / region-locked video | Same fallback; can hide at add-time with a warning in admin |
| Render free web service cold starts | Prefer static site + non-sleeping database; avoid a custom always-on server |
| iOS standalone PWA quirks (fullscreen, autoplay) | Use official player API flags, test on the real iPad early (Phase 5) |
| YouTube UI changes | We mirror the *layout*, not pixel-scrape; low maintenance |
| Losing many links if the DB is wrong | Admin bulk import/export as CSV/JSON |

---

## 9. Open questions

1. **Search strategy** — this is the biggest realism risk. Three options:
   - **(a) Library-only** — search only your approved videos. Simplest, free, but "no results" for anything not curated.
   - **(b) Real YouTube search + allowlist filter (recommended for realism)** — query the YouTube Data API so real results appear, then filter to channels/videos you've approved. Needs a free API key; free quota is 10,000 units/day ≈ 100 searches/day.
   - **(c) Hybrid** — allowed queries show real results; everything else shows a plausible "No results found" page.
2. Approve local toolchain install (Node.js LTS + Git) — see chat.
3. Device-level blocking of the real YouTube (Screen Time / Family Link) — your call, done on the device.
