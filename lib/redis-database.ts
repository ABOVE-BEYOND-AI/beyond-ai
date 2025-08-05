// Redis/Upstash database operations for user and itinerary data
import { Redis } from '@upstash/redis'
import { User, Itinerary, GoogleUser } from './types'

// Initialize Redis client from environment variables
// Support both Vercel KV and direct Upstash environment variable patterns
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || process.env.KV_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '',
})

// Redis key patterns
const KEYS = {
  user: (email: string) => `user:${email}`,
  userItineraries: (email: string) => `user:${email}:itineraries`,
  itinerary: (id: string) => `itinerary:${id}`,
  userSession: (email: string) => `session:${email}`,
}

// User operations
export async function createUser(googleUser: GoogleUser): Promise<User> {
  const user: User = {
    email: googleUser.email,
    name: googleUser.name,
    avatar_url: googleUser.picture,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  await redis.set(KEYS.user(user.email), user)
  return user
}

export async function getUser(email: string): Promise<User | null> {
  const user = await redis.get(KEYS.user(email))
  return user as User | null
}

export async function updateUser(email: string, updates: Partial<User>): Promise<User> {
  const existingUser = await getUser(email)
  if (!existingUser) {
    throw new Error('User not found')
  }

  const updatedUser: User = {
    ...existingUser,
    ...updates,
    updated_at: new Date().toISOString(),
  }

  await redis.set(KEYS.user(email), updatedUser)
  return updatedUser
}

// Itinerary operations
export async function saveItinerary(userEmail: string, itineraryData: Omit<Itinerary, 'id' | 'user_email' | 'created_at' | 'updated_at'>): Promise<string> {
  const id = `itinerary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const now = new Date().toISOString()
  
  const itinerary: Itinerary = {
    id,
    user_email: userEmail,
    ...itineraryData,
    created_at: now,
    updated_at: now,
  }

  // Save the itinerary
  await redis.set(KEYS.itinerary(id), itinerary)

  // Add to user's itinerary list
  const userItineraryIds = await getUserItineraryIds(userEmail)
  userItineraryIds.unshift(id) // Add to beginning (most recent first)
  await redis.set(KEYS.userItineraries(userEmail), userItineraryIds)

  return id
}

export async function getItinerary(id: string): Promise<Itinerary | null> {
  const itinerary = await redis.get(KEYS.itinerary(id))
  return itinerary as Itinerary | null
}

export async function getItineraries(userEmail: string): Promise<Itinerary[]> {
  const itineraryIds = await getUserItineraryIds(userEmail)
  
  if (itineraryIds.length === 0) {
    return []
  }

  // Get all itineraries in parallel
  const itineraries = await Promise.all(
    itineraryIds.map(id => getItinerary(id))
  )

  // Filter out any null results and return
  return itineraries.filter((itinerary): itinerary is Itinerary => itinerary !== null)
}

export async function updateItinerary(id: string, updates: Partial<Itinerary>): Promise<Itinerary> {
  const existingItinerary = await getItinerary(id)
  if (!existingItinerary) {
    throw new Error('Itinerary not found')
  }

  const updatedItinerary: Itinerary = {
    ...existingItinerary,
    ...updates,
    updated_at: new Date().toISOString(),
  }

  await redis.set(KEYS.itinerary(id), updatedItinerary)
  return updatedItinerary
}

export async function deleteItinerary(id: string, userEmail: string): Promise<void> {
  // Remove from user's itinerary list
  const userItineraryIds = await getUserItineraryIds(userEmail)
  const filteredIds = userItineraryIds.filter(itineraryId => itineraryId !== id)
  await redis.set(KEYS.userItineraries(userEmail), filteredIds)

  // Delete the itinerary
  await redis.del(KEYS.itinerary(id))
}

// Helper functions
async function getUserItineraryIds(userEmail: string): Promise<string[]> {
  const ids = await redis.get(KEYS.userItineraries(userEmail))
  return (ids as string[]) || []
}

export async function getUserItineraryCount(userEmail: string): Promise<number> {
  const itineraryIds = await getUserItineraryIds(userEmail)
  return itineraryIds.length
}

// Session management
export async function saveUserSession(email: string, sessionData: Record<string, unknown>): Promise<void> {
  // Sessions expire in 1 hour
  await redis.set(KEYS.userSession(email), sessionData, { ex: 3600 })
}

export async function getUserSession(email: string): Promise<Record<string, unknown> | null> {
  return await redis.get(KEYS.userSession(email))
}

export async function clearUserSession(email: string): Promise<void> {
  await redis.del(KEYS.userSession(email))
}