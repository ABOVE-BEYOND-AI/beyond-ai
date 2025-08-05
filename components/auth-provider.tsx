'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase'
import { createUser, getUserById } from '@/lib/database'

interface AuthContextType {
  user: User | null
  dbUser: any | null
  loading: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [dbUser, setDbUser] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setUser(session?.user ?? null)
        
        if (session?.user) {
          // Don't block loading on database sync - do it in background
          syncUserWithDatabase(session.user).catch(console.error)
        }
        
        console.log('Auth provider: Initial session loaded, setting loading to false')
        setLoading(false)
      } catch (error) {
        console.error('Error getting initial session:', error)
        console.log('Auth provider: Error during initial session, setting loading to false')
        setLoading(false)
      }
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        
        if (session?.user) {
          // Don't block on database sync
          syncUserWithDatabase(session.user).catch(console.error)
        } else {
          setDbUser(null)
        }
        
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const syncUserWithDatabase = async (authUser: User) => {
    try {
      console.log('Syncing user with database:', authUser.id)
      // Try to get existing user from database
      let user = await getUserById(authUser.id)
      
      // If user doesn't exist, create them
      if (!user) {
        console.log('Creating new user in database')
        user = await createUser({
          id: authUser.id,
          email: authUser.email!,
          full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name,
          avatar_url: authUser.user_metadata?.avatar_url,
          google_id: authUser.user_metadata?.provider_id,
        })
      }
      
      console.log('Database user synced:', user)
      setDbUser(user)
    } catch (error) {
      console.error('Error syncing user with database:', error)
    }
  }

  const signIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
          skipBrowserRedirect: false,
        },
      })
      
      if (error) throw error
    } catch (error) {
      console.error('Error signing in:', error)
    }
  }

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const value = {
    user,
    dbUser,
    loading,
    signIn,
    signOut,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}