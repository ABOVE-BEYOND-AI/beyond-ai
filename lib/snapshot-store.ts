// Daily snapshot storage — persists Overview, Dial Pace, and AI Digest data in Redis.
// Snapshots are taken at 1pm (midday) and 6pm (eod) on weekdays via Vercel Cron.
// Retained indefinitely (~22MB/year at current team size).

import { Redis } from '@upstash/redis'

export type SnapshotSlot = 'midday' | 'eod'
export type SnapshotType = 'overview' | 'dial_pace' | 'digest'

const KEYS = {
  snapshot: (date: string, slot: SnapshotSlot, type: SnapshotType) =>
    `snapshot:${date}:${slot}:${type}`,
  dates: 'snapshot:dates', // sorted set — score = unix timestamp of date
}

let redis: Redis | null = null
function getRedis(): Redis | null {
  if (redis) return redis
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
  if (!url || !token) return null
  redis = new Redis({ url, token })
  return redis
}

/**
 * Save a snapshot to Redis. No TTL — retained indefinitely.
 */
export async function saveSnapshot(
  date: string,
  slot: SnapshotSlot,
  type: SnapshotType,
  data: unknown
): Promise<void> {
  const r = getRedis()
  if (!r) return

  const pipeline = r.pipeline()
  pipeline.set(KEYS.snapshot(date, slot, type), data)
  // Track this date in the sorted set (score = midnight unix timestamp for ordering)
  const score = new Date(`${date}T00:00:00Z`).getTime() / 1000
  pipeline.zadd(KEYS.dates, { score, member: date })
  await pipeline.exec()
}

/**
 * Retrieve a specific snapshot.
 */
export async function getSnapshot<T = unknown>(
  date: string,
  slot: SnapshotSlot,
  type: SnapshotType
): Promise<T | null> {
  const r = getRedis()
  if (!r) return null
  return r.get<T>(KEYS.snapshot(date, slot, type))
}

/**
 * Get all snapshots for a given date (both slots, all types).
 */
export async function getSnapshotDay(date: string): Promise<{
  midday: { overview: unknown; dial_pace: unknown; digest: unknown } | null
  eod: { overview: unknown; dial_pace: unknown; digest: unknown } | null
}> {
  const r = getRedis()
  if (!r) return { midday: null, eod: null }

  const slots: SnapshotSlot[] = ['midday', 'eod']
  const types: SnapshotType[] = ['overview', 'dial_pace', 'digest']

  const keys = slots.flatMap(slot => types.map(type => KEYS.snapshot(date, slot, type)))
  const pipeline = r.pipeline()
  for (const key of keys) {
    pipeline.get(key)
  }
  const results = await pipeline.exec()

  const get = (slotIdx: number, typeIdx: number) => {
    const idx = slotIdx * 3 + typeIdx
    return results[idx] ?? null
  }

  const buildSlot = (slotIdx: number) => {
    const overview = get(slotIdx, 0)
    const dial_pace = get(slotIdx, 1)
    const digest = get(slotIdx, 2)
    if (!overview && !dial_pace && !digest) return null
    return { overview, dial_pace, digest }
  }

  return {
    midday: buildSlot(0),
    eod: buildSlot(1),
  }
}

/**
 * List all dates that have snapshots, newest first.
 */
export async function listSnapshotDates(
  limit = 30,
  offset = 0
): Promise<{ dates: string[]; total: number }> {
  const r = getRedis()
  if (!r) return { dates: [], total: 0 }

  const [total, members] = await Promise.all([
    r.zcard(KEYS.dates),
    r.zrange(KEYS.dates, offset, offset + limit - 1, { rev: true }),
  ])

  return {
    dates: members as string[],
    total,
  }
}
