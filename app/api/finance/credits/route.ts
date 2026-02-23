import { NextResponse } from 'next/server'
import { getCreditAccounts } from '@/lib/salesforce'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const creditAccounts = await getCreditAccounts()

    return NextResponse.json({
      success: true,
      data: creditAccounts,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    })
  } catch (error) {
    console.error('Credits API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch credit accounts', details: process.env.NODE_ENV === 'development' ? String(error) : undefined },
      { status: 500 },
    )
  }
}
