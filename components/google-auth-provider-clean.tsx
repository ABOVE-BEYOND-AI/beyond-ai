'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { GoogleUser } from '@/lib/types'
import { getGoogleAuthUrl, decodeSession } from '@/lib/google-oauth-clean'

interface GoogleAuthContextType {
  user: GoogleUser | null
  loading: boolean
  signIn: () => void
  signOut: () => void
  accessToken: string | null
  isAuthenticated: boolean
}

const GoogleAuthContext = createContext<GoogleAuthContextType | undefined>(undefined)

export function GoogleAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<GoogleUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [accessToken, setAccessToken] = useState<string | null>(null)

  const clearSession = useCallback(() => {
    // Clear session cookie using standard web API
    document.cookie = 'beyond_ai_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
  }, [])

  const loadSessionFromCookie = useCallback(() => {
    try {
      console.log('🔍 Auth: Loading session from cookie...')
      
      // Get session cookie using standard web API
      const cookies = document.cookie.split('; ')
      const sessionCookie = cookies.find(row => row.startsWith('beyond_ai_session='))
      
      if (!sessionCookie) {
        console.log('🔍 Auth: No session cookie found')
        setLoading(false)
        return
      }

      const sessionToken = sessionCookie.split('=')[1]
      const session = decodeSession(sessionToken)
      
      if (session) {
        // Check if session is expired
        if (session.tokens.expires_at && Date.now() > session.tokens.expires_at) {
          console.log('❌ Auth: Session expired')
          clearSession()
          setLoading(false)
          return
        }

        console.log('✅ Auth: Valid session found for:', session.user.email)
        setUser(session.user)
        setAccessToken(session.tokens.access_token)
      } else {
        console.log('❌ Auth: Invalid session cookie')
        clearSession()
      }
    } catch (error) {
      console.error('❌ Auth: Error loading session:', error)
      clearSession()
    } finally {
      setLoading(false)
    }
  }, [clearSession])

  useEffect(() => {
    loadSessionFromCookie()
  }, [loadSessionFromCookie])

  const signIn = () => {
    console.log('🚀 Auth: Starting Google sign-in...')
    const authUrl = getGoogleAuthUrl()
    window.location.href = authUrl
  }

  const signOut = () => {
    console.log('👋 Auth: Signing out...')
    clearSession()
    setUser(null)
    setAccessToken(null)
  }



  const value: GoogleAuthContextType = {
    user,
    loading,
    signIn,
    signOut,
    accessToken,
    isAuthenticated: !!user,
  }

  return (
    <GoogleAuthContext.Provider value={value}>
      {children}
    </GoogleAuthContext.Provider>
  )
}

export function useGoogleAuth() {
  const context = useContext(GoogleAuthContext)
  if (context === undefined) {
    // Return safe defaults when context is undefined (SSR, build time, or missing provider)
    return {
      user: null,
      loading: true,
      signIn: () => {},
      signOut: () => {},
      accessToken: null,
      isAuthenticated: false,
    }
  }
  return context
}