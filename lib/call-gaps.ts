// Call gap tracking — "Time Between Dials"
// Stores gap data in Redis. Calculates idle time between consecutive calls per rep.
// Falls back to computing gaps from Aircall API data when Redis has no webhook data.

import { Redis } from '@upstash/redis'
import type { AircallCall } from './aircall'

// ── Types ──

export interface CallGap {
  previous_call_id: number
  previous_call_ended_at: number // unix timestamp
  previous_call_direction: 'inbound' | 'outbound'
  current_call_id: number
  current_call_started_at: number // unix timestamp
  current_call_direction: 'inbound' | 'outbound'
  gap_seconds: number
}

export interface RepDailySummary {
  aircall_user_id: number
  rep_name: string
  date: string // YYYY-MM-DD
  total_calls: number
  outbound_calls: number
  inbound_calls: number
  total_talk_time: number
  total_idle_time: number
  avg_gap_seconds: number
  max_gap_seconds: number
  min_gap_seconds: number
  gap_count: number
  gaps_over_5min: number
  updated_at: string
}

export interface LastCallEnded {
  call_id: number
  ended_at: number // unix timestamp
  direction: 'inbound' | 'outbound'
  rep_name: string
}

export interface LiveRepGap {
  aircall_user_id: number
  rep_name: string
  last_call_ended_at: number // unix timestamp
  current_idle_seconds: number
  avg_gap_seconds: number
  max_gap_seconds: number
  min_gap_seconds: number
  gap_count: number
  gaps_over_5min: number
  total_idle_time: number
  total_calls: number
}

// ── Config ──

const MAX_GAP_THRESHOLD = 3600 // 1 hour — gaps above this are excluded (overnight, lunch)
const GREEN_THRESHOLD = 120 // seconds — under 2 min = green
const AMBER_THRESHOLD = 300 // seconds — under 5 min = amber, above = red

export function getGapColor(seconds: number): 'green' | 'amber' | 'red' {
  if (seconds <= GREEN_THRESHOLD) return 'green'
  if (seconds <= AMBER_THRESHOLD) return 'amber'
  return 'red'
}

// ── Redis Keys ──

const KEYS = {
  lastCallEnded: (userId: number) => `gap:last_ended:${userId}`,
  dailyGaps: (userId: number, date: string) => `gap:daily:${userId}:${date}`,
  dailySummary: (userId: number, date: string) => `gap:summary:${userId}:${date}`,
  callEvent: (userId: number, date: string) => `gap:events:${userId}:${date}`,
  // Set of all user IDs that have gap data for a given date — keyed by ID only
  activeReps: (date: string) => `gap:active_reps:${date}`,
  // Separate hash for rep name lookup (avoids colon-in-name parsing issues)
  repName: (userId: number) => `gap:rep_name:${userId}`,
}

// ── Redis Client (singleton) ──

let redisInstance: Redis | null = null

function getRedis(): Redis | null {
  if (redisInstance) return redisInstance
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
  if (!url || !token) return null
  redisInstance = new Redis({ url, token })
  return redisInstance
}

// ── Core Logic ──

/**
 * Record that a call ended for a given user.
 * Stores the timestamp so we can calculate the gap when the next call starts.
 * Uses atomic pipeline — no read-modify-write race conditions for non-summary fields.
 * Summary is read then written, but concurrent webhooks for the same rep are rare
 * (a rep can only be on one call at a time) so the risk is minimal.
 */
