-- Watch telemetry.
--
-- Paste into the Supabase SQL Editor and Run, after supabase/schema.sql.
-- Safe to run more than once.
--
-- Why anonymous inserts are allowed
--   The viewer is not signed in — only the owner has an account — so the app has
--   to record events with the public publishable key. That means anyone holding
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
  -- open      : the watch page was opened
  -- progress  : a checkpoint while watching (position and elapsed time)
  -- blocked   : the viewer clicked a link inside the embedded player
  -- navigate  : moved from one page to another
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

-- Convenience views for the admin screen.

create or replace view public.video_stats as
select
  video_id,
  count(*) filter (where event = 'open')          as opens,
  count(*) filter (where event = 'blocked')       as blocked_clicks,
  count(distinct session_id)                      as viewers,
  coalesce(max(duration_seconds), 0)              as duration_seconds,
  coalesce(max(position_seconds), 0)              as furthest_position,
  coalesce(sum(watched_seconds), 0)               as watched_seconds,
  min(created_at)                                 as first_seen,
  max(created_at)                                 as last_seen
from public.view_events
group by video_id;

-- Views bypass row-level security on the underlying table by default, which
-- would expose everything to the public key. Force the caller's own rules.
alter view public.video_stats set (security_invoker = true);
