// Aircall REST API integration using Basic Auth
// Docs: https://developer.aircall.io/api-references/

import { Redis } from '@upstash/redis'

export interface AircallUser {
  id: number
  name: string
  email: string
  available: boolean
  availability_status: string
  time_zone: string
}

export interface AircallContact {
  id: number
  first_name: string | null
  last_name: string | null
  company_name: string | null
  phone_numbers: { label: string; value: string }[]
  emails: { label: string; value: string }[]
}

export interface AircallCall {
  id: number
  sid: string
  direction: 'inbound' | 'outbound'
  status: 'initial' | 'answered' | 'done'
  missed_call_reason: string | null
  started_at: number // UNIX timestamp
  answered_at: number | null
  ended_at: number | null
  duration: number // seconds
  raw_digits: string
  recording: string | null
  voicemail: string | null
  asset: string | null
  archived: boolean
  cost: string | null
  user: AircallUser | null
  contact: AircallContact | null
  number: { id: number; name: string; digits: string } | null
  comments: { id: number; body: string; posted_at: number }[]
  tags: { id: number; name: string }[]
}

export interface AircallTranscription {
  call_id: number
  status: string
  content: {
    utterances: {
      text: string
      speaker: 'agent' | 'contact'
      timestamp: number // ms from start
    }[]
  }
}

interface AircallPaginatedResponse<T> {
  meta: {
    count: number
    total: number
    current_page: number
    per_page: number
    next_page_link: string | null
  }
  [key: string]: T[] | AircallPaginatedResponse<T>['meta']
}

// ── Auth ──

function getAuthHeader(): string {
  const apiId = process.env.AIRCALL_API_ID
  const apiToken = process.env.AIRCALL_API_TOKEN

  if (!apiId || !apiToken) {
    throw new Error('Missing AIRCALL_API_ID or AIRCALL_API_TOKEN environment variables')
  }

  return `Basic ${Buffer.from(`${apiId}:${apiToken}`).toString('base64')}`
}

const BASE_URL = 'https://api.aircall.io/v1'

// ── Rate-limit–aware fetch ──
// Aircall allows 60 requests/minute. We use response headers to throttle only when needed.

let rateLimitRemaining = 60
let rateLimitReset = 0

async function aircallFetch<T>(path: string, options?: RequestInit, _retryCount = 0): Promise<T> {
  const MAX_RETRIES = 3

  // Only throttle when we're actually close to the limit
  if (rateLimitRemaining <= 2 && Date.now() / 1000 < rateLimitReset) {
    const waitMs = Math.min((rateLimitReset - Date.now() / 1000) * 1000 + 500, 15000)
    console.log(`⏳ Aircall rate limit: waiting ${Math.round(waitMs)}ms`)
    await new Promise(resolve => setTimeout(resolve, waitMs))
  }

  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: getAuthHeader(),
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  // Update rate limit tracking from response headers
  const remaining = response.headers.get('x-aircallapi-remaining')
  const reset = response.headers.get('x-aircallapi-reset')
  if (remaining) rateLimitRemaining = parseInt(remaining, 10)
  if (reset) rateLimitReset = parseInt(reset, 10)

  if (response.status === 429) {
    if (_retryCount >= MAX_RETRIES) {
      throw new Error(`Aircall API rate limited after ${MAX_RETRIES} retries`)
    }
    const retryAfter = Math.min(
      rateLimitReset > 0 ? (rateLimitReset - Date.now() / 1000) * 1000 + 1000 : 5000,
      15000 // Cap at 15 seconds
    )
    console.warn(`⚠️ Aircall rate limited (${_retryCount + 1}/${MAX_RETRIES}). Retrying in ${Math.round(retryAfter)}ms`)
    await new Promise(resolve => setTimeout(resolve, retryAfter))
    return aircallFetch(path, options, _retryCount + 1)
  }

  if (!response.ok) {
    const errorBody = await response.text()
    console.error(`Aircall API error [${response.status}]:`, errorBody)
    throw new Error(`Aircall API error: ${response.status} - ${errorBody}`)
  }

  return response.json()
}

// ── Public API functions ──

/**
 * List calls with optional filters.
 * Uses `from` and `to` UNIX timestamps to window requests.
 */