export async function recordCallEnded(
  aircallUserId: number,
  repName: string,
  callId: number,
  endedAt: number,
  direction: 'inbound' | 'outbound',
  duration: number
): Promise<void> {
  const redis = getRedis()
  if (!redis) return

  try {
    const date = toDateString(endedAt)

    const lastEnded: LastCallEnded = {
      call_id: callId,
      ended_at: endedAt,
      direction,
      rep_name: repName,
    }

    // Read summary first (outside pipeline)
    const summaryKey = KEYS.dailySummary(aircallUserId, date)
    const existingSummary = await redis.get<RepDailySummary>(summaryKey)

    // Build pipeline with all writes
    const pipeline = redis.pipeline()

    // Store last call ended for this user (for gap calculation)
    pipeline.set(KEYS.lastCallEnded(aircallUserId), lastEnded, { ex: 86400 })

    // Track this rep as active today (by ID only — no colon parsing issues)
    pipeline.sadd(KEYS.activeReps(date), aircallUserId.toString())
    pipeline.expire(KEYS.activeReps(date), 172800)

    // Store rep name separately
    pipeline.set(KEYS.repName(aircallUserId), repName, { ex: 172800 })

    // Store call event for detail view
    const event = {
      type: 'call_ended' as const,
      call_id: callId,
      timestamp: endedAt,
      direction,
      duration,
    }
    pipeline.rpush(KEYS.callEvent(aircallUserId, date), JSON.stringify(event))
    pipeline.expire(KEYS.callEvent(aircallUserId, date), 7776000)

    // Update daily summary
    if (existingSummary) {
      existingSummary.total_calls += 1
      if (direction === 'outbound') existingSummary.outbound_calls += 1
      else existingSummary.inbound_calls += 1
      existingSummary.total_talk_time += duration
      existingSummary.updated_at = new Date().toISOString()
      pipeline.set(summaryKey, existingSummary, { ex: 7776000 })
    } else {
      const summary: RepDailySummary = {
        aircall_user_id: aircallUserId,
        rep_name: repName,
        date,
        total_calls: 1,
        outbound_calls: direction === 'outbound' ? 1 : 0,
        inbound_calls: direction === 'inbound' ? 1 : 0,
        total_talk_time: duration,
        total_idle_time: 0,
        avg_gap_seconds: 0,
        max_gap_seconds: 0,
        min_gap_seconds: 0,
        gap_count: 0,
        gaps_over_5min: 0,
        updated_at: new Date().toISOString(),
      }
      pipeline.set(summaryKey, summary, { ex: 7776000 })
    }

    await pipeline.exec()
  } catch (error) {
    console.error('❌ recordCallEnded Redis error:', error)
  }
}

/**
 * Record that a call started. Calculates the gap from the previous call.
 * Returns the gap if valid, null otherwise.
 */
export async function recordCallStarted(
  aircallUserId: number,
  repName: string,
  callId: number,
  startedAt: number,
  direction: 'inbound' | 'outbound'
): Promise<CallGap | null> {
  const redis = getRedis()
  if (!redis) return null

  try {
    const date = toDateString(startedAt)

    // Track rep and store event in a pipeline
    const setupPipeline = redis.pipeline()
    setupPipeline.sadd(KEYS.activeReps(date), aircallUserId.toString())
    setupPipeline.expire(KEYS.activeReps(date), 172800)
    setupPipeline.set(KEYS.repName(aircallUserId), repName, { ex: 172800 })
    setupPipeline.rpush(KEYS.callEvent(aircallUserId, date), JSON.stringify({
      type: 'call_started' as const,
      call_id: callId,
      timestamp: startedAt,
      direction,
    }))
    setupPipeline.expire(KEYS.callEvent(aircallUserId, date), 7776000)
    await setupPipeline.exec()

    // Look up previous call ended
    const lastEnded = await redis.get<LastCallEnded>(KEYS.lastCallEnded(aircallUserId))
    if (!lastEnded) return null // First call of the day or no previous data

    const gapSeconds = startedAt - lastEnded.ended_at

    // Validate gap
    if (gapSeconds <= 0) return null // Overlapping calls
    if (gapSeconds > MAX_GAP_THRESHOLD) return null // Overnight / lunch break

    const gap: CallGap = {
      previous_call_id: lastEnded.call_id,
      previous_call_ended_at: lastEnded.ended_at,
      previous_call_direction: lastEnded.direction,
      current_call_id: callId,
      current_call_started_at: startedAt,
      current_call_direction: direction,
      gap_seconds: gapSeconds,
    }

    // Store gap and update summary in a pipeline
    const gapPipeline = redis.pipeline()
    gapPipeline.rpush(KEYS.dailyGaps(aircallUserId, date), JSON.stringify(gap))
    gapPipeline.expire(KEYS.dailyGaps(aircallUserId, date), 31536000)
    await gapPipeline.exec()

    // Update daily summary with new gap
    await updateDailySummaryWithGap(redis, aircallUserId, repName, date, gapSeconds)

    return gap
  } catch (error) {
    console.error('❌ recordCallStarted Redis error:', error)
    return null
  }
}

/**
 * Update the rep's daily summary incrementally when a new gap is recorded.
 */
