import { NextRequest, NextResponse } from 'next/server'
import { decodeSession } from '@/lib/google-oauth-clean'
import { getUser, getAllUsers } from '@/lib/redis-database'

// GET /api/users — Admin only: list all users
export async function GET(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get('beyond_ai_session')
    if (!sessionCookie?.value) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const session = decodeSession(sessionCookie.value)
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    // Check admin role
    const currentUser = await getUser(session.user.email)
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    const users = await getAllUsers()

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Failed to list users:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
