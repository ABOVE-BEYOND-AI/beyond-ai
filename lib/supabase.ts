import { createBrowserClient } from '@supabase/ssr'

// For client components - this is the main one we'll use
export const createClient = () => createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Types for our database
export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          google_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          google_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          google_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      itineraries: {
        Row: {
          id: string
          user_id: string
          title: string
          destination: string
          departure_city: string
          guests: number
          start_date: string
          end_date: string
          budget_from: number | null
          budget_to: number | null
          number_of_options: number
          additional_options: string[]
          raw_content: string | null
          processed_content: any | null
          images: any[] | null
          status: 'generating' | 'generated' | 'error'
          canva_design_url: string | null
          slides_presentation_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          destination: string
          departure_city: string
          guests: number
          start_date: string
          end_date: string
          budget_from?: number | null
          budget_to?: number | null
          number_of_options?: number
          additional_options?: string[]
          raw_content?: string | null
          processed_content?: any | null
          images?: any[] | null
          status?: 'generating' | 'generated' | 'error'
          canva_design_url?: string | null
          slides_presentation_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          destination?: string
          departure_city?: string
          guests?: number
          start_date?: string
          end_date?: string
          budget_from?: number | null
          budget_to?: number | null
          number_of_options?: number
          additional_options?: string[]
          raw_content?: string | null
          processed_content?: any | null
          images?: any[] | null
          status?: 'generating' | 'generated' | 'error'
          canva_design_url?: string | null
          slides_presentation_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}