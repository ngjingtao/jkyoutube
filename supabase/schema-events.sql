-- Watch telemetry and YouTube suggestion storage.
--
-- Paste into the Supabase SQL Editor and Run, after supabase/schema.sql.
-- Safe to run more than once.
--
-- This one file covers BOTH features:
--   1. view_events + video_stats  -> the Watch statistics card
--   2. videos.suggested / suggested_for + the suggestion cache
--      -> YouTube suggestions mixed into Up next
--
-- Deliberately pure ASCII. An earlier version used em dashes and curly quotes
-- in these comments, and PowerShell's Get-Content mangled them when the file
-- was copied to the clipboard, because it reads UTF-8 as Windows-1252 unless
-- there is a byte order mark.
--
-- Why anonymous inserts are allowed
--   The viewer is not signed in; only the owner has an account. So the app has
--   to record events with the public publishable key, which means anyone holding
--   that key could add junk rows. The mitigations are:
--     * INSERT is the ONLY thing anonymous callers may do.
--     * There is no UPDATE or DELETE policy at all, so existing rows cannot be
--       altered or removed through the API.
--     * Rows are read back only by a signed-in user.
--   For a family app that is a reasonable trade. Do not put anything sensitive
--   in this table.

create table if not exists public.view_events (
  id                bigserial primary key,
  video_id          text not null,
  session_id        text not null,
  -- open     : the watch page was opened
  -- progress : a checkpoint while watching (position and elapsed time)
  -- blocked  : the viewer clicked a link inside the embedded player
  -- navigate : moved from one page to another
  event             text not null
                      check (event in ('open', 'progress', 'blocked', 'navigate')),
  position_seconds  integer,
  duration_seconds  integer,
  watched_seconds   integer,
  from_path         text,
  to_path           text,
  source_type       text,
  created_at        timestamptz not null default now()
);

create index if not exists view_events_video_idx   on public.view_events (video_id, created_at desc);
create index if not exists view_events_created_idx on public.view_events (created_at desc);
create index if not exists view_events_event_idx   on public.view_events (event);

alter table public.view_events enable row level security;

-- Recording: open to the app. INSERT only.
drop policy if exists "anyone may record events" on public.view_events;
create policy "anyone may record events"
  on public.view_events for insert
  to anon, authenticated
  with check (true);

-- Reading: signed in only. No UPDATE or DELETE policy exists, so events are
-- append-only from the client's point of view.
drop policy if exists "owner reads events" on public.view_events;
create policy "owner reads events"
  on public.view_events for select
  to authenticated
  using (true);

-- Per video totals for the admin screen.
create or replace view public.video_stats as
select
  video_id,
  count(*) filter (where event = 'open')     as opens,
  count(*) filter (where event = 'blocked')  as blocked_clicks,
  count(distinct session_id)                 as viewers,
  coalesce(max(duration_seconds), 0)         as duration_seconds,
  coalesce(max(position_seconds), 0)         as furthest_position,
  coalesce(sum(watched_seconds), 0)          as watched_seconds,
  min(created_at)                            as first_seen,
  max(created_at)                            as last_seen
from public.view_events
group by video_id;

-- Views bypass row-level security on the underlying table by default, which
-- would expose everything to the public key. Force the caller's own rules.
alter view public.video_stats set (security_invoker = true);


-- ---------------------------------------------------------------------------
-- Show priority
-- ---------------------------------------------------------------------------
--
-- 1 to 5, where 5 is the most likely to appear near the top of Home. The home
-- page is shuffled every visit, and this value is the weight: a 5 turns up early
-- far more often than a 1, but the order is never fixed.

alter table public.videos add column if not exists priority integer not null default 3;

do $$
begin
  alter table public.videos
    add constraint videos_priority_range check (priority between 1 and 5);
exception
  when duplicate_object then null;
end $$;

create index if not exists videos_priority_idx on public.videos (priority desc);


-- ---------------------------------------------------------------------------
-- YouTube suggestions
-- ---------------------------------------------------------------------------
--
-- A suggestion is stored as a normal row in public.videos with suggested = true.
-- That way it plays through exactly the same path as everything else, with no
-- special cases in the watch page or the player.
--
-- The curated feed must never contain them, so the app filters them out of Home,
-- search and channel pages. They only appear in Up next.

alter table public.videos add column if not exists suggested boolean not null default false;
alter table public.videos add column if not exists suggested_for text;

create index if not exists videos_suggested_idx on public.videos (suggested);
create index if not exists videos_suggested_for_idx on public.videos (suggested_for);

-- The viewer is anonymous, so it has to be able to record what it fetched.
-- The check makes that narrow: anonymous callers may ONLY insert rows flagged as
-- suggestions, so nothing can ever be injected into the curated feed. There is
-- still no UPDATE or DELETE policy for anonymous callers.
drop policy if exists "anon may insert suggestions" on public.videos;
create policy "anon may insert suggestions"
  on public.videos for insert
  to anon
  with check (suggested = true);

-- Cache of past lookups, keyed by the video the suggestions came from. One
-- search.list call costs 100 quota units against a free allowance of 10,000 per
-- day, which is only 100 searches, so the same seed must not be looked up again
-- within the cache window.
create table if not exists public.suggestion_cache (
  seed_video_id text primary key,
  fetched_at    timestamptz not null default now(),
  result_count  integer not null default 0
);

alter table public.suggestion_cache enable row level security;

drop policy if exists "anyone may record a lookup" on public.suggestion_cache;
create policy "anyone may record a lookup"
  on public.suggestion_cache for insert
  to anon, authenticated
  with check (true);

drop policy if exists "anyone may refresh a lookup" on public.suggestion_cache;
create policy "anyone may refresh a lookup"
  on public.suggestion_cache for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "owner reads lookups" on public.suggestion_cache;
create policy "owner reads lookups"
  on public.suggestion_cache for select
  to authenticated
  using (true);

-- Channels for suggestions have to exist or the cards would read "Unknown".
-- Narrow on purpose: anonymous callers may only add rows whose id uses the
-- ch-yt- prefix that is reserved for YouTube-derived channels.
drop policy if exists "anon may insert suggested channels" on public.channels;
create policy "anon may insert suggested channels"
  on public.channels for insert
  to anon
  with check (id like 'ch-yt-%');


