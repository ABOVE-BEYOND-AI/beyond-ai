import { NextResponse } from 'next/server'

// POST /api/auth/signout — Clear httpOnly session cookie
export async function POST() {
  const isProduction = process.env.NODE_ENV === 'production'

  const response = NextResponse.json({ success: true })

  // Clear the httpOnly session cookie
  response.cookies.set('beyond_ai_session', '', {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })

  // Clear the display cookie
  response.cookies.set('beyond_ai_user', '', {
    httpOnly: false,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })

  return response
}
