// Notification storage and preferences using Redis
// Sorted sets for notifications (score = timestamp), hash for preferences

import { Redis } from '@upstash/redis'
import type { AppNotification, NotificationPreferences } from './salesforce-types'

let redis: Redis | null = null

function getRedisClient(): Redis {
  if (typeof window !== 'undefined') {
    throw new Error('Redis operations can only be performed server-side')
  }
  if (!redis) {
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || process.env.KV_URL
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
    if (!redisUrl || !redisToken) {
      throw new Error('Redis configuration is incomplete. Check environment variables.')
    }
    redis = new Redis({ url: redisUrl, token: redisToken })
  }
  return redis
}

// Redis key patterns
const KEYS = {
  notifications: (email: string) => `notifications:${email}`,
  preferences: (email: string) => `notification_prefs:${email}`,
}

// Default preferences — all on except slack
const DEFAULT_PREFERENCES: NotificationPreferences = {
  stale_deals: true,
  payment_overdue: true,
  call_reminders: true,
  follow_up_reminders: true,
  new_leads: true,
  daily_recap: true,
  slack_dm: false,
}

// ── Notification CRUD ──

export async function createNotification(
  email: string,
  notification: { type: AppNotification['type']; title: string; body: string; link?: string }
): Promise<AppNotification> {
  const client = getRedisClient()
  const now = Date.now()
  const id = `notif_${now}_${Math.random().toString(36).slice(2, 9)}`

  const entry: AppNotification = {
    id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    link: notification.link,
    read: false,
    createdAt: new Date(now).toISOString(),
  }

  // Store in sorted set — score is timestamp for chronological ordering
  await client.zadd(KEYS.notifications(email), {
    score: now,
    member: JSON.stringify(entry),
  })

  // Trim to keep at most 200 notifications per user (remove oldest)
  const count = await client.zcard(KEYS.notifications(email))
  if (count > 200) {
    await client.zremrangebyrank(KEYS.notifications(email), 0, count - 201)
  }

  return entry
}

export async function getAllNotifications(email: string, limit: number = 50): Promise<AppNotification[]> {
  const client = getRedisClient()
  // Get newest first (highest score = most recent)
  const raw = await client.zrange(KEYS.notifications(email), 0, limit - 1, { rev: true })
  return parseNotifications(raw)
}

export async function getUnreadNotifications(email: string, limit: number = 50): Promise<AppNotification[]> {
  const all = await getAllNotifications(email, 200)
  return all.filter((n) => !n.read).slice(0, limit)
}

export async function getUnreadCount(email: string): Promise<number> {
  const all = await getAllNotifications(email, 200)
  return all.filter((n) => !n.read).length
}

export async function markRead(email: string, notificationId: string): Promise<void> {
  const client = getRedisClient()
  const raw = await client.zrange(KEYS.notifications(email), 0, -1, { rev: true })
  const notifications = parseNotifications(raw)

  for (const notif of notifications) {
    if (notif.id === notificationId && !notif.read) {
      // Remove old entry
      await client.zrem(KEYS.notifications(email), JSON.stringify(notif))
      // Re-add with read = true (same score to keep ordering)
      const updated = { ...notif, read: true }
      const score = new Date(notif.createdAt).getTime()
      await client.zadd(KEYS.notifications(email), {
        score,
        member: JSON.stringify(updated),
      })
      break
    }
  }
}

export async function markAllRead(email: string): Promise<void> {
  const client = getRedisClient()
  const raw = await client.zrange(KEYS.notifications(email), 0, -1, { rev: true })
  const notifications = parseNotifications(raw)

  const unread = notifications.filter((n) => !n.read)
  if (unread.length === 0) return

  // Pipeline: remove all unread, re-add with read = true
  const pipeline = client.pipeline()
  for (const notif of unread) {
    pipeline.zrem(KEYS.notifications(email), JSON.stringify(notif))
  }
  await pipeline.exec()

  const addPipeline = client.pipeline()
  for (const notif of unread) {
    const updated = { ...notif, read: true }
    const score = new Date(notif.createdAt).getTime()
    addPipeline.zadd(KEYS.notifications(email), {
      score,
      member: JSON.stringify(updated),
    })
  }
  await addPipeline.exec()
}

// ── Preferences ──

export async function getPreferences(email: string): Promise<NotificationPreferences> {
  const client = getRedisClient()
  const raw = await client.hgetall(KEYS.preferences(email))
  if (!raw || Object.keys(raw).length === 0) {
    return { ...DEFAULT_PREFERENCES }
  }
  // Parse boolean strings from Redis hash
  const prefs: NotificationPreferences = { ...DEFAULT_PREFERENCES }
  for (const [key, value] of Object.entries(raw)) {
    if (key in prefs) {
      (prefs as unknown as Record<string, boolean>)[key] = value === 'true' || value === true
    }
  }
  return prefs
}

export async function updatePreferences(
  email: string,
  updates: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  const client = getRedisClient()
  const current = await getPreferences(email)
  const merged = { ...current, ...updates }

  // Store each key as a string in the hash
  const hashData: Record<string, string> = {}
  for (const [key, value] of Object.entries(merged)) {
    hashData[key] = String(value)
  }
  await client.hset(KEYS.preferences(email), hashData)
  return merged
}

// ── Helpers ──

function parseNotifications(raw: unknown[]): AppNotification[] {
  return raw
    .map((item) => {
      try {
        if (typeof item === 'string') return JSON.parse(item) as AppNotification
        if (typeof item === 'object' && item !== null) return item as AppNotification
        return null
      } catch {
        return null
      }
    })
    .filter((n): n is AppNotification => n !== null)
}
