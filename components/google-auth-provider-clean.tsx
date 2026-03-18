'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { GoogleUser } from '@/lib/types'
import { getGoogleAuthUrl } from '@/lib/google-oauth-clean'

interface GoogleAuthContextType {
  user: GoogleUser | null
  loading: boolean
  signIn: () => void
  signOut: () => void
  accessToken: string | null
  isAuthenticated: boolean
}

const GoogleAuthContext = createContext<GoogleAuthContextType | undefined>(undefined)

/** Read the non-httpOnly display cookie for user info. */
function readDisplayCookie(): { email: string; name: string; picture: string } | null {
  try {
    const cookie = document.cookie.split('; ').find(c => c.startsWith('beyond_ai_user='))
    if (!cookie) return null
    const value = cookie.split('=').slice(1).join('=')
    return JSON.parse(atob(decodeURIComponent(value)))
  } catch {
    return null
  }
}

export function GoogleAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<GoogleUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null)

  const clearCookies = useCallback(() => {
    // Clear the display cookie (client-side)
    document.cookie = 'beyond_ai_user=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = null
    }
  }, [])

  // Use a ref to break the circular dependency between refreshToken and scheduleRefresh
  const refreshTokenRef = useRef<() => Promise<boolean>>(null)

  const scheduleRefresh = useCallback((expiresAt: number) => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
    }

    const timeUntilRefresh = (expiresAt - Date.now()) - (5 * 60 * 1000)
    const delay = Math.max(timeUntilRefresh, 30 * 1000) // At least 30 seconds

    refreshTimerRef.current = setTimeout(() => {
      refreshTokenRef.current?.()
    }, delay)
  }, [])

  // Silent token refresh — gets access token from server (tokens live in Redis, not cookies)
  const refreshToken = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/refresh', { method: 'POST' })
      const data = await res.json()

      if (data.refreshed && data.access_token) {
        setAccessToken(data.access_token)
        scheduleRefresh(data.expires_at)
        return true
      }

      if (!data.refreshed && data.access_token) {
        setAccessToken(data.access_token)
        if (data.expires_at) scheduleRefresh(data.expires_at)
        return true
      }

      if (data.requireReauth) {
        clearCookies()
        setUser(null)
        setAccessToken(null)
        return false
      }

      if (data.expires_at) {
        scheduleRefresh(data.expires_at)
      }
      return true
    } catch (error) {
      console.error('Auth: Token refresh failed:', error)
      return false
    }
  }, [clearCookies, scheduleRefresh])

  // Keep ref in sync
  refreshTokenRef.current = refreshToken

  const loadSession = useCallback(() => {
    try {
      // Read display cookie for user info (no tokens — they're server-side only)
      const displayData = readDisplayCookie()

      if (!displayData) {
        setLoading(false)
        return
      }

      // Set user info from display cookie
      setUser({
        id: '',
        email: displayData.email,
        name: displayData.name,
        picture: displayData.picture,
      })

      // Get access token from server (it reads from Redis, not cookies)
      refreshToken().then(success => {
        if (!success) {
          clearCookies()
          setUser(null)
          setAccessToken(null)
        }
      })
    } catch (error) {
      console.error('Auth: Error loading session:', error)
      clearCookies()
    } finally {
      setLoading(false)
    }
  }, [clearCookies, refreshToken])

  useEffect(() => {
    loadSession()
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
      }
    }
  }, [loadSession])

  const signIn = () => {
    const authUrl = getGoogleAuthUrl()
    window.location.href = authUrl
  }

  const signOut = async () => {
    clearCookies()
    setUser(null)
    setAccessToken(null)
    // Clear the httpOnly session cookie via API
    try {
      await fetch('/api/auth/signout', { method: 'POST' })
    } catch {
      // Best-effort — cookie will expire naturally
    }
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
