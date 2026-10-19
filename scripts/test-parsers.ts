/**
 * Pure-logic tests. Run with `npm test`.
 *
 * Covers the link parsers and formatters, which are the parts most likely to
 * break silently — a mis-parsed Bilibili id would produce a video that simply
 * never plays, with no error anywhere.
 */

import {
  formatCount,
  formatDuration,
  isBilibiliShortLink,
  normalizePriority,
  parseBilibiliId,
  parseDurationInput,
  parseYouTubeId,
  timeAgo,
  weightedShuffle,
} from '../src/lib/format.ts'
import { parseIsoDuration } from '../src/lib/youtube.ts'

let passed = 0
let failed = 0

function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const b = JSON.stringify(expected)
  if (a === b) {
    passed++
    console.log(`PASS  ${label}`)
  } else {
    failed++
    console.log(`FAIL  ${label}\n        got      ${a}\n        expected ${b}`)
  }
}

console.log('\n--- YouTube link parsing ---')
check('watch url', parseYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ')
check('short url', parseYouTubeId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ')
check('shorts url', parseYouTubeId('https://youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ')
check('extra params', parseYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s'), 'dQw4w9WgXcQ')
check('bare id', parseYouTubeId('dQw4w9WgXcQ'), 'dQw4w9WgXcQ')
check('not youtube', parseYouTubeId('https://www.bilibili.com/video/BV1GJ411x7h7'), null)
check('empty', parseYouTubeId(''), null)

console.log('\n--- Bilibili link parsing ---')
check('watch url', parseBilibiliId('https://www.bilibili.com/video/BV1GJ411x7h7'), {
  kind: 'bvid',
  value: 'BV1GJ411x7h7',
  page: 1,
})
check('with part', parseBilibiliId('https://www.bilibili.com/video/BV1GJ411x7h7/?p=3'), {
  kind: 'bvid',
  value: 'BV1GJ411x7h7',
  page: 3,
})
check('player embed', parseBilibiliId('https://player.bilibili.com/player.html?bvid=BV1GJ411x7h7&page=2'), {
  kind: 'bvid',
  value: 'BV1GJ411x7h7',
  page: 2,
})
check('legacy av id', parseBilibiliId('https://www.bilibili.com/video/av12345'), {
  kind: 'aid',
  value: '12345',
  page: 1,
})
check('bare bv id', parseBilibiliId('BV1GJ411x7h7'), {
  kind: 'bvid',
  value: 'BV1GJ411x7h7',
  page: 1,
})
check('not bilibili', parseBilibiliId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), null)
check('empty', parseBilibiliId(''), null)

console.log('\n--- Bilibili short links ---')
check('b23.tv detected', isBilibiliShortLink('https://b23.tv/abc123'), true)
check('full url is not short', isBilibiliShortLink('https://www.bilibili.com/video/BV1GJ411x7h7'), false)

console.log('\n--- ISO-8601 durations (YouTube) ---')
check('minutes+seconds', parseIsoDuration('PT3M33S'), 213)
check('hours', parseIsoDuration('PT1H2M3S'), 3723)
check('days', parseIsoDuration('P1DT2H'), 93600)
check('seconds only', parseIsoDuration('PT58S'), 58)
check('zero', parseIsoDuration('PT0S'), 0)
check('garbage', parseIsoDuration('nonsense'), 0)
check('undefined', parseIsoDuration(undefined), 0)

console.log('\n--- Manual duration entry (Bilibili) ---')
check('mm:ss', parseDurationInput('12:34'), 754)
check('h:mm:ss', parseDurationInput('1:02:03'), 3723)
check('plain seconds', parseDurationInput('90'), 90)
check('blank', parseDurationInput(''), 0)
check('garbage', parseDurationInput('abc'), 0)
check('too many parts', parseDurationInput('1:2:3:4'), 0)

console.log('\n--- display formatting ---')
check('duration 754', formatDuration(754), '12:34')
check('duration 3723', formatDuration(3723), '1:02:03')
check('count 999', formatCount(999), '999')
check('count 1234 -> one decimal below 10', formatCount(1234), '1.2K')
check('count 45600 -> no decimal from 10 up', formatCount(45600), '45K')
check('count 456000 -> no decimal', formatCount(456000), '456K')
check('count 9800 -> one decimal', formatCount(9800), '9.8K')
check('count 1.2M', formatCount(1_234_567), '1.2M')
check('count 12M', formatCount(12_345_678), '12M')
check('count 1.8B', formatCount(1_800_000_000), '1.8B')
check('count zero', formatCount(0), '0')

const now = new Date('2026-01-10T12:00:00Z')
check('2 hours ago', timeAgo('2026-01-10T10:00:00Z', now), '2 hours ago')
check('1 day ago', timeAgo('2026-01-09T12:00:00Z', now), '1 day ago')
check('3 days ago', timeAgo('2026-01-07T12:00:00Z', now), '3 days ago')

console.log('\n--- home ordering (weighted shuffle) ---')

{
  const pair = [
    { id: 'low', p: 1 },
    { id: 'high', p: 5 },
  ]
  const rounds = 6000
  let highFirst = 0
  const orders = new Set<string>()
  for (let i = 0; i < rounds; i++) {
    const out = weightedShuffle(pair, (x) => normalizePriority(x.p))
    orders.add(out.map((x) => x.id).join(','))
    if (out[0].id === 'high') highFirst++
  }
  const share = highFirst / rounds
  // Theory says 5/(5+1) = 0.833.
  console.log(`      priority 5 came first ${(share * 100).toFixed(1)}% of the time (theory 83.3%)`)
  check('priority 5 usually beats priority 1', share > 0.75 && share < 0.9, true)
  check('both orders really do occur', orders.size, 2)

  const many = Array.from({ length: 40 }, (_, i) => ({ id: `v${i}`, p: (i % 5) + 1 }))
  const shuffled = weightedShuffle(many, (x) => normalizePriority(x.p))
  check('nothing is lost', shuffled.length, 40)
  check('no duplicates', new Set(shuffled.map((x) => x.id)).size, 40)
  check('not left in the original order', shuffled.map((x) => x.id).join() === many.map((x) => x.id).join(), false)

  check('priority above range clamps to 5', normalizePriority(99), 5)
  check('priority below range clamps to 1', normalizePriority(0), 1)
  check('missing priority defaults to 3', normalizePriority(undefined), 3)
  check('priority 4.6 rounds to 5', normalizePriority(4.6), 5)
}

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed === 0 ? 0 : 1)
