import { Redis } from '@upstash/redis'
import { EventItem } from './types'

let redis: Redis | null = null

function getRedis(): Redis {
  if (typeof window !== 'undefined') {
    throw new Error('Redis operations can only be performed server-side')
  }
  if (!redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || process.env.KV_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
    if (!url || !token) {
      throw new Error('Redis configuration is incomplete. Check environment variables.')
    }
    redis = new Redis({ url, token })
  }
  return redis
}

const KEYS = {
  all: 'events:all',
  event: (id: string) => `event:${id}`,
  byCategory: (slug: string) => `events:category:${slug}`,
  byMonth: (yyyyMM: string) => `events:byDate:${yyyyMM}`,
  byMonthZ: (yyyyMM: string) => `events:byDate:${yyyyMM}:z`, // sorted by startDate
}

function monthKeyFromIso(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export async function saveEvent(input: Omit<EventItem, 'id' | 'created_at' | 'updated_at'> & { id?: string }): Promise<string> {
  const r = getRedis()
  const id = input.id || `event_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  const now = new Date().toISOString()
  const event: EventItem = { id, created_at: now, updated_at: now, ...input }
  await r.set(KEYS.event(id), event)
  await r.sadd(KEYS.all, id)
  if (event.category) await r.sadd(KEYS.byCategory(event.category), id)
  const mk = monthKeyFromIso(event.startDate)
  await r.sadd(KEYS.byMonth(mk), id)
  // maintain sorted month index for fast ordered reads
  await r.zadd(KEYS.byMonthZ(mk), { score: Date.parse(event.startDate), member: id })
  return id
}

export async function getEvent(id: string): Promise<EventItem | null> {
  const r = getRedis()
  return (await r.get(KEYS.event(id))) as EventItem | null
}

export async function deleteEvent(id: string): Promise<boolean> {
  const r = getRedis()
  const ev = (await r.get(KEYS.event(id))) as EventItem | null
  if (!ev) return false
  await r.del(KEYS.event(id))
  await r.srem(KEYS.all, id)
  if (ev.category) await r.srem(KEYS.byCategory(ev.category), id)
  await r.srem(KEYS.byMonth(monthKeyFromIso(ev.startDate)), id)
  await r.zrem(KEYS.byMonthZ(monthKeyFromIso(ev.startDate)), id)
  return true
}

export async function updateEvent(id: string, updates: Partial<Omit<EventItem, 'id' | 'created_at' | 'updated_at'>>): Promise<EventItem | null> {
  const r = getRedis()
  const existing = (await r.get(KEYS.event(id))) as EventItem | null
  if (!existing) return null
  const next: EventItem = {
    ...existing,
    ...updates,
    id: existing.id,
    created_at: existing.created_at,
    updated_at: new Date().toISOString(),
  }

  // If category or month changed, adjust indexes
  if (updates.category && updates.category !== existing.category) {
    await r.srem(KEYS.byCategory(existing.category), id)
    await r.sadd(KEYS.byCategory(next.category), id)
  }
  if (updates.startDate && monthKeyFromIso(updates.startDate) !== monthKeyFromIso(existing.startDate)) {
    await r.srem(KEYS.byMonth(monthKeyFromIso(existing.startDate)), id)
    await r.sadd(KEYS.byMonth(monthKeyFromIso(next.startDate)), id)
    await r.zrem(KEYS.byMonthZ(monthKeyFromIso(existing.startDate)), id)
    await r.zadd(KEYS.byMonthZ(monthKeyFromIso(next.startDate)), { score: Date.parse(next.startDate), member: id })
  } else if (updates.startDate) {
    // If only the time changed within same month, update score
    await r.zadd(KEYS.byMonthZ(monthKeyFromIso(next.startDate)), { score: Date.parse(next.startDate), member: id })
  }

  await r.set(KEYS.event(id), next)
  return next
}

/**
 * Optimized listing using ZSET + MGET. Optionally returns minimal fields for grid/list views
 */
export async function listEventsOptimized(params?: { month?: string; category?: string; limit?: number; offset?: number; q?: string; fields?: 'grid' | 'list' | 'all' }): Promise<Partial<EventItem>[]> {
  const r = getRedis()
  const month = params?.month
  const limit = params?.limit ?? 200
  const offset = params?.offset ?? 0
  let ids: string[] = []

  if (month) {
    // ordered ids by start date
    ids = (await r.zrange(KEYS.byMonthZ(month), offset, offset + limit - 1)) as string[]
    if (ids.length === 0) {
      // Fallback: backfill ZSET from existing set index for this month (one-time cost)
      const setIds = (await r.smembers(KEYS.byMonth(month))) as string[]
      if (setIds.length > 0) {
        // Fetch events to compute scores
        const fetched = await Promise.all(
          setIds.map(async (id) => {
            const ev = (await r.get(KEYS.event(id))) as EventItem | null
            return ev ? { id, score: Date.parse(ev.startDate) } : null
          })
        )
        const pairs = fetched.filter(Boolean) as { id: string; score: number }[]
        if (pairs.length > 0) {
          // Add to ZSET
          for (const p of pairs) {
            await r.zadd(KEYS.byMonthZ(month), { score: p.score, member: p.id })
          }
          // Now read ordered ids
          ids = (await r.zrange(KEYS.byMonthZ(month), offset, offset + limit - 1)) as string[]
          if (ids.length === 0) {
            // As a last resort, sort locally
            ids = pairs.sort((a, b) => a.score - b.score).slice(offset, offset + limit).map((p) => p.id)
          }
        }
      }
    }
  } else if (params?.category) {
    const raw = (await r.smembers(KEYS.byCategory(params.category))) as string[]
    ids = raw.slice(offset, offset + limit)
  } else {
    const raw = (await r.smembers(KEYS.all)) as string[]
    ids = raw.slice(offset, offset + limit)
  }

  if (ids.length === 0) return []

  // MGET all events
  const keys = ids.map((id) => KEYS.event(id))
  // Upstash Redis client doesn't expose mget in types; cast to unknown and call if available
  const client = r as unknown as { mget?: (...k: string[]) => Promise<unknown[]> }
  const results = client.mget ? (await client.mget(...keys)) as (EventItem | null)[] : await Promise.all(keys.map((k) => r.get(k) as Promise<EventItem | null>))
  let events: EventItem[] = (results as (EventItem | null)[]).filter(Boolean) as EventItem[]

  // Search filter
  const q = params?.q?.toLowerCase().trim()
  if (q) {
    events = events.filter((e) =>
      e.name.toLowerCase().includes(q) ||
      e.location.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q)
    )
  }

  // Shape based on fields param
  const f = params?.fields ?? 'all'
  if (f === 'grid') {
    return events.map((e) => ({ id: e.id, name: e.name, startDate: e.startDate, endDate: e.endDate, category: e.category }))
  }
  if (f === 'list') {
    return events.map((e) => ({ id: e.id, name: e.name, startDate: e.startDate, endDate: e.endDate, location: e.location, description: e.description, category: e.category, imageUrl: (e as unknown as { imageUrl?: string }).imageUrl }))
  }
  return events
}

export async function listEvents(params?: { month?: string; category?: string; limit?: number; offset?: number; q?: string }): Promise<EventItem[]> {
  const r = getRedis()
  const limit = params?.limit ?? 50
  const offset = params?.offset ?? 0
  let ids: string[] = []

  if (params?.month) {
    ids = (await r.smembers(KEYS.byMonth(params.month))) as string[]
  } else if (params?.category) {
    ids = (await r.smembers(KEYS.byCategory(params.category))) as string[]
  } else {
    ids = (await r.smembers(KEYS.all)) as string[]
  }

  const events: EventItem[] = []
  for (const id of ids) {
    const ev = (await r.get(KEYS.event(id))) as EventItem | null
    if (ev) events.push(ev)
  }

  // Search filter
  const q = params?.q?.toLowerCase().trim()
  const filtered = q
    ? events.filter((e) =>
        e.name.toLowerCase().includes(q) ||
        e.location.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q)
      )
    : events

  // Sort by startDate ascending
  filtered.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())

  return filtered.slice(offset, offset + limit)
}


