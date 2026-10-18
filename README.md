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
- [x] No outbound link to youtube.com anywhere in the viewer UI, plus a click
      shield over the embedded player's own title bar

### Keeping viewers inside the app

An outbound link to the real YouTube is a one-tap escape, so there are none.

- The "Watch on YouTube" button that used to appear when a video could not be
  embedded has been **removed**. It now reads "Video unavailable", the same way
  YouTube's own unavailable state does.
- The unavailable message no longer says *"the owner does not allow this video to
  be played outside of YouTube"* — that phrasing gave away that the video was
  embedded.
- A transparent **click shield** covers the top 18% of the embedded player. It
  exists because YouTube's player draws its own title overlay there, and that
  title is a link to youtube.com; its Share button also hands out a youtube.com
  URL. No player parameter removes either. Clicks in that band are forwarded to
  play/pause, which is what tapping the video does anyway.
- The Bilibili iframe is **sandboxed without `allow-popups`**. Their bundle
  leaves the page with `window.open()` from a click handler that handles
  `"play"`, `"main"` and `"download"` targets — the related-video, logo and
  download links. Blocking pop-ups turns all of those into no-ops, so a stray
  click cannot drop the viewer onto the real bilibili.com.

**What cannot be removed.** The YouTube shield does not follow the player into
fullscreen, and YouTube's settings (gear) menu still contains "Copy video URL"
entries. The Bilibili sandbox blocks pop-ups but not the frame navigating
*itself*, so a link that loads a page inside the frame would show Bilibili
inside the app rather than in a new tab. Those live inside the embedded players;
removing them fully would mean re-hosting the video streams, which this project
deliberately does not do.

Because of that, the real protection is at the device level: block `youtube.com`
and the YouTube app using **Screen Time** (iPad) or **Family Link** (Android).

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

## Shared database (Supabase)

Without this, every device keeps its own copy of the library and the PC, iPad
and Android app will show **different** videos. With it, they all read the same
rows and a change on the PC appears everywhere immediately.

### One-time setup

**1. Create the tables.** Open your Supabase project → **SQL Editor** → **New
query**, paste the whole of [`supabase/schema.sql`](supabase/schema.sql), and
click **Run**. It is safe to run more than once.

**2. Create your admin account.** Supabase → **Authentication → Users → Add
user**. Enter your email and a password, and tick **Auto Confirm User** (without
it, sign-in is refused until the address is confirmed).

**3. Sign in.** Open `/admin`, find the **Shared database** card, and sign in
with that email and password.

**4. Move anything you already added.** If the card says *"...still only in this
browser"*, click **Move to the shared database**.

### How it is secured

The publishable key is designed to be public and ships inside the web bundle.
That is safe **only** because Row-Level Security in `schema.sql` does this:

- `SELECT` is open to everyone using the app, so the iPad and the APK can read
  the library without a login.
- `INSERT`, `UPDATE` and `DELETE` are restricted to **signed-in** users.

Those rules live in the database, not in the app, so they cannot be bypassed by
calling the REST API directly with the key. Two rules to keep:

1. **Never put a `service_role` or secret key in the client.** It bypasses RLS
   entirely and would give anyone who opens the app full write access.
2. **Keep RLS enabled** on all three tables. If RLS is off, the key becomes a
   write credential.

### What stays per-device

Watch history, likes, "watch later" and subscriptions are stored in each
browser, because they are personal rather than shared. They move to the database
when real viewer accounts exist.

The **"What the app shows"** setting *is* shared — changing it on the PC applies
to every device.

## Android APK

The APK is a thin shell around the deployed web app, so content and UI changes
ship without rebuilding it — only the native shell (icon, name, URL) needs a new
build.

### Getting the APK

1. Push to `main` (or run **Actions → Build Android APK → Run workflow**).
2. Open the run in the **Actions** tab.
3. Download the **`jkyoutube-apk`** artefact from the bottom of the run page.
4. On the phone, open the downloaded `.apk` and allow installing from unknown
   sources when prompted.

The APK is **debug-signed**, which is fine for sideloading. It is not suitable
for the Play Store, which needs a release key.

### Stable signing (so updates install over the top)

Without this, **every build is signed with a freshly generated debug key**, and
Android refuses to install a differently-signed APK over an existing one — you
have to uninstall first each time. A release keystore fixes that.

A keystore has already been generated for you at
`D:\Projects\JKYoutube-keys\jkyoutube-release.jks` (deliberately outside this
repository, so it can never be committed). **Back that file and its password up
somewhere safe** — if you lose them you can never update the app in place again.

Add three repository secrets under
**Settings → Secrets and variables → Actions → Secrets**:

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | the contents of `keystore-base64.txt` (one long line, no newlines) |
| `ANDROID_STORE_PASSWORD` | the password in `PASSWORD.txt` |
| `ANDROID_KEY_ALIAS` | `jkyoutube` |

Then re-run the workflow (**Actions → Build Android APK → Run workflow**). The
log will say *"Building a RELEASE APK signed with the stable key."* From then on,
new APKs install straight over the old one.

If the secrets are missing the workflow still succeeds — it warns and builds a
debug APK instead, so a misconfiguration never blocks you.

### Pointing the APK at a different address

The build reads a repository variable named `APP_URL`, falling back to
`https://jkyoutube.onrender.com`. To change it without editing code:

**Settings → Secrets and variables → Actions → Variables → New variable**, name
`APP_URL`, value your address. Then re-run the workflow.

### Why `targetSdkVersion` is 34

Android 15+ forces edge-to-edge layout for apps targeting SDK 35 and above,
which draws the WebView underneath the status bar and hides part of the header.
The one-release opt-out is ignored at SDK 36, so targeting 34 is the only way to
guarantee correct layout without depending on `env(safe-area-inset-*)` support in
Android WebView. Sideloaded APKs are unaffected by Play Store target-SDK rules.

### Native behaviour

- App name and icon are the YouTube mark, with an adaptive icon (red background,
  white play triangle) and a matching dark splash screen.
- The hardware back button walks back through history and only exits from Home.
- Capacitor already disables the user-gesture requirement for media, so video
  autoplay works, and it handles `onShowCustomView` so fullscreen works.

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
