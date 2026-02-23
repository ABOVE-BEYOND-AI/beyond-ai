// Email sequence scheduling engine — Redis-backed queue with sorted-set scheduling

import { Redis } from '@upstash/redis'
import { sendEmail } from './gmail'
import { getUserTokens } from './redis-database'
import { refreshAccessToken } from './google-oauth-clean'

// ── Types ──

export interface SequenceStep {
  day: number
  subject: string
  body: string
  scheduledAt: string | null
  sentAt: string | null
}

export interface EmailSequence {
  id: string
  templateId: string
  contactId: string
  contactEmail: string
  contactName: string
  repEmail: string
  repName: string
  status: 'active' | 'paused' | 'completed' | 'cancelled'
  currentStep: number
  steps: SequenceStep[]
  startedAt: string
  updatedAt: string
}

export interface StartSequenceParams {
  templateId: string
  contactId: string
  contactEmail: string
  contactName: string
  repEmail: string
  repName: string
  steps: { day: number; subject: string; body: string }[]
}

export interface ProcessQueueResult {
  processed: number
  sent: number
  errors: string[]
}

// ── Redis client (same pattern as redis-database.ts) ──

let redis: Redis | null = null

function getRedisClient(): Redis {
  if (typeof window !== 'undefined') {
    throw new Error('Email sequence operations can only be performed server-side')
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

// ── Redis key patterns ──

const KEYS = {
  sequence: (id: string) => `sequence:${id}`,
  queue: 'sequence_queue',                          // sorted set: score = next send ts, member = sequenceId
  repSequences: (email: string) => `rep_sequences:${email}`,  // set of sequence IDs for a rep
  stats: (email: string) => `outreach_stats:${email}`,        // hash: emails_sent, etc.
}

// ── Helpers ──

function generateId(): string {
  return `seq_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Calculate the UTC timestamp for a given day offset from now.
 * Day 1 = send immediately (within the next minute), Day 3 = +2 days from now, etc.
 */
function scheduleTimestamp(day: number, startedAt: Date): number {
  const ts = new Date(startedAt)
  // Day 1 means now; day N means (N-1) days later, at 9:00 AM UTC
  ts.setUTCDate(ts.getUTCDate() + (day - 1))
  ts.setUTCHours(9, 0, 0, 0)
  // If the scheduled time is in the past (e.g., day 1 and it's already past 9 AM), send in 1 minute
  if (ts.getTime() < Date.now()) {
    return Date.now() + 60_000
  }
  return ts.getTime()
}

/**
 * Get a fresh access token for a user, refreshing if necessary.
 */
async function getFreshAccessToken(email: string): Promise<string> {
  const tokens = await getUserTokens(email)
  if (!tokens?.google_access_token) {
    throw new Error(`No Google tokens found for ${email}`)
  }

  // If token is still valid (> 5 min left), use it
  if (tokens.google_token_expires_at && (tokens.google_token_expires_at - Date.now()) > 5 * 60 * 1000) {
    return tokens.google_access_token
  }

  // Otherwise refresh
  if (!tokens.google_refresh_token) {
    throw new Error(`No refresh token for ${email} — user needs to re-authenticate`)
  }

  const refreshed = await refreshAccessToken(tokens.google_refresh_token)

  // Persist the new tokens (import inline to avoid circular deps)
  const { saveUserTokens } = await import('./redis-database')
  await saveUserTokens(email, {
    google_access_token: refreshed.access_token,
    google_token_expires_at: refreshed.expires_at,
    google_refresh_token: tokens.google_refresh_token,
  })

  return refreshed.access_token
}

// ── Core Functions ──

/**
 * Start a new email sequence. Creates the sequence object, stores it in Redis,
 * and enqueues the first step in the sorted-set queue.
 */
export async function startSequence(params: StartSequenceParams): Promise<EmailSequence> {
  const r = getRedisClient()
  const id = generateId()
  const now = new Date()

  const steps: SequenceStep[] = params.steps.map((s, i) => {
    const scheduledAt = i === 0
      ? new Date(scheduleTimestamp(s.day, now)).toISOString()
      : null
    return {
      day: s.day,
      subject: s.subject,
      body: s.body,
      scheduledAt,
      sentAt: null,
    }
  })

  const sequence: EmailSequence = {
    id,
    templateId: params.templateId,
    contactId: params.contactId,
    contactEmail: params.contactEmail,
    contactName: params.contactName,
    repEmail: params.repEmail,
    repName: params.repName,
    status: 'active',
    currentStep: 0,
    steps,
    startedAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }

  // Store sequence object
  await r.set(KEYS.sequence(id), sequence)

  // Add to rep's sequence list
  await r.sadd(KEYS.repSequences(params.repEmail), id)

  // Enqueue first step
  const firstSendAt = scheduleTimestamp(params.steps[0].day, now)
  await r.zadd(KEYS.queue, { score: firstSendAt, member: id })

  return sequence
}

/**
 * Pause a sequence — removes it from the queue but keeps the sequence object.
 */
export async function pauseSequence(id: string): Promise<EmailSequence> {
  const r = getRedisClient()
  const seq = await getSequence(id)
  if (!seq) throw new Error(`Sequence ${id} not found`)
  if (seq.status !== 'active') throw new Error(`Sequence ${id} is not active (status: ${seq.status})`)

  seq.status = 'paused'
  seq.updatedAt = new Date().toISOString()

  await r.set(KEYS.sequence(id), seq)
  await r.zrem(KEYS.queue, id)

  return seq
}

/**
 * Resume a paused sequence — re-enqueues the current step.
 */
export async function resumeSequence(id: string): Promise<EmailSequence> {
  const r = getRedisClient()
  const seq = await getSequence(id)
  if (!seq) throw new Error(`Sequence ${id} not found`)
  if (seq.status !== 'paused') throw new Error(`Sequence ${id} is not paused (status: ${seq.status})`)

  seq.status = 'active'
  seq.updatedAt = new Date().toISOString()

  // Schedule current step for now + 1 minute
  const currentStep = seq.steps[seq.currentStep]
  if (currentStep) {
    const sendAt = Date.now() + 60_000
    currentStep.scheduledAt = new Date(sendAt).toISOString()
    await r.zadd(KEYS.queue, { score: sendAt, member: id })
  }

  await r.set(KEYS.sequence(id), seq)

  return seq
}

/**
 * Cancel a sequence permanently.
 */
export async function cancelSequence(id: string): Promise<EmailSequence> {
  const r = getRedisClient()
  const seq = await getSequence(id)
  if (!seq) throw new Error(`Sequence ${id} not found`)

  seq.status = 'cancelled'
  seq.updatedAt = new Date().toISOString()

  await r.set(KEYS.sequence(id), seq)
  await r.zrem(KEYS.queue, id)

  return seq
}

/**
 * Delete a sequence entirely from Redis.
 */
export async function deleteSequence(id: string): Promise<void> {
  const r = getRedisClient()
  const seq = await getSequence(id)
  if (!seq) return

  await r.del(KEYS.sequence(id))
  await r.zrem(KEYS.queue, id)
  await r.srem(KEYS.repSequences(seq.repEmail), id)
}

/**
 * Get a single sequence by ID.
 */
export async function getSequence(id: string): Promise<EmailSequence | null> {
  const r = getRedisClient()
  return await r.get(KEYS.sequence(id)) as EmailSequence | null
}

/**
 * Get all active/paused sequences, optionally filtered by rep email.
 */
export async function getActiveSequences(repEmail?: string): Promise<EmailSequence[]> {
  const r = getRedisClient()

  if (repEmail) {
    const ids = await r.smembers(KEYS.repSequences(repEmail))
    if (!ids || ids.length === 0) return []

    const sequences = await Promise.all(
      ids.map(id => getSequence(id))
    )
    return sequences
      .filter((s): s is EmailSequence => s !== null)
      .filter(s => s.status === 'active' || s.status === 'paused')
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }

  // Without a rep filter, we'd need a global index. For now, return empty.
  // In production you'd maintain a global active-sequences set.
  return []
}

/**
 * Get total count of active sequences for a rep.
 */
export async function getSequenceCount(repEmail?: string): Promise<number> {
  const sequences = await getActiveSequences(repEmail)
  return sequences.length
}

/**
 * Get outreach stats for a rep (emails sent count).
 */
export async function getOutreachStats(repEmail: string): Promise<{ emailsSent: number }> {
  const r = getRedisClient()
  const sent = await r.hget(KEYS.stats(repEmail), 'emails_sent')
  return {
    emailsSent: typeof sent === 'number' ? sent : parseInt(String(sent || '0'), 10),
  }
}

/**
 * Increment the emails-sent counter for a rep.
 */
async function incrementEmailsSent(repEmail: string): Promise<void> {
  const r = getRedisClient()
  await r.hincrby(KEYS.stats(repEmail), 'emails_sent', 1)
}

/**
 * Process the queue — fetch all sequences whose next-send timestamp <= now,
 * send the email, advance the sequence, and schedule the next step.
 *
 * This is designed to be called by a cron job (e.g., every 1-5 minutes).
 */
export async function processQueue(): Promise<ProcessQueueResult> {
  const r = getRedisClient()
  const now = Date.now()
  const result: ProcessQueueResult = { processed: 0, sent: 0, errors: [] }

  // Fetch all due sequence IDs (score <= now) using zrange with byScore option
  const dueIds = await r.zrange<string[]>(KEYS.queue, 0, now, { byScore: true })

  if (!dueIds || dueIds.length === 0) {
    return result
  }

  for (const seqId of dueIds) {
    result.processed++

    try {
      const seq = await getSequence(seqId)
      if (!seq) {
        // Stale entry — remove from queue
        await r.zrem(KEYS.queue, seqId)
        continue
      }

      if (seq.status !== 'active') {
        await r.zrem(KEYS.queue, seqId)
        continue
      }

      const step = seq.steps[seq.currentStep]
      if (!step) {
        // No more steps — mark completed
        seq.status = 'completed'
        seq.updatedAt = new Date().toISOString()
        await r.set(KEYS.sequence(seqId), seq)
        await r.zrem(KEYS.queue, seqId)
        continue
      }

      // Get a fresh access token for the rep
      const accessToken = await getFreshAccessToken(seq.repEmail)

      // Send the email
      await sendEmail(accessToken, {
        to: seq.contactEmail,
        subject: step.subject,
        htmlBody: step.body,
      })

      // Mark step as sent
      step.sentAt = new Date().toISOString()
      result.sent++

      // Increment stats
      await incrementEmailsSent(seq.repEmail)

      // Advance to next step
      seq.currentStep++
      seq.updatedAt = new Date().toISOString()

      // Remove current entry from queue
      await r.zrem(KEYS.queue, seqId)

      // Schedule next step if there is one
      if (seq.currentStep < seq.steps.length) {
        const nextStep = seq.steps[seq.currentStep]
        const nextSendAt = scheduleTimestamp(nextStep.day, new Date(seq.startedAt))
        nextStep.scheduledAt = new Date(nextSendAt).toISOString()
        await r.zadd(KEYS.queue, { score: nextSendAt, member: seqId })
      } else {
        seq.status = 'completed'
      }

      // Persist updated sequence
      await r.set(KEYS.sequence(seqId), seq)

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      result.errors.push(`${seqId}: ${msg}`)
      console.error(`Error processing sequence ${seqId}:`, msg)
      // Remove from queue to avoid infinite retries; the sequence stays 'active'
      // so it can be manually retried or resumed
      await r.zrem(KEYS.queue, seqId)
    }
  }

  return result
}
