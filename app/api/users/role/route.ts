import { NextRequest, NextResponse } from 'next/server'
import { decodeSession } from '@/lib/google-oauth-clean'
import { getUser, setUserRole } from '@/lib/redis-database'
import { UserRole } from '@/lib/types'

// POST /api/users/role — Admin only: change a user's role
export async function POST(req: NextRequest) {
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

    const { email, role } = await req.json()

    if (!email || !role) {
      return NextResponse.json({ error: 'Email and role are required' }, { status: 400 })
    }

    const validRoles: UserRole[] = ['admin', 'member', 'viewer']
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role. Must be: admin, member, or viewer' }, { status: 400 })
    }

    // Prevent removing your own admin
    if (email === session.user.email && role !== 'admin') {
      return NextResponse.json({ error: 'Cannot remove your own admin role' }, { status: 400 })
    }

    const updatedUser = await setUserRole(email, role)

    return NextResponse.json({ user: updatedUser })
  } catch (error) {
    console.error('Failed to update user role:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
