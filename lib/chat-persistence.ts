// Redis-backed chat conversation persistence
// Uses the same lazy Redis initialization pattern as redis-database.ts

import { Redis } from '@upstash/redis'

// ── Types ────────────────────────────────────────────

export interface ConversationMeta {
  id: string
  title: string
  userEmail: string
  createdAt: string
  updatedAt: string
  messageCount: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toolInvocations?: Record<string, unknown>[]
  createdAt: string
}

// ── Redis Client (lazy init) ─────────────────────────

let redis: Redis | null = null

function getRedisClient(): Redis {
  if (typeof window !== 'undefined') {
    throw new Error('Redis operations can only be performed server-side')
  }

  if (!redis) {
    const redisUrl =
      process.env.UPSTASH_REDIS_REST_URL ||
      process.env.KV_REST_API_URL ||
      process.env.KV_URL
    const redisToken =
      process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN

    if (!redisUrl || !redisToken) {
      throw new Error(
        'Redis configuration is incomplete. Check environment variables.'
      )
    }

    redis = new Redis({ url: redisUrl, token: redisToken })
  }

  return redis
}

// ── Key Patterns ─────────────────────────────────────

const KEYS = {
  /** Sorted set: score = last updated timestamp */
  userConversations: (email: string) => `chat:${email}:conversations`,
  /** Hash: conversation metadata */
  conversationMeta: (id: string) => `chat:conversation:${id}`,
  /** List: serialized ChatMessage objects */
  conversationMessages: (id: string) => `chat:conversation:${id}:messages`,
}

/** 90 days in seconds */
const TTL_SECONDS = 90 * 24 * 60 * 60

// ── Public API ───────────────────────────────────────

/**
 * Create a new conversation and return its ID.
 */
export async function createConversation(
  userEmail: string,
  title?: string
): Promise<string> {
  const client = getRedisClient()
  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  const meta: ConversationMeta = {
    id,
    title: title || 'New conversation',
    userEmail,
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
  }

  // Store metadata
  await client.set(KEYS.conversationMeta(id), meta, { ex: TTL_SECONDS })

  // Add to user's sorted set (score = timestamp ms for ordering)
  await client.zadd(KEYS.userConversations(userEmail), {
    score: Date.now(),
    member: id,
  })

  // Initialize empty message list with TTL
  // (rpush requires at least one element — we use a sentinel that we skip on read)
  await client.set(KEYS.conversationMessages(id), JSON.stringify([]), {
    ex: TTL_SECONDS,
  })

  return id
}

/**
 * List conversations for a user, most recent first.
 * Returns metadata only (no messages).
 */
export async function getConversations(
  userEmail: string,
  limit: number = 50
): Promise<ConversationMeta[]> {
  const client = getRedisClient()

  // Fetch IDs from sorted set, highest score (most recent) first
  const ids = await client.zrange<string[]>(
    KEYS.userConversations(userEmail),
    0,
    limit - 1,
    { rev: true }
  )

  if (!ids || ids.length === 0) return []

  // Fetch all metadata in parallel
  const metas = await Promise.all(
    ids.map((id) => client.get<ConversationMeta>(KEYS.conversationMeta(id)))
  )

  return metas.filter((m): m is ConversationMeta => m !== null)
}

/**
 * Get a single conversation with its full message history.
 */
export async function getConversation(
  conversationId: string
): Promise<{ meta: ConversationMeta; messages: ChatMessage[] } | null> {
  const client = getRedisClient()

  const meta = await client.get<ConversationMeta>(
    KEYS.conversationMeta(conversationId)
  )
  if (!meta) return null

  const raw = await client.get<string>(
    KEYS.conversationMessages(conversationId)
  )

  let messages: ChatMessage[] = []
  if (raw) {
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      messages = Array.isArray(parsed) ? parsed : []
    } catch {
      messages = []
    }
  }

  return { meta, messages }
}

/**
 * Append new messages to a conversation.
 * Also updates the conversation's updatedAt timestamp and messageCount.
 */
export async function appendMessages(
  conversationId: string,
  messages: ChatMessage[]
): Promise<void> {
  if (messages.length === 0) return

  const client = getRedisClient()

  // Load existing messages
  const raw = await client.get<string>(
    KEYS.conversationMessages(conversationId)
  )

  let existing: ChatMessage[] = []
  if (raw) {
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      existing = Array.isArray(parsed) ? parsed : []
    } catch {
      existing = []
    }
  }

  // Append new messages
  const updated = [...existing, ...messages]
  await client.set(
    KEYS.conversationMessages(conversationId),
    JSON.stringify(updated),
    { ex: TTL_SECONDS }
  )

  // Update metadata
  const meta = await client.get<ConversationMeta>(
    KEYS.conversationMeta(conversationId)
  )
  if (meta) {
    meta.updatedAt = new Date().toISOString()
    meta.messageCount = updated.length
    await client.set(KEYS.conversationMeta(conversationId), meta, {
      ex: TTL_SECONDS,
    })

    // Update score in the user's sorted set so it surfaces as most recent
    await client.zadd(KEYS.userConversations(meta.userEmail), {
      score: Date.now(),
      member: conversationId,
    })
  }
}

/**
 * Update a conversation's title.
 */
export async function updateConversationTitle(
  conversationId: string,
  title: string
): Promise<void> {
  const client = getRedisClient()

  const meta = await client.get<ConversationMeta>(
    KEYS.conversationMeta(conversationId)
  )
  if (!meta) throw new Error('Conversation not found')

  meta.title = title
  meta.updatedAt = new Date().toISOString()
  await client.set(KEYS.conversationMeta(conversationId), meta, {
    ex: TTL_SECONDS,
  })
}

/**
 * Delete a conversation and all its data.
 */
export async function deleteConversation(
  userEmail: string,
  conversationId: string
): Promise<void> {
  const client = getRedisClient()

  // Remove from user's sorted set
  await client.zrem(KEYS.userConversations(userEmail), conversationId)

  // Delete metadata and messages
  await client.del(KEYS.conversationMeta(conversationId))
  await client.del(KEYS.conversationMessages(conversationId))
}

/**
 * Export a conversation as formatted Markdown.
 */
export async function exportConversation(
  conversationId: string
): Promise<string> {
  const data = await getConversation(conversationId)
  if (!data) throw new Error('Conversation not found')

  const { meta, messages } = data

  const lines: string[] = [
    `# ${meta.title}`,
    '',
    `**Date:** ${new Date(meta.createdAt).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`,
    `**Messages:** ${meta.messageCount}`,
    '',
    '---',
    '',
  ]

  for (const msg of messages) {
    const role = msg.role === 'user' ? 'You' : 'Assistant'
    const timestamp = new Date(msg.createdAt).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    })

    lines.push(`### ${role} — ${timestamp}`)
    lines.push('')
    lines.push(msg.content)
    lines.push('')
  }

  return lines.join('\n')
}