export async function listCalls(params: {
  from?: number
  to?: number
  order?: 'asc' | 'desc'
  per_page?: number
  page?: number
}): Promise<{ calls: AircallCall[]; meta: AircallPaginatedResponse<AircallCall>['meta'] }> {
  const searchParams = new URLSearchParams()
  if (params.from) searchParams.set('from', params.from.toString())
  if (params.to) searchParams.set('to', params.to.toString())
  if (params.order) searchParams.set('order', params.order)
  searchParams.set('per_page', (params.per_page || 50).toString())
  if (params.page) searchParams.set('page', params.page.toString())

  const data = await aircallFetch<{ calls: AircallCall[]; meta: AircallPaginatedResponse<AircallCall>['meta'] }>(
    `/calls?${searchParams.toString()}`
  )
  return data
}

/**
 * Get a single call by ID
 */
export async function getCall(callId: number): Promise<AircallCall> {
  const data = await aircallFetch<{ call: AircallCall }>(`/calls/${callId}`)
  return data.call
}

/**
 * Get the transcription for a call (requires transcription to be available)
 */
export async function getTranscription(callId: number): Promise<AircallTranscription | null> {
  try {
    const data = await aircallFetch<AircallTranscription>(`/calls/${callId}/transcription`)
    return data
  } catch (err) {
    // Transcription may not exist for all calls
    console.warn(`No transcription available for call ${callId}:`, err)
    return null
  }
}

/**
 * List all Aircall users (paginated, fetches all)
 */
export async function listUsers(): Promise<AircallUser[]> {
  const data = await aircallFetch<{ users: AircallUser[] }>('/v2/users?per_page=50')
  return data.users
}

/**
 * List all teams
 */
export async function listTeams(): Promise<{ id: number; name: string; users: AircallUser[] }[]> {
  const data = await aircallFetch<{ teams: { id: number; name: string; users: AircallUser[] }[] }>('/teams')
  return data.teams
}

// ── Bulk helpers ──

/**
 * Fetch all calls for a given date range (handles pagination).
 * Max 10,000 calls per range — use narrower windows for busy teams.
 */
export async function fetchAllCallsInRange(from: Date, to: Date): Promise<AircallCall[]> {
  const allCalls: AircallCall[] = []
  let page = 1
  const maxPages = 200 // Safety limit (200 * 50 = 10,000)

  while (page <= maxPages) {
    const data = await listCalls({
      from: Math.floor(from.getTime() / 1000),
      to: Math.floor(to.getTime() / 1000),
      order: 'desc',
      per_page: 50,
      page,
    })

    allCalls.push(...data.calls)

    if (!data.meta.next_page_link) break
    page++
  }

  return allCalls
}

/**
 * Get calls for today (since midnight)
 */
export async function getTodayCalls(): Promise<AircallCall[]> {
  const now = new Date()
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return fetchAllCallsInRange(midnight, now)
}

/**
 * Get calls for a specific period
 */
export async function getCallsForPeriod(period: 'today' | 'week' | 'month'): Promise<AircallCall[]> {
  const now = new Date()
  let from: Date

  switch (period) {
    case 'today': {
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      break
    }
    case 'week': {
      const day = now.getDay()
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((day + 6) % 7))
      break
    }
    case 'month': {
      from = new Date(now.getFullYear(), now.getMonth(), 1)
      break
    }
  }

  return fetchAllCallsInRange(from, now)
}

// ── Analytics helpers ──

export interface CallStats {
  total_calls: number
  inbound_calls: number
  outbound_calls: number
  answered_calls: number
  missed_calls: number
  total_duration: number // seconds
  avg_duration: number // seconds
  total_talk_time: number // seconds (only answered calls)
  avg_talk_time: number // seconds
}

