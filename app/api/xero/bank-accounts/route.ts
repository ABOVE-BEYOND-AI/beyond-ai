import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser, apiErrorResponse } from '@/lib/api-auth'
import { getBankAccounts } from '@/lib/xero'

export const dynamic = 'force-dynamic'

// GET /api/xero/bank-accounts — Get available bank accounts for payment recording
export async function GET(request: NextRequest) {
  try {
    await requireApiUser(request)
    const accounts = await getBankAccounts()
    return NextResponse.json({ success: true, data: accounts })
  } catch (error) {
    console.error('Bank accounts error:', error)
    return apiErrorResponse(error, 'Failed to fetch bank accounts')
  }
}
