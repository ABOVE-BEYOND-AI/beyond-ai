'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { GoogleUser, AuthSession } from '@/lib/types'
import { getGoogleAuthUrl } from '@/lib/google-auth'
import { getValidSession, clearSession, COOKIE_NAME } from '@/lib/auth-utils'

interface GoogleAuthContextType {
  user: GoogleUser | null
  loading: boolean
  signIn: () => void
  signOut: () => Promise<void>
  accessToken: string | null
  isAuthenticated: boolean
}

const GoogleAuthContext = createContext<GoogleAuthContextType | undefined>(undefined)

export function GoogleAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<GoogleUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [accessToken, setAccessToken] = useState<string | null>(null)

  useEffect(() => {
    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    try {
      console.log('🔍 Google Auth: Checking auth status...')
      
      // Get session token from cookie
      const sessionToken = getCookie(COOKIE_NAME)
      
      if (!sessionToken) {
        console.log('🔍 Google Auth: No session cookie found')
        setLoading(false)
        return
      }

      console.log('🔍 Google Auth: Session cookie found, validating...')
      
      // Validate session
      const session = await getValidSession(sessionToken)
      
      if (session) {
        console.log('✅ Google Auth: Valid session found for:', session.user.email)
        setUser(session.user)
        setAccessToken(session.tokens.access_token)
      } else {
        console.log('❌ Google Auth: Invalid session, clearing cookie')
        removeCookie(COOKIE_NAME)
      }
    } catch (error) {
      console.error('❌ Google Auth: Error checking auth status:', error)
      removeCookie(COOKIE_NAME)
    } finally {
      setLoading(false)
    }
  }

  const signIn = () => {
    console.log('🚀 Google Auth: Starting sign-in flow...')
    const authUrl = getGoogleAuthUrl()
    window.location.href = authUrl
  }

  const signOut = async () => {
    try {
      console.log('👋 Google Auth: Signing out...')
      
      const sessionToken = getCookie(COOKIE_NAME)
      if (sessionToken) {
        await clearSession(sessionToken)
      }
      
      removeCookie(COOKIE_NAME)
      setUser(null)
      setAccessToken(null)
      
      console.log('✅ Google Auth: Signed out successfully')
    } catch (error) {
      console.error('❌ Google Auth: Error during sign out:', error)
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
    throw new Error('useGoogleAuth must be used within a GoogleAuthProvider')
  }
  return context
}

// Cookie utilities (client-side)
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null
  }
  return null
}

function removeCookie(name: string): void {
  if (typeof document === 'undefined') return
  
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
}