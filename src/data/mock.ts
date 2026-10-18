import type { Category, Channel, Playlist, Video } from '../types'
import { youTubeThumbnail } from '../lib/format'

/**
 * Placeholder library.
 *
 * Every entry points at a real, publicly embeddable YouTube video so the
 * player, thumbnails and durations all behave exactly as they will in
 * production. Replaced by Supabase rows in Phase 3.
 */

const daysAgo = (n: number, hours = 0) =>
  new Date(Date.now() - n * 86_400_000 - hours * 3_600_000).toISOString()

export const categories: Category[] = [
  { id: 'all', name: 'All' },
  { id: 'music', name: 'Music' },
  { id: 'learning', name: 'Learning' },
  { id: 'kids', name: 'Kids' },
  { id: 'science', name: 'Science' },
  { id: 'nature', name: 'Nature' },
  { id: 'gaming', name: 'Gaming' },
  { id: 'live', name: 'Live' },
]

export const channels: Channel[] = [
  {
    id: 'ch-lofi',
    name: 'Lofi Girl',
    handle: '@LofiGirl',
    avatarUrl: 'https://yt3.googleusercontent.com/ytc/AIdro_lV1s4VJ1V1s4VJ1V1s4VJ1V1s4VJ1V1s4=s88-c-k-c0x00ffffff-no-rj',
    description: 'Relaxing lofi beats to study and chill to.',
    subscriberCount: 14_300_000,
    verified: true,
  },
  {
    id: 'ch-science',
    name: 'Science Max',
    handle: '@ScienceMax',
    avatarUrl: '',
    description: 'Big experiments explained simply.',
    subscriberCount: 2_100_000,
    verified: true,
  },
  {
    id: 'ch-nature',
    name: 'Planet Wild',
    handle: '@PlanetWild',
    avatarUrl: '',
    description: 'The natural world, up close.',
    subscriberCount: 5_640_000,
    verified: true,
  },
  {
    id: 'ch-music',
    name: 'Music Vault',
    handle: '@MusicVault',
    avatarUrl: '',
    description: 'The songs everyone knows.',
    subscriberCount: 31_200_000,
    verified: true,
  },
  {
    id: 'ch-learn',
    name: 'Bright Learning',
    handle: '@BrightLearning',
    avatarUrl: '',
    description: 'Short lessons that actually stick.',
    subscriberCount: 894_000,
    verified: false,
  },
  {
    id: 'ch-kids',
    name: 'Storytime Kids',
    handle: '@StorytimeKids',
    avatarUrl: '',
    description: 'Stories and songs for little ones.',
    subscriberCount: 3_450_000,
    verified: true,
  },
]

interface Seed {
  yt: string
  title: string
  channelId: string
  categoryId: string
  duration: number
  views: number
  likes: number
  days: number
  hours?: number
  description?: string
  pinned?: boolean
}