export function computeCallStats(calls: AircallCall[]): CallStats {
  const inbound = calls.filter(c => c.direction === 'inbound')
  const outbound = calls.filter(c => c.direction === 'outbound')
  const answered = calls.filter(c => c.status === 'answered' || c.answered_at)
  const missed = calls.filter(c => c.missed_call_reason !== null)

  const total_duration = calls.reduce((sum, c) => sum + (c.duration || 0), 0)
  const total_talk_time = answered.reduce((sum, c) => {
    if (c.answered_at && c.ended_at) {
      return sum + (c.ended_at - c.answered_at)
    }
    return sum + (c.duration || 0)
  }, 0)

  return {
    total_calls: calls.length,
    inbound_calls: inbound.length,
    outbound_calls: outbound.length,
    answered_calls: answered.length,
    missed_calls: missed.length,
    total_duration,
    avg_duration: calls.length > 0 ? total_duration / calls.length : 0,
    total_talk_time,
    avg_talk_time: answered.length > 0 ? total_talk_time / answered.length : 0,
  }
}

export interface RepCallStats {
  name: string
  email: string
  user_id: number
  total_calls: number
  inbound_calls: number
  outbound_calls: number
  total_duration: number
  avg_duration: number
  longest_call: number
  answered_calls: number
}

export function computeRepStats(calls: AircallCall[]): RepCallStats[] {
  const repMap = new Map<number, RepCallStats>()

  for (const call of calls) {
    if (!call.user) continue
    const userId = call.user.id

    if (!repMap.has(userId)) {
      repMap.set(userId, {
        name: call.user.name,
        email: call.user.email,
        user_id: userId,
        total_calls: 0,
        inbound_calls: 0,
        outbound_calls: 0,
        total_duration: 0,
        avg_duration: 0,
        longest_call: 0,
        answered_calls: 0,
      })
    }

    const rep = repMap.get(userId)!
    rep.total_calls++
    if (call.direction === 'inbound') rep.inbound_calls++
    else rep.outbound_calls++
    if (call.status === 'answered' || call.answered_at) rep.answered_calls++
    rep.total_duration += call.duration || 0
    rep.longest_call = Math.max(rep.longest_call, call.duration || 0)
  }

  // Compute averages
  for (const rep of repMap.values()) {
    rep.avg_duration = rep.total_calls > 0 ? rep.total_duration / rep.total_calls : 0
  }

  return Array.from(repMap.values()).sort((a, b) => b.total_calls - a.total_calls)
}

/**
 * Create an outbound call via Aircall
 * The call is initiated from the Aircall app on the user's device
 */
export async function createOutboundCall(userId: number, phoneNumber: string): Promise<AircallCall> {
  const data = await aircallFetch<{ call: AircallCall }>('/calls', {
    method: 'POST',
    body: JSON.stringify({
      number_id: userId,
      to: phoneNumber,
    }),
  })
  return data.call
}

/**
 * Add a tag to a call
 */
export async function addTagToCall(callId: number, tagName: string): Promise<void> {
  await aircallFetch(`/calls/${callId}/tags`, {
    method: 'POST',
    body: JSON.stringify({ tags: [tagName] }),
  })
}

/**
 * Add a comment/note to a call
 */