async function updateDailySummaryWithGap(
  redis: Redis,
  aircallUserId: number,
  repName: string,
  date: string,
  gapSeconds: number
): Promise<void> {
  try {
    const summaryKey = KEYS.dailySummary(aircallUserId, date)
    const existing = await redis.get<RepDailySummary>(summaryKey)

    if (existing) {
      existing.gap_count += 1
      existing.total_idle_time += gapSeconds
      existing.avg_gap_seconds = Math.round(existing.total_idle_time / existing.gap_count)
      existing.max_gap_seconds = Math.max(existing.max_gap_seconds, gapSeconds)
      existing.min_gap_seconds = existing.min_gap_seconds === 0
        ? gapSeconds
        : Math.min(existing.min_gap_seconds, gapSeconds)
      if (gapSeconds > 300) existing.gaps_over_5min += 1
      existing.updated_at = new Date().toISOString()
      await redis.set(summaryKey, existing, { ex: 7776000 })
    } else {
      const summary: RepDailySummary = {
        aircall_user_id: aircallUserId,
        rep_name: repName,
        date,
        total_calls: 0,
        outbound_calls: 0,
        inbound_calls: 0,
        total_talk_time: 0,
        total_idle_time: gapSeconds,
        avg_gap_seconds: gapSeconds,
        max_gap_seconds: gapSeconds,
        min_gap_seconds: gapSeconds,
        gap_count: 1,
        gaps_over_5min: gapSeconds > 300 ? 1 : 0,
        updated_at: new Date().toISOString(),
      }
      await redis.set(summaryKey, summary, { ex: 7776000 })
    }
  } catch (error) {
    console.error('❌ updateDailySummaryWithGap Redis error:', error)
  }
}

// ── Query Functions ──

/**
 * Get today's gap data for all active reps.
 */
export async function getGapsToday(): Promise<LiveRepGap[]> {
  const redis = getRedis()
  if (!redis) return []

  try {
    const date = todayDateString()
    const members = await redis.smembers(KEYS.activeReps(date))
    if (!members || members.length === 0) return []

    const now = Math.floor(Date.now() / 1000)
    const results: LiveRepGap[] = []
    const seenUserIds = new Set<number>()

    for (const member of members) {
      const userId = parseInt(member as string, 10)
      if (isNaN(userId)) continue
      if (seenUserIds.has(userId)) continue // Deduplicate (old format "id:name" + new format "id")
      seenUserIds.add(userId)

      const [summary, lastEnded, storedName] = await Promise.all([
        redis.get<RepDailySummary>(KEYS.dailySummary(userId, date)),
        redis.get<LastCallEnded>(KEYS.lastCallEnded(userId)),
        redis.get<string>(KEYS.repName(userId)),
      ])

      const repName = storedName || summary?.rep_name || lastEnded?.rep_name || 'Unknown'
      const currentIdleSeconds = lastEnded ? Math.max(0, now - lastEnded.ended_at) : 0

      results.push({
        aircall_user_id: userId,
        rep_name: repName,
        last_call_ended_at: lastEnded?.ended_at || 0,
        current_idle_seconds: currentIdleSeconds > MAX_GAP_THRESHOLD ? 0 : currentIdleSeconds,
        avg_gap_seconds: summary?.avg_gap_seconds || 0,
        max_gap_seconds: summary?.max_gap_seconds || 0,
        min_gap_seconds: summary?.min_gap_seconds || 0,
        gap_count: summary?.gap_count || 0,
        gaps_over_5min: summary?.gaps_over_5min || 0,
        total_idle_time: summary?.total_idle_time || 0,
        total_calls: summary?.total_calls || 0,
      })
    }

    // Sort by avg_gap ascending (fastest pace first)
    return results.sort((a, b) => {
      if (a.gap_count === 0 && b.gap_count === 0) return b.total_calls - a.total_calls
      if (a.gap_count === 0) return 1
      if (b.gap_count === 0) return -1
      return a.avg_gap_seconds - b.avg_gap_seconds
    })
  } catch (error) {
    console.error('❌ getGapsToday Redis error:', error)
    return []
  }
}

/**
 * Get live idle data — seconds since last call for each rep.
 */
