// Redis/Upstash database operations for user and itinerary data
import { Redis } from '@upstash/redis'
import { User, Itinerary, GoogleUser, StoredTokens, UserRole } from './types'

// Lazy Redis client initialization to prevent client-side execution
let redis: Redis | null = null;

function getRedisClient(): Redis {
  // Ensure we're running server-side only
  if (typeof window !== 'undefined') {
    throw new Error('Redis operations can only be performed server-side');
  }

  // Initialize Redis client if not already done
  if (!redis) {
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || process.env.KV_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

    // Debug logging for server-side execution
    console.log('🔧 Redis Debug: URL exists:', !!redisUrl);
    console.log('🔧 Redis Debug: Token exists:', !!redisToken);
    console.log('🔧 Redis Debug: Available env vars:', {
      UPSTASH_REDIS_REST_URL: !!process.env.UPSTASH_REDIS_REST_URL,
      KV_REST_API_URL: !!process.env.KV_REST_API_URL,
      KV_URL: !!process.env.KV_URL,
      UPSTASH_REDIS_REST_TOKEN: !!process.env.UPSTASH_REDIS_REST_TOKEN,
      KV_REST_API_TOKEN: !!process.env.KV_REST_API_TOKEN,
    });

    if (!redisUrl || !redisToken) {
      console.error('❌ Redis configuration missing:', {
        url: !!redisUrl,
        token: !!redisToken
      });
      throw new Error('Redis configuration is incomplete. Check environment variables.');
    }

    redis = new Redis({
      url: redisUrl,
      token: redisToken,
    });
  }

  return redis;
}

// Admin emails — these users always get admin role
const ADMIN_EMAILS = [
  'max.venville@aboveandbeyond.group',
]

// Redis key patterns
const KEYS = {
  user: (email: string) => `user:${email}`,
  userItineraries: (email: string) => `user:${email}:itineraries`,
  itinerary: (id: string) => `itinerary:${id}`,
  userSession: (email: string) => `session:${email}`,
  userTokens: (email: string) => `tokens:${email}`,
  allUsers: 'all_users', // Set of all user emails for admin listing
}

