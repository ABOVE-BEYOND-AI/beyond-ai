// Type definitions for our Google Auth + Redis system

export interface GoogleUser {
  id: string
  email: string
  name: string
  picture: string
  given_name?: string
  family_name?: string
}

export interface User {
  email: string
  name: string
  avatar_url: string
  created_at: string
  updated_at: string
}

export interface Itinerary {
  id: string
  user_email: string
  title: string
  destination: string
  departure_city: string
  guests: number
  start_date: string
  end_date: string
  budget_from?: number
  budget_to?: number
  number_of_options: number
  additional_options: string[]
  raw_content?: string
  processed_content?: string | object
  images?: Array<{
    imageUrl: string
    hotelName: string
  }>
  status: 'generating' | 'generated' | 'error'
  canva_design_url?: string
  
  // Legacy slides field (keep for backwards compatibility)
  slides_presentation_url?: string
  
  // NEW: Enhanced slides data for Phase 3.2+
  slides_presentation_id?: string    // Google Slides file ID
  slides_embed_url?: string          // iframe embed URL  
  slides_edit_url?: string           // Google Slides edit URL
  slides_created_at?: string         // timestamp when slides were created
  pdf_ready?: boolean                // PDF export availability
  current_slide_position?: number    // for navigation persistence
  
  created_at: string
  updated_at: string
}

export interface GoogleTokens {
  access_token: string
  refresh_token?: string
  expires_at?: number
  token_type: string
  scope: string
}

export interface AuthSession {
  user: GoogleUser
  tokens: GoogleTokens
  expires_at: number
}