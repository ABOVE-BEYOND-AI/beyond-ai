import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin, apiErrorResponse } from '@/lib/api-auth'
import { setUserRole } from '@/lib/redis-database'
import { UserRole } from '@/lib/types'

// POST /api/users/role — Admin only: change a user's role
export async function POST(req: NextRequest) {
  try {
    const ctx = await requireApiAdmin(req)

    const { email, role } = await req.json()

    if (!email || !role) {
      return NextResponse.json({ error: 'Email and role are required' }, { status: 400 })
    }

    const validRoles: UserRole[] = ['admin', 'finance', 'member', 'viewer']
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role. Must be: admin, finance, member, or viewer' }, { status: 400 })
    }

    // Prevent removing your own admin
    if (email === ctx.email && role !== 'admin') {
      return NextResponse.json({ error: 'Cannot remove your own admin role' }, { status: 400 })
    }

    const updatedUser = await setUserRole(email, role)

    return NextResponse.json({ user: updatedUser })
  } catch (error) {
    console.error('Failed to update user role:', error)
    return apiErrorResponse(error, 'Internal server error')
  }
}