export async function getLiveIdleData(): Promise<{ aircall_user_id: number; rep_name: string; idle_seconds: number; last_call_ended_at: number }[]> {
  const redis = getRedis()
  if (!redis) return []

  try {
    const date = todayDateString()
    const members = await redis.smembers(KEYS.activeReps(date))
    if (!members || members.length === 0) return []

    const now = Math.floor(Date.now() / 1000)
    const results: { aircall_user_id: number; rep_name: string; idle_seconds: number; last_call_ended_at: number }[] = []
    const seenUserIds = new Set<number>()

    for (const member of members) {
      const userId = parseInt(member as string, 10)
      if (isNaN(userId)) continue
      if (seenUserIds.has(userId)) continue
      seenUserIds.add(userId)

      const [lastEnded, storedName] = await Promise.all([
        redis.get<LastCallEnded>(KEYS.lastCallEnded(userId)),
        redis.get<string>(KEYS.repName(userId)),
      ])
      if (!lastEnded) continue

      const idleSeconds = Math.max(0, now - lastEnded.ended_at)
      if (idleSeconds > MAX_GAP_THRESHOLD) continue

      results.push({
        aircall_user_id: userId,
        rep_name: storedName || lastEnded.rep_name,
        idle_seconds: idleSeconds,
        last_call_ended_at: lastEnded.ended_at,
      })
    }

    return results.sort((a, b) => a.idle_seconds - b.idle_seconds)
  } catch (error) {
    console.error('❌ getLiveIdleData Redis error:', error)
    return []
  }
}

/**
 * Get individual gaps for a rep on a given date.
 */
export async function getRepGapDetail(
  aircallUserId: number,
  date: string
): Promise<{ gaps: CallGap[]; summary: RepDailySummary | null }> {
  const redis = getRedis()
  if (!redis) return { gaps: [], summary: null }

  try {
    const [rawGaps, summary] = await Promise.all([
      redis.lrange(KEYS.dailyGaps(aircallUserId, date), 0, -1),
      redis.get<RepDailySummary>(KEYS.dailySummary(aircallUserId, date)),
    ])

    const gaps: CallGap[] = rawGaps.map((raw) => {
      if (typeof raw === 'string') return JSON.parse(raw)
      return raw as CallGap
    })

    return { gaps, summary }
  } catch (error) {
    console.error('❌ getRepGapDetail Redis error:', error)
    return { gaps: [], summary: null }
  }
}

/**
 * Compute team-wide average gap from an already-fetched reps array.
 * Avoids double-fetching getGapsToday().
 */
export function computeTeamAvgGap(reps: LiveRepGap[]): { avg_gap_seconds: number; total_reps: number; total_gaps: number } {
  const repsWithGaps = reps.filter(r => r.gap_count > 0)

  if (repsWithGaps.length === 0) return { avg_gap_seconds: 0, total_reps: 0, total_gaps: 0 }

  const totalGapTime = repsWithGaps.reduce((sum, r) => sum + r.total_idle_time, 0)
  const totalGaps = repsWithGaps.reduce((sum, r) => sum + r.gap_count, 0)

  return {
    avg_gap_seconds: totalGaps > 0 ? Math.round(totalGapTime / totalGaps) : 0,
    total_reps: repsWithGaps.length,
    total_gaps: totalGaps,
  }
}

// ── Compute gaps from Aircall API data (fallback when no webhook data in Redis) ──

/**
 * Resolve end time for a call. Falls back to started_at + duration when ended_at is null.
 */
function resolveEndedAt(call: AircallCall): number {
  if (call.ended_at) return call.ended_at
  if (call.duration > 0) return call.started_at + call.duration
  return 0
}

/**
 * Compute gaps between consecutive calls for a sorted array of calls.
 * Returns individual CallGap objects and summary stats.
 */
function computeGapsBetweenCalls(repCalls: AircallCall[]): {
  gaps: CallGap[]
  gapCount: number
  totalIdleTime: number
  maxGap: number
  minGap: number
  gapsOver5min: number
  lastEndedAt: number
} {
  let gapCount = 0
  let totalIdleTime = 0
  let maxGap = 0
  let minGap = 0
  let gapsOver5min = 0
  let lastEndedAt = 0
  const gaps: CallGap[] = []

  for (let i = 0; i < repCalls.length; i++) {
    const call = repCalls[i]

    if (i > 0 && lastEndedAt > 0) {
      const gapSeconds = call.started_at - lastEndedAt
      if (gapSeconds > 0 && gapSeconds <= MAX_GAP_THRESHOLD) {
        gapCount++
        totalIdleTime += gapSeconds
        maxGap = Math.max(maxGap, gapSeconds)
        minGap = minGap === 0 ? gapSeconds : Math.min(minGap, gapSeconds)
        if (gapSeconds > 300) gapsOver5min++

        gaps.push({
          previous_call_id: repCalls[i - 1].id,
          previous_call_ended_at: lastEndedAt,
          previous_call_direction: repCalls[i - 1].direction,
          current_call_id: call.id,
          current_call_started_at: call.started_at,
          current_call_direction: call.direction,
          gap_seconds: gapSeconds,
        })
      }
    }

    // Update lastEndedAt — fall back to started_at + duration when ended_at is null
    const endedAt = resolveEndedAt(call)
    if (endedAt > lastEndedAt) {
      lastEndedAt = endedAt
    }
  }

  return { gaps, gapCount, totalIdleTime, maxGap, minGap, gapsOver5min, lastEndedAt }
}

