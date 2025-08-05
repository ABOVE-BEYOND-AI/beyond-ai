import { createClient } from './supabase'
import type { Database } from './supabase'

type User = Database['public']['Tables']['users']['Row']
type UserInsert = Database['public']['Tables']['users']['Insert']
type UserUpdate = Database['public']['Tables']['users']['Update']

type Itinerary = Database['public']['Tables']['itineraries']['Row']
type ItineraryInsert = Database['public']['Tables']['itineraries']['Insert']
type ItineraryUpdate = Database['public']['Tables']['itineraries']['Update']

const supabase = createClient()

// User operations
export async function createUser(userData: UserInsert): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .insert(userData)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getUserById(id: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // No rows found
    throw error
  }
  return data
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // No rows found
    throw error
  }
  return data
}

export async function updateUser(id: string, updates: UserUpdate): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

// Itinerary operations
export async function createItinerary(itineraryData: ItineraryInsert): Promise<Itinerary> {
  const { data, error } = await supabase
    .from('itineraries')
    .insert(itineraryData)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getItinerariesByUser(userId: string): Promise<Itinerary[]> {
  const { data, error } = await supabase
    .from('itineraries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function getItineraryById(id: string): Promise<Itinerary | null> {
  const { data, error } = await supabase
    .from('itineraries')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // No rows found
    throw error
  }
  return data
}

export async function updateItinerary(id: string, updates: ItineraryUpdate): Promise<Itinerary> {
  const { data, error } = await supabase
    .from('itineraries')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteItinerary(id: string): Promise<void> {
  const { error } = await supabase
    .from('itineraries')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// Helper functions
export async function getItineraryWithUser(id: string): Promise<(Itinerary & { user: User }) | null> {
  const { data, error } = await supabase
    .from('itineraries')
    .select(`
      *,
      user:users(*)
    `)
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data as (Itinerary & { user: User })
}

export async function getUserItineraryCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('itineraries')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (error) throw error
  return count || 0
}