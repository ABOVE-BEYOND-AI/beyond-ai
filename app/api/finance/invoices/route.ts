import { NextRequest, NextResponse } from 'next/server'
import { describeObject, query } from '@/lib/salesforce'

export const dynamic = 'force-dynamic'

// Module-level cache for discovered invoice fields (persists across requests in the same server instance)
let cachedInvoiceFields: { name: string; label: string; type: string }[] | null = null

/**
 * Discover Breadwinner invoice fields via Salesforce describe API.
 * Results are cached in a module-level variable to avoid repeated describe calls.
 */
async function discoverInvoiceFields(): Promise<{ name: string; label: string; type: string }[]> {
  if (cachedInvoiceFields) return cachedInvoiceFields

  const description = await describeObject('Bread_Winner__Invoice__c')
  cachedInvoiceFields = description.fields
    .filter(f => f.type !== 'address' && f.type !== 'location') // Skip compound fields
    .map(f => ({ name: f.name, label: f.label, type: f.type }))

  return cachedInvoiceFields
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const accountId = searchParams.get('accountId')
    const search = searchParams.get('search')

    // Step 1: Discover fields from the Breadwinner Invoice object
    let fields: { name: string; label: string; type: string }[]
    try {
      fields = await discoverInvoiceFields()
    } catch (describeError) {
      console.error('Failed to describe Bread_Winner__Invoice__c:', describeError)
      return NextResponse.json({
        success: false,
        error: 'Breadwinner Invoice object not found or not accessible',
        details: process.env.NODE_ENV === 'development' ? String(describeError) : undefined,
        hint: 'The Bread_Winner__Invoice__c object may not be installed in this org, or the connected user lacks permissions. Check that the Breadwinner managed package is installed.',
      }, { status: 404 })
    }

    // Step 2: Build SELECT clause from discovered fields
    // Limit to queryable scalar fields; skip base64/blob fields
    const queryableFieldNames = fields
      .filter(f => !f.name.includes('.') && f.type !== 'base64')
      .map(f => f.name)
      .slice(0, 40) // Cap to avoid SOQL field-count limits

    const selectClause = queryableFieldNames.join(', ')

    // Step 3: Build WHERE clause from query params
    const conditions: string[] = []

    if (status) {
      // Find the status picklist field dynamically
      const statusField = fields.find(f =>
        f.name.toLowerCase().includes('status') && (f.type === 'picklist' || f.type === 'string')
      )
      if (statusField) {
        const escapedStatus = status.replace(/'/g, "\\'")
        conditions.push(`${statusField.name} = '${escapedStatus}'`)
      }
    }

    if (accountId) {
      // Find the account lookup field dynamically
      const accountField = fields.find(f =>
        f.type === 'reference' && (f.name.toLowerCase().includes('account') || f.label.toLowerCase().includes('account'))
      )
      if (accountField) {
        conditions.push(`${accountField.name} = '${accountId}'`)
      }
    }

    if (search) {
      const escapedSearch = search.replace(/'/g, "\\'")
      conditions.push(`Name LIKE '%${escapedSearch}%'`)
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : ''

    // Step 4: Execute SOQL query
    const soql = `
      SELECT ${selectClause}
      FROM Bread_Winner__Invoice__c
      ${whereClause}
      ORDER BY CreatedDate DESC
      LIMIT 200
    `.trim()

    const result = await query<Record<string, unknown>>(soql)

    return NextResponse.json({
      success: true,
      data: result.records,
      meta: {
        totalSize: result.totalSize,
        discoveredFields: fields.length,
        queriedFields: queryableFieldNames.length,
      },
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    })
  } catch (error) {
    console.error('Invoices API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch invoices',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
        hint: 'This endpoint dynamically discovers Breadwinner invoice fields. If fields have changed, clear the server cache by redeploying.',
      },
      { status: 500 },
    )
  }
}
