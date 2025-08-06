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

// Sales Dashboard Types
export interface Deal {
  id: string
  slack_ts: string  // Slack message timestamp for duplicate detection
  rep_name: string
  rep_email: string
  deal_name: string
  amount: number  // Amount in GBP (pounds)
  currency: string  // e.g., 'GBP', 'USD'
  created_at: string
  updated_at: string
  slack_channel_id?: string
  slack_message_url?: string
  source: 'slack' | 'manual' | 'api'  // Track data source
}

export interface SalesRep {
  email: string
  name: string
  total_deals: number
  total_amount: number  // Total sales in pounds
  monthly_deals: number
  monthly_amount: number
  rank?: number  // Position in leaderboard
  last_deal_at?: string
}

export interface MonthlySalesStats {
  month: string  // Format: 'YYYY-MM'
  total_deals: number
  total_amount: number  // Total sales in pounds
  target_amount: number  // Monthly target in pounds
  completion_percentage: number
  top_reps: SalesRep[]
  created_at: string
  updated_at: string
}

export interface SalesDashboardData {
  current_month: MonthlySalesStats
  previous_month?: MonthlySalesStats
  recent_deals: Deal[]
  leaderboard: SalesRep[]
  monthly_target: number
  progress_percentage: number
}