import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser, apiErrorResponse } from '@/lib/api-auth'
import { getValidGoogleAccessToken } from '@/lib/google-tokens'
import { sendEmail } from '@/lib/gmail'

export const dynamic = 'force-dynamic'

/**
 * POST /api/email/send
 * Send a single email via Gmail on behalf of the authenticated user.
 * Body: { to: string, subject: string, body: string }
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireApiUser(request)
    const email = ctx.email

    // Get a valid access token from Redis (refreshes if expired)
    const accessToken = await getValidGoogleAccessToken(email)

    // Parse body
    const body = await request.json()
    const { to, subject, body: htmlBody } = body as {
      to?: string
      subject?: string
      body?: string
    }

    if (!to || !subject || !htmlBody) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: to, subject, body' },
        { status: 400 }
      )
    }

    // Send
    const result = await sendEmail(accessToken, { to, subject, htmlBody })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('Email send API error:', error)
    return apiErrorResponse(error, 'Failed to send email')
  }
}
