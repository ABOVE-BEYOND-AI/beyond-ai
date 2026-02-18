import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const key = searchParams.get('key')

  const tvKey = process.env.TV_ACCESS_KEY

  if (!tvKey) {
    return NextResponse.json(
      { valid: false, error: 'TV access not configured' },
      { status: 503 }
    )
  }

  if (!key || key !== tvKey) {
    return NextResponse.json(
      { valid: false, error: 'Invalid access key' },
      { status: 401 }
    )
  }

  return NextResponse.json({ valid: true })
}
