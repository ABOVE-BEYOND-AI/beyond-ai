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
  }

  await r.set(KEYS.event(id), next)
  return next
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