const seeds: Seed[] = [
  {
    yt: 'jfKfPfyJRdk',
    title: 'lofi hip hop radio 📚 — beats to relax/study to',
    channelId: 'ch-lofi',
    categoryId: 'live',
    duration: 0,
    views: 41_200_000,
    likes: 1_200_000,
    days: 0,
    hours: 2,
    description:
      'Relaxing lofi beats, streamed around the clock. Perfect for studying, reading or winding down before bed.',
    pinned: true,
  },
  {
    yt: 'aqz-KE-bpKQ',
    title: 'Big Buck Bunny — the full animated short film in HD',
    channelId: 'ch-nature',
    categoryId: 'nature',
    duration: 634,
    views: 8_940_000,
    likes: 412_000,
    days: 3,
    description:
      'A gentle giant of a rabbit takes on three bullying rodents in this beautifully animated open movie. A great watch for all ages.',
  },
  {
    yt: 'fJ9rUzIMcZQ',
    title: 'Bohemian Rhapsody — the story behind the song',
    channelId: 'ch-music',
    categoryId: 'music',
    duration: 355,
    views: 1_800_000_000,
    likes: 12_400_000,
    days: 5,
    description: 'How one six-minute track changed what a rock song could be.',
  },
  {
    yt: '9bZkp7q19f0',
    title: 'Gangnam Style — the dance that took over the world',
    channelId: 'ch-music',
    categoryId: 'music',
    duration: 253,
    views: 5_100_000_000,
    likes: 27_000_000,
    days: 8,
    description: 'The viral hit that broke YouTube itself.',
  },
  {
    yt: 'kJQP7kiw5Fk',
    title: 'Despacito — behind the biggest summer hit ever',
    channelId: 'ch-music',
    categoryId: 'music',
    duration: 282,
    views: 8_400_000_000,
    likes: 51_000_000,
    days: 12,
  },
  {
    yt: 'RgKAFK5djSk',
    title: 'See You Again — a tribute that still hits hard',
    channelId: 'ch-music',
    categoryId: 'music',
    duration: 229,
    views: 6_300_000_000,
    likes: 41_000_000,
    days: 15,
  },
  {
    yt: 'M7lc1UVf-VE',
    title: 'How video streaming actually works',
    channelId: 'ch-science',
    categoryId: 'science',
    duration: 214,
    views: 964_000,
    likes: 31_400,
    days: 2,
    description:
      'Ever wondered how a video gets from a server to your screen without buffering? We break down streaming, bitrates and buffering in plain English.',
  },
  {
    yt: '60ItHLz5WEA',
    title: 'Faded — an animated journey through an empty world',
    channelId: 'ch-music',
    categoryId: 'music',
    duration: 212,
    views: 3_900_000_000,
    likes: 24_000_000,
    days: 19,
  },
  {
    yt: 'OPf0YbXqDm0',
    title: 'Uptown Funk — the groove that never gets old',
    channelId: 'ch-music',
    categoryId: 'music',
    duration: 271,
    views: 5_200_000_000,
    likes: 22_000_000,
    days: 22,
  },
  {
    yt: 'JGwWNGJdvx8',
    title: 'Shape of You — how a simple loop became a hit',
    channelId: 'ch-music',
    categoryId: 'music',
    duration: 263,
    views: 6_500_000_000,
    likes: 33_000_000,
    days: 26,
  },
  {
    yt: 'CevxZvSJLk8',
    title: 'Roar — a lesson in being brave',
    channelId: 'ch-kids',
    categoryId: 'kids',
    duration: 269,
    views: 4_000_000_000,
    likes: 18_000_000,
    days: 30,
  },
  {
    yt: 'YQHsXMglC9A',
    title: 'Hello — the song about calling someone back',
    channelId: 'ch-music',
    categoryId: 'music',
    duration: 367,
    views: 3_200_000_000,
    likes: 19_000_000,
    days: 34,
  },
  {
    yt: 'hT_nvWreIhg',
    title: 'Counting Stars — numbers, dreams and late nights',
    channelId: 'ch-music',
    categoryId: 'music',
    duration: 257,
    views: 4_100_000_000,
    likes: 20_000_000,
    days: 40,
  },
  {
    yt: 'dQw4w9WgXcQ',
    title: 'Never Gonna Give You Up — a pop classic',
    channelId: 'ch-music',
    categoryId: 'music',
    duration: 213,
    views: 1_500_000_000,
    likes: 17_000_000,
    days: 44,
  },
  {
    yt: '21X5lGlDOfg',
    title: 'A tour of the International Space Station',
    channelId: 'ch-science',
    categoryId: 'science',
    duration: 1_247,
    views: 2_340_000,
    likes: 88_000,
    days: 6,
    description:
      'Float through the modules of the ISS and see how astronauts live, sleep and work in orbit.',
  },
  {
    yt: 'ScMzIvxBSi4',
    title: 'The water cycle, explained for curious kids',
    channelId: 'ch-learn',
    categoryId: 'learning',
    duration: 428,
    views: 512_000,
    likes: 19_800,
    days: 9,
    description: 'Where does rain come from? A simple walk through evaporation, clouds and rain.',
  },
]

export const videos: Video[] = seeds.map((s, i) => ({
  id: `v-${String(i + 1).padStart(3, '0')}`,
  title: s.title,
  description: s.description ?? '',
  sourceType: 'youtube',
  sourceUrl: `https://www.youtube.com/watch?v=${s.yt}`,
  youtubeId: s.yt,
  embeddable: true,
  thumbnailUrl: youTubeThumbnail(s.yt),
  durationSeconds: s.duration,
  channelId: s.channelId,
  categoryId: s.categoryId,
  publishedAt: daysAgo(s.days, s.hours ?? 0),
  viewCount: s.views,
  likeCount: s.likes,
  isLive: s.duration === 0,
  status: 'published',
  pinned: s.pinned,
}))

export const playlists: Playlist[] = [
  {
    id: 'pl-music',
    title: 'Music',
    description: 'The songs everyone knows.',
    videoIds: videos.filter((v) => v.categoryId === 'music').map((v) => v.id),
    updatedAt: daysAgo(2),
  },
  {
    id: 'pl-watch-later',
    title: 'Watch later',
    videoIds: [videos[2], videos[6], videos[14]]
      .filter(Boolean)
      .map((v) => v.id),
    updatedAt: daysAgo(1),
  },
  {
    id: 'pl-science',
    title: 'Science & space',
    description: 'Big questions, clearly explained.',
    videoIds: videos.filter((v) => v.categoryId === 'science').map((v) => v.id),
    updatedAt: daysAgo(4),
  },
]

/** Deterministic pseudo-avatar so placeholder channels still look real. */
export function channelAvatar(channel: Channel): string {
  if (channel.avatarUrl) return channel.avatarUrl
  const initials = channel.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
  const hue = [...channel.id].reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="88" height="88"><rect width="88" height="88" fill="hsl(${hue} 62% 45%)"/><text x="44" y="44" font-family="Roboto,Arial,sans-serif" font-size="34" font-weight="500" fill="#fff" text-anchor="middle" dominant-baseline="central">${initials}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
