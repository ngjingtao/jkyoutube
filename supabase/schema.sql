-- JKYouTube schema
--
-- Paste this whole file into the Supabase SQL Editor and click Run.
--   Dashboard -> SQL Editor -> New query -> paste -> Run
--
-- Safe to run more than once: every statement is guarded.
--
-- Security model
--   * Anyone using the app can READ videos and channels, using the public
--     publishable key. That key ships inside the web bundle, so it must never
--     be able to write.
--   * Only a signed-in user can INSERT, UPDATE or DELETE. That is enforced here
--     in the database, not in the app, so it cannot be bypassed by calling the
--     REST API directly.

-- --------------------------------------------------------------- channels ---

create table if not exists public.channels (
  id               text primary key,
  name             text not null,
  handle           text,
  avatar_url       text,
  banner_url       text,
  description      text,
  subscriber_count integer,
  created_at       timestamptz not null default now()
);

-- ----------------------------------------------------------------- videos ---

create table if not exists public.videos (
  id                     text primary key,
  title                  text not null,
  description            text not null default '',
  source_type            text not null
                           check (source_type in ('youtube', 'bilibili', 'mp4', 'hls')),
  source_url             text not null,
  youtube_id             text,
  bilibili_id            text,
  thumbnail_url          text,
  thumbnail_is_generated boolean not null default false,
  duration_seconds       integer not null default 0,
  is_live                boolean not null default false,
  stats_unknown          boolean not null default false,
  channel_id             text references public.channels (id) on delete set null,
  category_id            text,
  published_at           timestamptz not null default now(),
  view_count             bigint not null default 0,
  like_count             bigint not null default 0,
  status                 text not null default 'published'
                           check (status in ('draft', 'published')),
  pinned                 boolean not null default false,
  sort_index             integer,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists videos_published_idx on public.videos (published_at desc);
create index if not exists videos_channel_idx   on public.videos (channel_id);
create index if not exists videos_category_idx  on public.videos (category_id);

-- Deduplicate: the same YouTube or Bilibili id must not appear twice.
create unique index if not exists videos_youtube_id_key
  on public.videos (youtube_id) where youtube_id is not null;
create unique index if not exists videos_bilibili_id_key
  on public.videos (bilibili_id) where bilibili_id is not null;

-- --------------------------------------------------------------- settings ---

-- Global app settings, so a change made on the PC applies to every device
-- (for example forcing the sample library off everywhere at once).
create table if not exists public.settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------- updated_at -----

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists videos_touch_updated_at on public.videos;
create trigger videos_touch_updated_at
  before update on public.videos
  for each row execute function public.touch_updated_at();

drop trigger if exists settings_touch_updated_at on public.settings;
create trigger settings_touch_updated_at
  before update on public.settings
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------ row security --

alter table public.channels enable row level security;
alter table public.videos   enable row level security;
alter table public.settings enable row level security;

-- Read: open to the app (which uses the public publishable key).
drop policy if exists "public read channels" on public.channels;
create policy "public read channels"
  on public.channels for select
  to anon, authenticated
  using (true);

drop policy if exists "public read videos" on public.videos;
create policy "public read videos"
  on public.videos for select
  to anon, authenticated
  using (true);

drop policy if exists "public read settings" on public.settings;
create policy "public read settings"
  on public.settings for select
  to anon, authenticated
  using (true);

-- Write: signed-in users only. This is the part that stops anyone who finds the
-- publishable key from editing your library through the REST API.
drop policy if exists "authenticated write channels" on public.channels;
create policy "authenticated write channels"
  on public.channels for all
  to authenticated
  using (true) with check (true);

drop policy if exists "authenticated write videos" on public.videos;
create policy "authenticated write videos"
  on public.videos for all
  to authenticated
  using (true) with check (true);

drop policy if exists "authenticated write settings" on public.settings;
create policy "authenticated write settings"
  on public.settings for all
  to authenticated
  using (true) with check (true);
