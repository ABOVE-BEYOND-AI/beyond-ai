// Lusha API client — per-user personal API key integration
// Each user stores their own Lusha API key in Redis

import { Redis } from '@upstash/redis'

// ──────────────────────────────────────────────
// Redis client (same lazy pattern as redis-database.ts)
// ──────────────────────────────────────────────

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

// ──────────────────────────────────────────────
// Redis key storage for per-user Lusha API keys
// ──────────────────────────────────────────────

const LUSHA_KEY_PREFIX = 'lusha_key'

function lushaKeyFor(email: string): string {
  return `${LUSHA_KEY_PREFIX}:${email}`
}

/** Store a user's Lusha API key in Redis */
export async function storeLushaKey(email: string, apiKey: string): Promise<void> {
  const client = getRedisClient()
  await client.set(lushaKeyFor(email), apiKey)
}

/** Retrieve a user's stored Lusha API key */
export async function getLushaKey(email: string): Promise<string | null> {
  const client = getRedisClient()
  return await client.get<string>(lushaKeyFor(email))
}

/** Remove a user's stored Lusha API key */
export async function deleteLushaKey(email: string): Promise<void> {
  const client = getRedisClient()
  await client.del(lushaKeyFor(email))
}

// ──────────────────────────────────────────────
// Lusha API types
// ──────────────────────────────────────────────

export interface LushaEnrichParams {
  firstName: string
  lastName: string
  company?: string
}

export interface LushaEmail {
  email: string
  type: string
}

export interface LushaPhone {
  internationalNumber: string
  countryCallingCode: string
  type: string
}

export interface LushaEnrichResult {
  firstName?: string
  lastName?: string
  fullName?: string
  emails?: LushaEmail[]
  phoneNumbers?: LushaPhone[]
  title?: string
  company?: string
  linkedinUrl?: string
}

export interface LushaCreditsResult {
  credits: number
}

// ──────────────────────────────────────────────
// Lusha API calls
// ──────────────────────────────────────────────

const LUSHA_PERSON_URL = 'https://api.lusha.com/person'
const LUSHA_CREDITS_URL = 'https://api.lusha.com/prospecting/credits'

/**
 * Enrich a person using the Lusha Person API.
 * Requires the caller's personal Lusha API key.
 */
export async function enrichPerson(
  apiKey: string,
  params: LushaEnrichParams
): Promise<LushaEnrichResult> {
  const url = new URL(LUSHA_PERSON_URL)
  url.searchParams.set('firstName', params.firstName)
  url.searchParams.set('lastName', params.lastName)
  if (params.company) {
    url.searchParams.set('company', params.company)
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'api_key': apiKey,
      'Accept': 'application/json',
    },
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Lusha person enrichment failed: ${response.status} - ${errorBody}`)
  }

  const data = await response.json()

  return {
    firstName: data.data?.firstName ?? data.firstName,
    lastName: data.data?.lastName ?? data.lastName,
    fullName: data.data?.fullName ?? data.fullName,
    emails: data.data?.emails ?? data.emails ?? [],
    phoneNumbers: data.data?.phoneNumbers ?? data.phoneNumbers ?? [],
    title: data.data?.title ?? data.title,
    company: data.data?.company?.name ?? data.data?.company ?? data.company,
    linkedinUrl: data.data?.linkedinUrl ?? data.linkedinUrl,
  }
}

/**
 * Check remaining Lusha credits for a given API key.
 */
export async function checkCredits(apiKey: string): Promise<LushaCreditsResult> {
  const response = await fetch(LUSHA_CREDITS_URL, {
    method: 'GET',
    headers: {
      'api_key': apiKey,
      'Accept': 'application/json',
    },
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Lusha credits check failed: ${response.status} - ${errorBody}`)
  }

  const data = await response.json()

  return {
    credits: data.data?.credits ?? data.credits ?? 0,
  }
}
