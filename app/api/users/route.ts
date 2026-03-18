import { NextRequest, NextResponse } from 'next/server'
import { requireApiAdmin, apiErrorResponse } from '@/lib/api-auth'
import { getAllUsers } from '@/lib/redis-database'

// GET /api/users — Admin only: list all users
export async function GET(req: NextRequest) {
  try {
    await requireApiAdmin(req)
    const users = await getAllUsers()
    return NextResponse.json({ users })
  } catch (error) {
    console.error('Failed to list users:', error)
    return apiErrorResponse(error, 'Internal server error')
  }
}