// User operations
export async function createUser(googleUser: GoogleUser): Promise<User> {
  const redis = getRedisClient();
  const isAdmin = ADMIN_EMAILS.includes(googleUser.email.toLowerCase())

  const user: User = {
    email: googleUser.email,
    name: googleUser.name,
    avatar_url: googleUser.picture,
    role: isAdmin ? 'admin' : 'member',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  await redis.set(KEYS.user(user.email), user)
  // Track user in the global user list for admin panel
  await redis.sadd(KEYS.allUsers, user.email)
  return user
}

export async function getUser(email: string): Promise<User | null> {
  const redis = getRedisClient();
  const user = await redis.get(KEYS.user(email)) as User | null
  if (!user) return null

  // Migration: if user exists but has no role, assign one
  if (!user.role) {
    const isAdmin = ADMIN_EMAILS.includes(email.toLowerCase())
    user.role = isAdmin ? 'admin' : 'member'
    await redis.set(KEYS.user(email), user)
    // Also ensure they're in the global user list
    await redis.sadd(KEYS.allUsers, email)
  }

  return user
}

export async function updateUser(email: string, updates: Partial<User>): Promise<User> {
  const redis = getRedisClient();
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
  const redis = getRedisClient();
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

  // Add to user's itinerary list (prevent duplicates)
  const userItineraryIds = await getUserItineraryIds(userEmail)
  
  // Check if ID already exists to prevent duplicates
  if (!userItineraryIds.includes(id)) {
    userItineraryIds.unshift(id) // Add to beginning (most recent first)
    await redis.set(KEYS.userItineraries(userEmail), userItineraryIds)
    console.log(`✅ Added itinerary ${id} to user ${userEmail}'s list (total: ${userItineraryIds.length})`);
  } else {
    console.log(`⚠️ Itinerary ${id} already exists in user ${userEmail}'s list - skipping duplicate`);
  }

  return id
}

export async function getItinerary(id: string): Promise<Itinerary | null> {
  const redis = getRedisClient();
  const itinerary = await redis.get(KEYS.itinerary(id))
  return itinerary as Itinerary | null
}

export async function getItineraries(userEmail: string, limit: number = 50, offset: number = 0): Promise<Itinerary[]> {
  const itineraryIds = await getUserItineraryIds(userEmail)
  
  console.log(`🔍 getItineraries: User ${userEmail} has ${itineraryIds.length} total itinerary IDs`);
  
  if (itineraryIds.length === 0) {
    return []
  }

  // Apply pagination to avoid loading thousands of entries
  const paginatedIds = itineraryIds.slice(offset, offset + limit);
  console.log(`📄 getItineraries: Loading ${paginatedIds.length} itineraries (offset: ${offset}, limit: ${limit})`);

  // Get paginated itineraries in parallel
  const itineraries = await Promise.all(
    paginatedIds.map(id => getItinerary(id))
  )

  // Filter out any null results and return
  return itineraries.filter((itinerary): itinerary is Itinerary => itinerary !== null)
}

export async function updateItinerary(id: string, updates: Partial<Itinerary>): Promise<Itinerary> {
  const redis = getRedisClient();
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
  const redis = getRedisClient();
  // Remove from user's itinerary list
  const userItineraryIds = await getUserItineraryIds(userEmail)
  const filteredIds = userItineraryIds.filter(itineraryId => itineraryId !== id)
  await redis.set(KEYS.userItineraries(userEmail), filteredIds)

  // Delete the itinerary
  await redis.del(KEYS.itinerary(id))
}

// Helper functions
async function getUserItineraryIds(userEmail: string): Promise<string[]> {
  const redis = getRedisClient();
  const ids = await redis.get(KEYS.userItineraries(userEmail))
  return (ids as string[]) || []
}

export async function getUserItineraryCount(userEmail: string): Promise<number> {
  const itineraryIds = await getUserItineraryIds(userEmail)
  return itineraryIds.length
}

// Session management
export async function saveUserSession(email: string, sessionData: Record<string, unknown>): Promise<void> {
  const redis = getRedisClient();
  // Sessions expire in 7 days (matches cookie maxAge)
  await redis.set(KEYS.userSession(email), sessionData, { ex: 60 * 60 * 24 * 7 })
}

export async function getUserSession(email: string): Promise<Record<string, unknown> | null> {
  const redis = getRedisClient();
  return await redis.get(KEYS.userSession(email))
}

export async function clearUserSession(email: string): Promise<void> {
  const redis = getRedisClient();
  await redis.del(KEYS.userSession(email))
}

// ── Persistent token storage ──
// These persist independently of sessions so refresh tokens survive session expiry

export async function saveUserTokens(email: string, tokens: StoredTokens): Promise<void> {
  const redis = getRedisClient();
  const existing = await getUserTokens(email)
  const merged = { ...existing, ...tokens }
  // Tokens don't expire in Redis — they're long-lived and managed by refresh logic
  await redis.set(KEYS.userTokens(email), merged)
}

export async function getUserTokens(email: string): Promise<StoredTokens | null> {
  const redis = getRedisClient();
  return await redis.get(KEYS.userTokens(email))
}

export async function clearUserTokens(email: string): Promise<void> {
  const redis = getRedisClient();
  await redis.del(KEYS.userTokens(email))
}

// ── Admin: User management ──

export async function getAllUsers(): Promise<User[]> {
  const redis = getRedisClient();
  const emails = await redis.smembers(KEYS.allUsers)
  if (!emails || emails.length === 0) return []

  const users = await Promise.all(
    emails.map(email => getUser(email))
  )
  return users.filter((u): u is User => u !== null)
}

export async function setUserRole(email: string, role: UserRole): Promise<User> {
  return updateUser(email, { role })
}

export async function deleteUserAccount(email: string): Promise<void> {
  const redis = getRedisClient();
  await redis.del(KEYS.user(email))
  await redis.del(KEYS.userSession(email))
  await redis.del(KEYS.userTokens(email))
  await redis.srem(KEYS.allUsers, email)
}

export async function getUserIntegrations(email: string): Promise<{ google: boolean, canva: boolean }> {
  const redis = getRedisClient();
  const tokens = await getUserTokens(email)
  const canvaTokens = await redis.get(`canva_token:${email}`)

  return {
    google: !!(tokens?.google_refresh_token),
    canva: !!canvaTokens,
  }
}