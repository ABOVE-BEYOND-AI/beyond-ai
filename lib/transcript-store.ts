// Transcript storage and search using Redis (Upstash)
// Stores Whisper transcripts from Aircall call analysis for keyword searching

import { Redis } from '@upstash/redis'

// ── Types ──

export interface StoredTranscript {
  callId: number
  agentName: string
  contactName: string
  duration: number
  direction: 'inbound' | 'outbound'
  startedAt: number // UNIX timestamp
  transcript: string // Full transcript text
  wordCount: number
  createdAt: string // ISO date
}

export interface TranscriptSearchResult {
  callId: number
  agentName: string
  contactName: string
  duration: number
  direction: 'inbound' | 'outbound'
  startedAt: number
  excerpt: string // Highlighted excerpt around the match
  matchCount: number
}

export interface TranscriptSearchOptions {
  fromDate?: string // ISO date
  toDate?: string // ISO date
  agentName?: string
  direction?: 'inbound' | 'outbound'
  limit?: number
}

// ── Redis client ──

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

const TRANSCRIPT_KEY = (callId: number) => `transcript:${callId}`
const TRANSCRIPT_INDEX = 'transcript_index'
const TRANSCRIPT_TTL = 60 * 60 * 24 * 90 // 90 days

// ── Store ──

/**
 * Store a transcript in Redis after Whisper transcription
 */
export async function storeTranscript(
  callId: number,
  metadata: {
    agentName: string
    contactName: string
    duration: number
    direction: 'inbound' | 'outbound'
    startedAt: number
  },
  transcriptText: string
): Promise<void> {
  const redis = getRedis()
  if (!redis) {
    console.warn('Redis not available, skipping transcript storage')
    return
  }

  const stored: StoredTranscript = {
    callId,
    agentName: metadata.agentName,
    contactName: metadata.contactName,
    duration: metadata.duration,
    direction: metadata.direction,
    startedAt: metadata.startedAt,
    transcript: transcriptText,
    wordCount: transcriptText.split(/\s+/).filter(w => w.length > 1).length,
    createdAt: new Date().toISOString(),
  }

  try {
    // Store the transcript
    await redis.set(TRANSCRIPT_KEY(callId), stored, { ex: TRANSCRIPT_TTL })

    // Add to index sorted set (score = startedAt for chronological ordering)
    await redis.zadd(TRANSCRIPT_INDEX, {
      score: metadata.startedAt,
      member: String(callId),
    })

    console.log(`📝 Stored transcript for call ${callId} (${stored.wordCount} words)`)
  } catch (err) {
    console.error('Failed to store transcript:', err)
  }
}

// ── Retrieve ──

/**
 * Get a single transcript by call ID
 */
export async function getTranscript(callId: number): Promise<StoredTranscript | null> {
  const redis = getRedis()
  if (!redis) return null

  try {
    return await redis.get<StoredTranscript>(TRANSCRIPT_KEY(callId))
  } catch {
    return null
  }
}

/**
 * Get total count of stored transcripts
 */
export async function getStoredTranscriptCount(): Promise<number> {
  const redis = getRedis()
  if (!redis) return 0

  try {
    return await redis.zcard(TRANSCRIPT_INDEX)
  } catch {
    return 0
  }
}

// ── Search ──

/**
 * Search transcripts by keyword. Fetches all transcript keys from the index,
 * loads each, and performs text matching. Returns highlighted excerpts.
 */
export async function searchTranscripts(
  keyword: string,
  options?: TranscriptSearchOptions
): Promise<TranscriptSearchResult[]> {
  const redis = getRedis()
  if (!redis) return []

  const limit = options?.limit || 50

  try {
    // Get call IDs from the sorted set index, most recent first
    let callIds: string[]

    if (options?.fromDate || options?.toDate) {
      // Filter by date range using sorted set score (startedAt timestamp)
      const minScore = options.fromDate
        ? Math.floor(new Date(options.fromDate).getTime() / 1000)
        : 0
      const maxScore = options.toDate
        ? Math.floor(new Date(options.toDate).getTime() / 1000) + 86400
        : Date.now()

      callIds = await redis.zrange(TRANSCRIPT_INDEX, minScore, maxScore, { byScore: true })
      callIds.reverse() // Most recent first
    } else {
      // Get all, most recent first (last 500 max)
      callIds = await redis.zrange(TRANSCRIPT_INDEX, 0, 499, { rev: true })
    }

    if (callIds.length === 0) return []

    // Fetch transcripts and search
    const results: TranscriptSearchResult[] = []
    const keywordLower = keyword.toLowerCase()

    // Process in batches of 20 to avoid overwhelming Redis
    for (let i = 0; i < callIds.length && results.length < limit; i += 20) {
      const batch = callIds.slice(i, i + 20)
      const transcripts = await Promise.all(
        batch.map(id => redis.get<StoredTranscript>(TRANSCRIPT_KEY(Number(id))))
      )

      for (const t of transcripts) {
        if (!t) continue

        // Apply filters
        if (options?.agentName && t.agentName !== options.agentName) continue
        if (options?.direction && t.direction !== options.direction) continue

        // Search for keyword
        const textLower = t.transcript.toLowerCase()
        const matchIndex = textLower.indexOf(keywordLower)

        if (matchIndex === -1) continue

        // Count all matches
        let matchCount = 0
        let searchPos = 0
        while (searchPos < textLower.length) {
          const idx = textLower.indexOf(keywordLower, searchPos)
          if (idx === -1) break
          matchCount++
          searchPos = idx + 1
        }

        // Build excerpt with context (80 chars before and after first match)
        const excerptStart = Math.max(0, matchIndex - 80)
        const excerptEnd = Math.min(t.transcript.length, matchIndex + keyword.length + 80)
        let excerpt = t.transcript.slice(excerptStart, excerptEnd)
        if (excerptStart > 0) excerpt = '...' + excerpt
        if (excerptEnd < t.transcript.length) excerpt = excerpt + '...'

        results.push({
          callId: t.callId,
          agentName: t.agentName,
          contactName: t.contactName,
          duration: t.duration,
          direction: t.direction,
          startedAt: t.startedAt,
          excerpt,
          matchCount,
        })

        if (results.length >= limit) break
      }
    }

    // Sort by match count descending (most relevant first)
    results.sort((a, b) => b.matchCount - a.matchCount)

    return results
  } catch (err) {
    console.error('Transcript search failed:', err)
    return []
  }
}

/**
 * Get recent transcripts (no keyword filter)
 */
export async function getRecentTranscripts(
  limit: number = 20
): Promise<StoredTranscript[]> {
  const redis = getRedis()
  if (!redis) return []

  try {
    const callIds = await redis.zrange(TRANSCRIPT_INDEX, 0, limit - 1, { rev: true })
    if (callIds.length === 0) return []

    const transcripts = await Promise.all(
      callIds.map(id => redis.get<StoredTranscript>(TRANSCRIPT_KEY(Number(id))))
    )

    return transcripts.filter((t): t is StoredTranscript => t !== null)
  } catch {
    return []
  }
}