/**
 * Derive gap data from Aircall API calls. Used when Redis has no webhook data.
 * Groups calls by rep, sorts chronologically, and computes gaps between consecutive calls.
 */
export function computeGapsFromCalls(calls: AircallCall[]): LiveRepGap[] {
  // Group calls by user
  const byUser = new Map<number, { name: string; calls: AircallCall[] }>()

  for (const call of calls) {
    if (!call.user) continue
    const uid = call.user.id
    if (!byUser.has(uid)) {
      byUser.set(uid, { name: call.user.name, calls: [] })
    }
    byUser.get(uid)!.calls.push(call)
  }

  const now = Math.floor(Date.now() / 1000)
  const results: LiveRepGap[] = []

  for (const [userId, { name, calls: repCalls }] of Array.from(byUser)) {
    repCalls.sort((a, b) => a.started_at - b.started_at)
    const { gapCount, totalIdleTime, maxGap, minGap, gapsOver5min, lastEndedAt } = computeGapsBetweenCalls(repCalls)

    const avgGap = gapCount > 0 ? Math.round(totalIdleTime / gapCount) : 0
    const currentIdle = lastEndedAt > 0 ? Math.max(0, now - lastEndedAt) : 0

    results.push({
      aircall_user_id: userId,
      rep_name: name,
      last_call_ended_at: lastEndedAt,
      current_idle_seconds: currentIdle > MAX_GAP_THRESHOLD ? 0 : currentIdle,
      avg_gap_seconds: avgGap,
      max_gap_seconds: maxGap,
      min_gap_seconds: minGap,
      gap_count: gapCount,
      gaps_over_5min: gapsOver5min,
      total_idle_time: totalIdleTime,
      total_calls: repCalls.length,
    })
  }

  // Sort by avg_gap ascending (fastest pace first), same as getGapsToday
  return results.sort((a, b) => {
    if (a.gap_count === 0 && b.gap_count === 0) return b.total_calls - a.total_calls
    if (a.gap_count === 0) return 1
    if (b.gap_count === 0) return -1
    return a.avg_gap_seconds - b.avg_gap_seconds
  })
}

/**
 * Compute gap detail for a single rep from Aircall API calls.
 * Returns the same shape as getRepGapDetail for the detail endpoint fallback.
 */
export function computeGapDetailFromCalls(
  calls: AircallCall[],
  aircallUserId: number
): { gaps: CallGap[]; summary: RepDailySummary | null } {
  const repCalls = calls
    .filter(c => c.user?.id === aircallUserId)
    .sort((a, b) => a.started_at - b.started_at)

  if (repCalls.length === 0) return { gaps: [], summary: null }

  const { gaps, gapCount, totalIdleTime, maxGap, minGap, gapsOver5min } = computeGapsBetweenCalls(repCalls)
  const repName = repCalls[0].user?.name || 'Unknown'
  const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' })

  const totalTalkTime = repCalls.reduce((sum, c) => sum + (c.duration || 0), 0)
  const outbound = repCalls.filter(c => c.direction === 'outbound').length

  const summary: RepDailySummary = {
    aircall_user_id: aircallUserId,
    rep_name: repName,
    date,
    total_calls: repCalls.length,
    outbound_calls: outbound,
    inbound_calls: repCalls.length - outbound,
    total_talk_time: totalTalkTime,
    total_idle_time: totalIdleTime,
    avg_gap_seconds: gapCount > 0 ? Math.round(totalIdleTime / gapCount) : 0,
    max_gap_seconds: maxGap,
    min_gap_seconds: minGap,
    gap_count: gapCount,
    gaps_over_5min: gapsOver5min,
    updated_at: new Date().toISOString(),
  }

  return { gaps, summary }
}

// ── Helpers ──

function toDateString(unixTimestamp: number): string {
  return new Date(unixTimestamp * 1000).toLocaleDateString('en-CA', { timeZone: 'Europe/London' })
}

function todayDateString(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' })
}

export function formatGapDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m < 60) return `${m}m ${s}s`
  const h = Math.floor(m / 60)
  const rm = m % 60
  return `${h}h ${rm}m`
}

export function formatGapShort(seconds: number): string {
  if (!seconds || seconds === 0) return '—'
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`
  const h = Math.floor(m / 60)
  const rm = m % 60
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`
}
