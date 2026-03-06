import { NextRequest, NextResponse } from 'next/server'
import { createOutboundCall, listUsers } from '@/lib/aircall'
import { apiErrorResponse, requireApiUser } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const context = await requireApiUser(request)
    const body = await request.json()
    const { userId, phoneNumber } = body

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Missing phoneNumber' },
        { status: 400 }
      )
    }

    let callerId = Number(userId)

    if (!Number.isFinite(callerId) || callerId <= 0) {
      const users = await listUsers()
      const matchedUser = users.find(
        (user) => user.email?.toLowerCase() === context.email.toLowerCase()
      )

      if (matchedUser) {
        callerId = matchedUser.id
      } else {
        const fallbackCallerId = Number(process.env.AIRCALL_DEFAULT_NUMBER_ID)
        if (Number.isFinite(fallbackCallerId) && fallbackCallerId > 0) {
          callerId = fallbackCallerId
        } else {
          return NextResponse.json(
            {
              error: 'No Aircall caller ID configured for this user. Set AIRCALL_DEFAULT_NUMBER_ID or pass a valid Aircall caller ID.',
            },
            { status: 400 }
          )
        }
      }
    }

    const call = await createOutboundCall(callerId, phoneNumber)

    return NextResponse.json({ success: true, data: call, callerId })
  } catch (error) {
    console.error('Dialer call API error:', error)
    return apiErrorResponse(error, 'Failed to initiate call')
  }
}
