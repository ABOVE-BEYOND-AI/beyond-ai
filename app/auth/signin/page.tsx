'use client'

import { useEffect } from 'react'
import { useGoogleAuth } from '@/components/google-auth-provider-clean'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import Image from 'next/image'
import Script from 'next/script'

// TypeScript declaration for UnicornStudio global
declare global {
  interface Window {
    UnicornStudio: {
      addScene: (config: any) => Promise<any>
      init: () => Promise<any>
      destroy: () => void
    }
  }
}

export default function SignInPage() {
  const { user, loading, signIn } = useGoogleAuth()
  const router = useRouter()

  useEffect(() => {
    // If user is already signed in, redirect to itinerary page
    if (user && !loading) {
      router.push('/itinerary')
    }
  }, [user, loading, router])

  // Initialize UnicornStudio dynamically
  useEffect(() => {
    const initUnicornStudio = async () => {
      try {
        // Load the script dynamically
        const script = document.createElement('script')
        script.src = 'https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v1.4.29/dist/unicornStudio.umd.js'
        script.async = true
        
        script.onload = () => {
          console.log('UnicornStudio script loaded')
          
          if (window.UnicornStudio) {
            // Add the scene dynamically
            window.UnicornStudio.addScene({
              elementId: "unicorn-background",
              fps: 60,
              scale: 1,
              dpi: 1.5,
              projectId: "JQ48D8y1Xk20g5pX3apZ",
              lazyLoad: false,
              altText: "Beyond AI Animated Background",
              ariaLabel: "Animated background scene",
              production: true,
              interactivity: {
                mouse: {
                  disableMobile: false,
                  disabled: false
                }
              }
            })
            .then((scene) => {
              console.log('UnicornStudio scene initialized:', scene)
            })
            .catch((err) => {
              console.error('UnicornStudio scene error:', err)
            })
          }
        }
        
        script.onerror = (error) => {
          console.error('Failed to load UnicornStudio script:', error)
        }
        
        document.head.appendChild(script)
      } catch (error) {
        console.error('Error setting up UnicornStudio:', error)
      }
    }
    
    initUnicornStudio()
    
    // Cleanup function
    return () => {
      if (window.UnicornStudio) {
        try {
          window.UnicornStudio.destroy()
        } catch (error) {
          console.log('UnicornStudio cleanup error:', error)
        }
      }
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (user) {
    return null // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 w-full h-full">
        <div 
          id="unicorn-background"
          className="w-full h-full"
          style={{ 
            width: '100%', 
            height: '100%',
            minWidth: '1440px',
            minHeight: '900px'
          }}
        />
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/30"></div>
      </div>
      
      {/* Sign-in Content */}
      <div className="min-h-screen flex items-center justify-center relative z-10">
        <Card className="w-full max-w-md bg-black/70 backdrop-blur-lg border border-white/10 shadow-2xl">
          <CardContent className="space-y-8 p-8">
            {/* Logo */}
            <div className="flex justify-center">
              <Image
                src="/BeyondAI (6) (1).svg"
                alt="Beyond AI Logo"
                width={200}
                height={55}
                className="h-auto max-w-full"
              />
            </div>
            
            {/* Sign-in Button */}
            <Button 
              onClick={signIn}
              className="w-full bg-white text-black hover:bg-gray-100 border-0"
              size="lg"
            >
              <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}