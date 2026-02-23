'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
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
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null)

  const clearSession = useCallback(() => {
    document.cookie = 'beyond_ai_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = null
    }
  }, [])

  // Silent token refresh
  const refreshToken = useCallback(async () => {
    try {
      console.log('🔄 Auth: Attempting silent token refresh...')
      const res = await fetch('/api/auth/refresh', { method: 'POST' })
      const data = await res.json()

      if (data.refreshed && data.access_token) {
        console.log('✅ Auth: Token refreshed silently')
        setAccessToken(data.access_token)
        // Schedule next refresh 5 minutes before expiry
        scheduleRefresh(data.expires_at)
        return true
      }

      if (data.requireReauth) {
        console.log('⚠️ Auth: Re-authentication required')
        // Don't auto-redirect — just clear state, user can sign in again
        clearSession()
        setUser(null)
        setAccessToken(null)
        return false
      }

      // Token still valid, just schedule next check
      if (data.expires_at) {
        scheduleRefresh(data.expires_at)
      }
      return true
    } catch (error) {
      console.error('❌ Auth: Token refresh failed:', error)
      return false
    }
  }, [clearSession])

  // Schedule a refresh 5 minutes before token expires
  const scheduleRefresh = useCallback((expiresAt: number) => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
    }

    const timeUntilRefresh = (expiresAt - Date.now()) - (5 * 60 * 1000) // 5 min before expiry
    const delay = Math.max(timeUntilRefresh, 30 * 1000) // At least 30 seconds

    console.log(`⏰ Auth: Next token refresh in ${Math.round(delay / 1000 / 60)} minutes`)

    refreshTimerRef.current = setTimeout(() => {
      refreshToken()
    }, delay)
  }, [refreshToken])

  const loadSessionFromCookie = useCallback(() => {
    try {
      console.log('🔍 Auth: Loading session from cookie...')

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
        // Check if access token is expired
        const isExpired = session.tokens.expires_at && Date.now() > session.tokens.expires_at

        if (isExpired) {
          console.log('⏰ Auth: Access token expired, attempting refresh...')
          // Set user info immediately (we have it), then refresh token in background
          setUser(session.user)
          setLoading(false)
          refreshToken().then(success => {
            if (!success) {
              // Refresh failed, clear everything
              clearSession()
              setUser(null)
              setAccessToken(null)
            }
          })
          return
        }

        console.log('✅ Auth: Valid session found for:', session.user.email)
        setUser(session.user)
        setAccessToken(session.tokens.access_token)

        // Schedule proactive refresh before expiry
        if (session.tokens.expires_at) {
          scheduleRefresh(session.tokens.expires_at)
        }
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
  }, [clearSession, refreshToken, scheduleRefresh])

  useEffect(() => {
    loadSessionFromCookie()
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
      }
    }
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
