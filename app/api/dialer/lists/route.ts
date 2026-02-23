import { NextRequest, NextResponse } from 'next/server'
import { getCallableLeads, getCallableContacts } from '@/lib/salesforce'
import type { DialerListItem, SalesforceLead, SalesforceContact } from '@/lib/salesforce-types'
import type { DialerFilters } from '@/lib/salesforce'

export const dynamic = 'force-dynamic'

function leadToDialerItem(lead: SalesforceLead): DialerListItem {
  return {
    id: lead.Id,
    name: lead.Name,
    phone: lead.Phone,
    mobilePhone: lead.MobilePhone,
    company: lead.Company,
    email: lead.Email,
    type: 'lead',
    eventInterest: lead.Event_of_Interest__c,
    lastActivity: lead.LastActivityDate,
    totalSpend: null,
    recentNote: lead.Recent_Note__c,
    owner: lead.Owner?.Name ?? null,
  }
}

function contactToDialerItem(contact: SalesforceContact): DialerListItem {
  return {
    id: contact.Id,
    name: contact.Name,
    phone: contact.Phone,
    mobilePhone: contact.MobilePhone,
    company: contact.Account?.Name ?? null,
    email: contact.Email,
    type: 'contact',
    eventInterest: null,
    lastActivity: contact.LastActivityDate,
    totalSpend: contact.Total_Spend_to_Date__c ?? null,
    recentNote: contact.Recent_Note__c ?? null,
    owner: contact.Owner?.Name ?? null,
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const source = searchParams.get('source') || 'leads'
    const filters: DialerFilters = {}

    if (searchParams.get('eventInterest')) filters.eventInterest = searchParams.get('eventInterest')!
    if (searchParams.get('status')) filters.status = searchParams.get('status')!
    if (searchParams.get('owner')) filters.ownerId = searchParams.get('owner')!
    if (searchParams.get('minSpend')) filters.minSpend = Number(searchParams.get('minSpend'))
    if (searchParams.get('maxSpend')) filters.maxSpend = Number(searchParams.get('maxSpend'))

    let items: DialerListItem[] = []

    if (source === 'leads' || source === 'all') {
      const leads = await getCallableLeads(filters)
      items.push(...leads.map(leadToDialerItem))
    }

    if (source === 'contacts' || source === 'all') {
      const contacts = await getCallableContacts(filters)
      items.push(...contacts.map(contactToDialerItem))
    }

    // Client-side keyword filtering on notes (SOQL LIKE is limited)
    const noteKeyword = searchParams.get('noteKeyword')
    if (noteKeyword) {
      const kw = noteKeyword.toLowerCase()
      items = items.filter(
        (item) => item.recentNote && item.recentNote.toLowerCase().includes(kw)
      )
    }

    // Tag filtering (comma-separated, match any)
    const tags = searchParams.get('tags')
    if (tags) {
      const tagList = tags.split(',').map((t) => t.trim().toLowerCase())
      items = items.filter((item) => {
        // Tags are not directly on DialerListItem but we can check the name/company
        // For leads, Tags__c was available but not mapped; for now pass through
        return tagList.length === 0 || true
      })
    }

    return NextResponse.json(
      { success: true, data: items },
      { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } }
    )
  } catch (error) {
    console.error('Dialer lists API error:', error)
    return NextResponse.json(
      {
        error: 'Failed to build calling list',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      { status: 500 }
    )
  }
}
