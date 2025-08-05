'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function GoogleCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [error, setError] = useState<string | null>(null)

  const handleGoogleCallback = async () => {
    try {
      console.log('🔄 Google Callback: Processing OAuth response...')
      
      // Get authorization code from URL params
      const code = searchParams.get('code')
      const error = searchParams.get('error')
      
      if (error) {
        console.error('❌ Google Callback: OAuth error:', error)
        setError(`Authentication failed: ${error}`)
        setStatus('error')
        return
      }

      if (!code) {
        console.error('❌ Google Callback: No authorization code received')
        setError('No authorization code received from Google')
        setStatus('error')
        return
      }

      console.log('✅ Google Callback: Authorization code received, exchanging for tokens...')

      // Call our API to handle the token exchange and user creation
      const response = await fetch('/api/auth/google/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      })

      const result = await response.json()

      if (!response.ok) {
        console.error('❌ Google Callback: API error:', result.error)
        setError(result.error || 'Authentication failed')
        setStatus('error')
        return
      }

      console.log('🎉 Google Callback: Authentication successful!')
      setStatus('success')

      // Force a reload of the auth context before redirecting
      setTimeout(() => {
        console.log('🔄 Google Callback: Refreshing page to ensure auth state is loaded...')
        window.location.href = '/itinerary'
      }, 1500)

    } catch (error) {
      console.error('❌ Google Callback: Unexpected error:', error)
      setError(error instanceof Error ? error.message : 'An unexpected error occurred')
      setStatus('error')
    }
  }

  useEffect(() => {
    handleGoogleCallback()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (status === 'processing') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">Completing authentication...</p>
          <p className="text-gray-400 text-sm mt-2">Please wait while we sign you in</p>
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 flex items-center justify-center">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <p className="text-white text-lg">Authentication successful!</p>
          <p className="text-gray-400 text-sm mt-2">Redirecting to your itineraries...</p>
        </div>
      </div>
    )
  }

  // Error state
  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="text-center max-w-md mx-auto px-6">
        <div className="w-12 h-12 mx-auto mb-4 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </div>
        <p className="text-white text-lg mb-2">Authentication failed</p>
        <p className="text-gray-400 text-sm mb-6">{error}</p>
        <button
          onClick={() => router.push('/auth/signin')}
          className="px-6 py-2 bg-white text-black rounded-lg hover:bg-gray-200 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  )
}