export async function addCommentToCall(callId: number, body: string): Promise<void> {
  await aircallFetch(`/calls/${callId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  })
}

/**
 * Format transcript utterances into readable text for AI analysis
 */
export function formatTranscriptForAI(transcript: AircallTranscription, call: AircallCall): string {
  if (!transcript.content?.utterances?.length) return ''

  const agentName = call.user?.name || 'Agent'
  const contactName = call.contact
    ? [call.contact.first_name, call.contact.last_name].filter(Boolean).join(' ') || 'Contact'
    : 'Contact'

  return transcript.content.utterances
    .map(u => {
      const speaker = u.speaker === 'agent' ? agentName : contactName
      const mins = Math.floor(u.timestamp / 60000)
      const secs = Math.floor((u.timestamp % 60000) / 1000)
      const time = `${mins}:${secs.toString().padStart(2, '0')}`
      return `[${time}] ${speaker}: ${u.text}`
    })
    .join('\n')
}

// ── Cached call fetching (shared across all endpoints) ──
// Prevents duplicate Aircall API calls from gap polling, dashboard polling, etc.
// Uses the same lock/stale pattern as call-dashboard.ts.

type CachePeriod = 'today' | 'week' | 'month'

const RAW_CACHE_TTL: Record<CachePeriod, number> = { today: 90, week: 300, month: 900 }
const RAW_STALE_TTL: Record<CachePeriod, number> = { today: 600, week: 3600, month: 7200 }

function rawCacheKey(period: CachePeriod): string {
  const date = new Date().toISOString().slice(0, 10)
  return `aircall_raw:${period}:${date}`
}
function rawStaleKey(period: CachePeriod): string {
  const date = new Date().toISOString().slice(0, 10)
  return `aircall_raw_stale:${period}:${date}`
}
function rawLockKey(period: CachePeriod): string {
  return `aircall_raw_lock:${period}`
}

let _redis: Redis | null = null
function getCacheRedis(): Redis | null {
  if (_redis) return _redis
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
  if (!url || !token) return null
  _redis = new Redis({ url, token })
  return _redis
}

/**
 * Cached version of getCallsForPeriod — all endpoints should use this.
 * Returns raw AircallCall[] from Redis cache (90s TTL for today).
 * On cache miss, fetches from Aircall API with lock to prevent thundering herd.
 * Falls through to uncached getCallsForPeriod() if Redis is unavailable.
 */
export async function getCachedCallsForPeriod(period: CachePeriod): Promise<AircallCall[]> {
  const redis = getCacheRedis()

  // No Redis — fall through to direct API call
  if (!redis) return getCallsForPeriod(period)

  // Try hot cache
  try {
    const cached = await redis.get<AircallCall[]>(rawCacheKey(period))
    if (cached) return cached
  } catch (err) {
    console.warn('Redis raw call cache read failed:', err)
  }

  // Try to acquire lock
  try {
    const lockAcquired = await redis.set(rawLockKey(period), '1', { nx: true, ex: 120 })

    if (!lockAcquired) {
      // Another instance is fetching — return stale data or wait
      const stale = await redis.get<AircallCall[]>(rawStaleKey(period))
      if (stale) return stale

      // No stale data — wait briefly for the other instance to finish
      await new Promise(resolve => setTimeout(resolve, 3000))
      const retried = await redis.get<AircallCall[]>(rawCacheKey(period))
      if (retried) return retried

      // Still nothing — fetch directly (rare edge case)
      return getCallsForPeriod(period)
    }
  } catch (err) {
    console.warn('Redis raw call lock failed:', err)
    return getCallsForPeriod(period)
  }

  // Lock acquired — fetch from Aircall API
  try {
    const calls = await getCallsForPeriod(period)

    const pipeline = redis.pipeline()
    pipeline.set(rawCacheKey(period), calls, { ex: RAW_CACHE_TTL[period] })
    pipeline.set(rawStaleKey(period), calls, { ex: RAW_STALE_TTL[period] })
    pipeline.del(rawLockKey(period))
    pipeline.exec().catch(err => console.warn('Redis raw call cache write failed:', err))

    return calls
  } catch (err) {
    // Fetch failed — clean up lock, try stale
    try {
      await redis.del(rawLockKey(period))
      const stale = await redis.get<AircallCall[]>(rawStaleKey(period))
      if (stale) return stale
    } catch (staleErr) {
      console.warn('Redis stale raw call read failed:', staleErr)
    }
    throw err
  }
}

/**
 * Fetch calls for a specific date (e.g. yesterday). Cached for 15 minutes.
 * Used for historical comparisons — does not need frequent refresh.
 */
export async function getCachedCallsForDate(date: Date): Promise<AircallCall[]> {
  const dateStr = date.toISOString().slice(0, 10)
  const cacheKey = `aircall_raw:date:${dateStr}`
  const staleKey = `aircall_raw_stale:date:${dateStr}`

  const redis = getCacheRedis()
  if (redis) {
    try {
      const cached = await redis.get<AircallCall[]>(cacheKey)
      if (cached) return cached
    } catch {}
  }

  // Fetch from Aircall API — full day range
  const from = new Date(date)
  from.setHours(0, 0, 0, 0)
  const to = new Date(date)
  to.setHours(23, 59, 59, 999)

  const calls = await fetchAllCallsInRange(from, to)

  if (redis) {
    try {
      const pipeline = redis.pipeline()
      pipeline.set(cacheKey, calls, { ex: 900 }) // 15 min cache
      pipeline.set(staleKey, calls, { ex: 7200 }) // 2 hour stale
      pipeline.exec().catch(() => {})
    } catch {}
  }

  return calls
}
