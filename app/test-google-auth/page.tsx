'use client'

import { GoogleAuthProvider, useGoogleAuth } from '@/components/google-auth-provider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Image from 'next/image'

function TestContent() {
  const { user, loading, signIn, signOut, accessToken, isAuthenticated } = useGoogleAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading Google Auth...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">🧪 Google Auth System Test</h1>
          <p className="text-muted-foreground">
            Testing the new Google authentication system before migration
          </p>
        </div>

        <div className="grid gap-6">
          {/* Authentication Status */}
          <Card>
            <CardHeader>
              <CardTitle>Authentication Status</CardTitle>
              <CardDescription>Current state of the Google auth system</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${isAuthenticated ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="font-medium">
                    {isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
                  </span>
                </div>
                
                {isAuthenticated ? (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      ✅ User is signed in with Google
                    </p>
                    <p className="text-sm text-muted-foreground">
                      ✅ Access token available for Google APIs
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    ❌ User needs to sign in
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* User Information */}
          {user && (
            <Card>
              <CardHeader>
                <CardTitle>User Information</CardTitle>
                <CardDescription>Data received from Google</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-4">
                  <Image
                    src={user.picture}
                    alt={user.name}
                    width={64}
                    height={64}
                    className="rounded-full"
                  />
                  <div className="space-y-1">
                    <p className="font-medium">{user.name}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    <p className="text-xs text-muted-foreground">ID: {user.id}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Token Information */}
          {accessToken && (
            <Card>
              <CardHeader>
                <CardTitle>Access Token</CardTitle>
                <CardDescription>Google API access token (truncated for security)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="font-mono text-sm bg-muted p-2 rounded">
                    {accessToken.substring(0, 20)}...{accessToken.substring(accessToken.length - 10)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ✅ This token can be used for Google Drive and Slides APIs
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
              <CardDescription>Test authentication functions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                {!isAuthenticated ? (
                  <Button onClick={signIn} className="flex items-center gap-2">
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
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
                    Sign in with Google
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={signOut}>
                      Sign Out
                    </Button>
                    <Button 
                      onClick={() => window.location.href = '/itinerary'}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Go to Itinerary Page
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Test Results */}
          <Card>
            <CardHeader>
              <CardTitle>Test Results</CardTitle>
              <CardDescription>What we're verifying with this test</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isAuthenticated ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <span className="text-sm">Google OAuth flow works</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${user ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <span className="text-sm">User data retrieved from Google</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${accessToken ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <span className="text-sm">Access token available for APIs</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                  <span className="text-sm">Redis storage working (check console logs)</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function TestGoogleAuthPage() {
  return (
    <GoogleAuthProvider>
      <TestContent />
    </GoogleAuthProvider>
  )
}