# JKYoutube

A private, parent-curated video app that looks and behaves like YouTube.

- **You (admin, on the PC):** open `/admin`, paste YouTube links, and they appear in the app.
- **Viewer (iPad):** Safari → Share → *Add to Home Screen*. Runs fullscreen, no browser chrome.
- **Viewer (Android):** a signed APK built by GitHub Actions.
- **Hosting:** Render static site (never sleeps). Data will live in Supabase.

See `PLAN.md` for the full architecture, data model, phases and known risks.

---

## Running it locally

Prerequisites (already installed on this machine): Node.js 24+, npm 11+.

```powershell
npm install
npm run dev
```

Then open <http://localhost:5173>. Admin panel is at <http://localhost:5173/admin>
(preview passcode `admin`).

### Other commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | TypeScript check, no output on success |
| `npm test` | Runs the duration-parser tests |
| `npm run icons` | Regenerate PWA icons in `public/icons/` |

---

## Testing it the way your son will see it

**iPad**

1. Make sure the iPad is on the same Wi-Fi as this PC.
2. Start the dev server: `npm run dev` — it prints a *Network* address.
   On this PC that is **`http://192.168.68.114:5173`**.
3. On the iPad, open that address in **Safari** (not Chrome).
4. Share → **Add to Home Screen** → open it from the home screen.
   The address bar disappears. This is the real test of the illusion.
   *(The dev server sends plain HTTP, so the service worker is inactive — that only
   works over HTTPS. Everything else behaves the same.)*

**Android phone**

Same steps as the iPad using **Chrome** → *Install app*. The proper APK comes in Phase 6.

---

## What is built so far

**Viewer app**
- [x] Header with YouTube logo, search, voice-search button, Create, Notifications, Account
- [x] Responsive guide: overlay drawer on phones, 72px mini rail on tablets, 240px guide on desktop
- [x] Home feed with category chips and a container-query card grid
- [x] Video cards with duration badge, channel avatar, view count and relative time
- [x] Watch page: real YouTube player, like/dislike, share, save, subscribe, expandable description
- [x] Up Next column with autoplay, and "embedding disabled" fallback
- [x] Search results, channel pages with tabs, playlist pages
- [x] Subscriptions, Trending, History, Liked, Downloads, Library feeds
- [x] Dark and light themes, remembered across launches
- [x] PWA manifest, app icons, iOS standalone meta tags

**Admin panel**
- [x] Preview passcode gate
- [x] Add a video by URL with automatic title/channel lookup
- [x] Bulk add from a pasted list
- [x] Editable library with per-row refetch, preview and delete
- [x] Export to JSON
- [x] "What the app shows" control: Auto / Only my videos / Only samples.
      Auto hides the placeholder library the moment you add your first video,
      so the app never mixes someone else's content into yours.
- [x] YouTube Data API key field, with a Test button and step-by-step setup
      instructions
- [x] "Refresh all from YouTube" to update view counts, likes and subscriber
      counts on demand
- [x] Bilibili as a second video source, in its own card

### Bilibili support, and its limits

Bilibili links play in an embedded player. Three constraints are real and worth
knowing before you add one:

1. **The player is Bilibili's own.** It is embedded from `player.bilibili.com`,
   so its logo, control bar and quality menu are theirs. It cannot be made to
   look like YouTube's player without re-hosting their video streams, which this
   project does not do. The scrolling bullet comments *are* switched off
   (`danmaku=0`), because that is the most obviously un-YouTube element.
2. **Nothing can be fetched automatically.** `api.bilibili.com` returns
   `HTTP 403` with no `Access-Control-Allow-Origin`, and there is no oEmbed
   endpoint. Title, channel, duration, thumbnail, views and upload date all have
   to be typed in.
3. **Autoplay-next does not fire.** The embed has no scripting API, so there is
   no reliable "ended" event. Viewers pick the next video themselves.

If you leave the view count and upload date blank, the app prints **no** view
line at all rather than a false "0 views • just now". Leave the thumbnail blank
and a tidy gradient card is generated. Note that `b23.tv` short links cannot be
resolved in a browser — paste the full `bilibili.com/video/BV…` address.

### Why the YouTube API key matters

The public oEmbed endpoint only returns a **title, author name and thumbnail**.
It has no view counts, likes, subscriber counts, duration or real upload date.
Without a Data API key, a video you add looks like this:

```
Untitled video        My Channel · 0 subscribers
0 views · just now    0 likes
```

With a key, every field is copied from YouTube itself, including the genuine
upload date (so "3 years ago" is correct) and duration. Lookups cost 1 quota
unit per 50 videos against a free 10,000/day allowance.

**Restrict the key** in Google Cloud Console — allow only *YouTube Data API v3*,
and under Application restrictions choose *Websites* and add your Render address
plus `http://localhost:*`. The key travels in the page, so anyone who can open
the app could otherwise use it.

**Not built yet**

- [ ] Supabase: real accounts, real database, server-enforced permissions
- [ ] Comments
- [ ] Shorts vertical feed
- [ ] Real YouTube search filtered to allowed content (needs an API key)
- [ ] Android APK + GitHub Actions workflow
- [ ] External `.mp4` sources (the type and player already exist)

---

## Project layout

```
src/
  components/        TopBar, Sidebar, AppShell, VideoCard, VideoGrid, CategoryChips, icons
  components/player/ YouTube IFrame API player + native <video> player
  pages/             Home, Watch, Results, Channel, Playlist, Feed, Shorts, Admin
  store/library.tsx  Single data seam — swap the internals for Supabase, UI unchanged
  lib/               YouTube-accurate formatters (views, time ago, durations), hooks
  data/mock.ts       Placeholder library pointing at real embeddable YouTube videos
public/
  icons/             Generated app icons
  manifest.webmanifest
scripts/
  generate-icons.mjs Dependency-free PNG icon generator
render.yaml          Render blueprint (static site)
```

---

## Deploying to Render

1. Push this folder to a GitHub repository.
2. In Render: **New → Blueprint**, connect the repo. Render reads `render.yaml`.
3. Deploy. You get a free `https://jkyoutube.onrender.com` address.

Because it is a static site, it will not cold-start. The Supabase project (Phase 3)
provides the database, auth and API that never sleep either.

---

## A note on scope

This app mirrors YouTube's interface so the viewer simply uses it instead of the real
thing, while you control every video that is reachable. Two things worth remembering:

1. **Keep it private.** Personal use is fine; publishing it publicly is where
   trademark trouble begins.
2. **The real YouTube is still reachable** on both devices. For the setup to hold you
   also need to block `youtube.com` and the YouTube app via **Screen Time** on the
   iPad and **Family Link** on Android. That is a device setting the app cannot enforce.

## Credits

Roboto is loaded from Google Fonts. Video playback uses YouTube's official
[IFrame Player API](https://developers.google.com/youtube/iframe_api_reference),
so no video content is ever re-hosted or re-streamed by this project.
