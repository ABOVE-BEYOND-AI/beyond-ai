// Salesforce REST API integration using OAuth 2.0 Client Credentials flow
// Uses standard fetch — no external packages needed

interface SalesforceTokenResponse {
  access_token: string
  instance_url: string
  id: string
  token_type: string
  issued_at: string
  signature: string
}

interface SalesforceQueryResponse<T> {
  totalSize: number
  done: boolean
  records: T[]
  nextRecordsUrl?: string
}

// Cached token to avoid re-authenticating on every request
let cachedToken: { access_token: string; instance_url: string; expires_at: number } | null = null

/**
 * Authenticate with Salesforce using OAuth 2.0 Client Credentials flow
 * (server-to-server, no user login required)
 */
async function authenticate(): Promise<{ access_token: string; instance_url: string }> {
  // Return cached token if still valid (with 5 min buffer)
  if (cachedToken && Date.now() < cachedToken.expires_at - 5 * 60 * 1000) {
    return { access_token: cachedToken.access_token, instance_url: cachedToken.instance_url }
  }

  const clientId = process.env.SALESFORCE_CLIENT_ID
  const clientSecret = process.env.SALESFORCE_CLIENT_SECRET
  const loginUrl = process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com'

  if (!clientId || !clientSecret) {
    throw new Error('Missing SALESFORCE_CLIENT_ID or SALESFORCE_CLIENT_SECRET environment variables')
  }

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  })

  const response = await fetch(`${loginUrl}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    console.error('Salesforce auth failed:', response.status, errorBody)
    throw new Error(`Salesforce authentication failed: ${response.status} - ${errorBody}`)
  }

  const data: SalesforceTokenResponse = await response.json()

  // Cache for 1 hour (Salesforce tokens typically last 2 hours)
  cachedToken = {
    access_token: data.access_token,
    instance_url: data.instance_url,
    expires_at: Date.now() + 60 * 60 * 1000,
  }

  return { access_token: data.access_token, instance_url: data.instance_url }
}

/**
 * Execute a SOQL query against Salesforce
 */
async function query<T>(soql: string): Promise<SalesforceQueryResponse<T>> {
  const { access_token, instance_url } = await authenticate()

  const url = `${instance_url}/services/data/v59.0/query?q=${encodeURIComponent(soql)}`

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${access_token}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorBody = await response.text()

    // If 401, clear cached token and retry once
    if (response.status === 401 && cachedToken) {
      cachedToken = null
      return query<T>(soql)
    }

    console.error('Salesforce query failed:', response.status, errorBody, 'SOQL:', soql.substring(0, 200))
    throw new Error(`Salesforce query failed: ${response.status} - ${errorBody}`)
  }

  return response.json()
}

// ──────────────────────────────────────────────
// Salesforce Opportunity record shape
// Matches your org's actual field API names
// ──────────────────────────────────────────────

export interface SalesforceOpportunity {
  Id: string
  Name: string                                // Opportunity Name
  StageName: string                           // Stage
  CloseDate: string                           // YYYY-MM-DD
  Amount: number | null                       // Net Amount (standard field)
  Gross_Amount__c: number | null              // Gross Amount (formula: Net + Service Charge + Processing Fee)
  Service_Charge__c: number | null            // Service Charge (formula)
  Processing_Fee__c: number | null            // Processing Fee (formula)
  Owner: { Name: string; Email?: string } | null
  Account: { Name: string } | null
  Event__r: { Name: string } | null           // Event lookup (relationship name)
  CreatedDate: string
}

// ──────────────────────────────────────────────
// Date helpers for SOQL WHERE clauses
// ──────────────────────────────────────────────

function getTodayRange(): { start: string; end: string } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1)
  return { start: toSoqlDate(start), end: toSoqlDate(end) }
}

function getWeekRange(): { start: string; end: string } {
  const now = new Date()
  const day = now.getDay()
  // Monday-based week
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((day + 6) % 7))
  const sunday = new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000 - 1)
  return { start: toSoqlDate(monday), end: toSoqlDate(sunday) }
}

function getMonthRange(): { start: string; end: string } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { start: toSoqlDate(start), end: toSoqlDate(end) }
}

function getYearRange(): { start: string; end: string } {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  const end = new Date(now.getFullYear(), 11, 31)
  return { start: toSoqlDate(start), end: toSoqlDate(end) }
}

function toSoqlDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

// ──────────────────────────────────────────────
// Public API functions
// ──────────────────────────────────────────────

export type SalesPeriod = 'today' | 'week' | 'month' | 'year'

function getDateRange(period: SalesPeriod): { start: string; end: string } {
  switch (period) {
    case 'today': return getTodayRange()
    case 'week': return getWeekRange()
    case 'month': return getMonthRange()
    case 'year': return getYearRange()
  }
}

/**
 * The set of "closed" stage names in your Salesforce org.
 */
const CLOSED_STAGES = process.env.SALESFORCE_CLOSED_STAGES
  ? process.env.SALESFORCE_CLOSED_STAGES.split(',').map(s => s.trim())
  : ['Agreement Signed', 'Closed Won']

function stageFilter(): string {
  return CLOSED_STAGES.map(s => `'${s}'`).join(', ')
}

/**
 * SELECT fields for opportunity queries.
 * Gross_Amount__c is a formula field so we can read it but NOT use it
 * in SUM/AVG/GROUP BY — aggregation is done in-code instead.
 */
const SELECT_FIELDS = `
  Id, Name, StageName, CloseDate, Amount,
  Gross_Amount__c, Service_Charge__c, Processing_Fee__c,
  Owner.Name, Owner.Email,
  Account.Name,
  Event__r.Name,
  CreatedDate
`.trim()

/**
 * Helper: get the gross amount from a record, falling back to Amount (Net)
 */
function grossAmount(opp: SalesforceOpportunity): number {
  return opp.Gross_Amount__c ?? opp.Amount ?? 0
}

/**
 * Fetch all closed deals for a given period.
 * We fetch records (up to 2000) and aggregate in code because
 * Gross_Amount__c is a formula field and can't be used with SUM/GROUP BY.
 */
async function fetchDealsForPeriod(period: SalesPeriod): Promise<SalesforceOpportunity[]> {
  const { start, end } = getDateRange(period)

  const soql = `
    SELECT ${SELECT_FIELDS}
    FROM Opportunity
    WHERE StageName IN (${stageFilter()})
      AND CloseDate >= ${start}
      AND CloseDate <= ${end}
    ORDER BY CloseDate DESC
    LIMIT 2000
  `.trim()

  const result = await query<SalesforceOpportunity>(soql)
  return result.records
}

/**
 * Compute totals from a list of deals
 */
function computeTotals(deals: SalesforceOpportunity[]): {
  total_amount: number
  total_deals: number
  average_deal: number
} {
  const total_deals = deals.length
  const total_amount = deals.reduce((sum, d) => sum + grossAmount(d), 0)
  const average_deal = total_deals > 0 ? total_amount / total_deals : 0

  return { total_amount, total_deals, average_deal }
}

/**
 * Compute leaderboard from a list of deals
 */
function computeLeaderboard(deals: SalesforceOpportunity[]): Array<{
  name: string
  email: string
  total_amount: number
  deal_count: number
}> {
  const repMap = new Map<string, { name: string; email: string; total_amount: number; deal_count: number }>()

  for (const deal of deals) {
    const name = deal.Owner?.Name || 'Unknown'
    const email = deal.Owner?.Email || ''
    const key = email || name

    const existing = repMap.get(key)
    if (existing) {
      existing.total_amount += grossAmount(deal)
      existing.deal_count += 1
    } else {
      repMap.set(key, { name, email, total_amount: grossAmount(deal), deal_count: 1 })
    }
  }

  return Array.from(repMap.values()).sort((a, b) => b.total_amount - a.total_amount)
}

/**
 * Full dashboard payload — fetches deals for all periods in parallel,
 * then computes totals and leaderboard in-code.
 */
// ──────────────────────────────────────────────
// Re-export types from salesforce-types.ts
// ──────────────────────────────────────────────

export type {
  SalesforceLead,
  SalesforceOpportunityFull,
  SalesforceEvent as SalesforceEventRecord,
  SalesforceContact,
  ABNote,
  SalesforceTarget,
  SalesforceCommission,
  LeadFilters,
  PipelineFilters,
  ClientFilters,
} from './salesforce-types'

import type {
  SalesforceLead,
  SalesforceOpportunityFull,
  SalesforceEvent as SalesforceEventRecord,
  SalesforceContact,
  ABNote,
  SalesforceTarget,
  SalesforceCommission,
  LeadFilters,
  PipelineFilters,
  ClientFilters,
} from './salesforce-types'

import { LEAD_SOURCE_GROUPS } from './constants'

// ──────────────────────────────────────────────
// SOQL field lists for new queries
// ──────────────────────────────────────────────

const LEAD_SELECT_FIELDS = `
  Id, Name, FirstName, LastName, Email, Phone, MobilePhone,
  Company, Title, Status, LeadSource, Rating,
  Score__c, Event_of_Interest__c, Interests__c,
  No_of_Guests__c, Form_Comments__c, Form_Type__c,
  Recent_Note__c, Tags__c, Unqualified_Reason__c,
  Last_Event_Booked__c, Web_to_Lead_Created__c,
  Web_to_Lead_Page_Information__c,
  Formula_1__c, Football__c, Rugby__c, Tennis__c,
  Live_Music__c, Culinary__c, Luxury_Lifestyle_Celebrity__c,
  Unique_Experiences__c, Other__c,
  LinkedIn__c, Facebook__c, Twitter__c,
  CreatedDate, LastModifiedDate, LastActivityDate,
  FirstCallDateTime, FirstEmailDateTime,
  OwnerId, Owner.Name,
  I_agree_to_be_emailed__c, HasOptedOutOfEmail,
  Newsletter_Subscribed__c
`.trim()

const PIPELINE_SELECT_FIELDS = `
  Id, Name, StageName, Amount, CloseDate,
  Gross_Amount__c, Service_Charge__c, Processing_Fee__c,
  AccountId, Account.Name,
  Event__c, Event__r.Name, Event__r.Category__c, Event__r.Start_Date__c,
  Total_Number_of_Guests__c,
  Percentage_Paid__c,
  Total_Amount_Paid__c, Total_Balance__c,
  NextStep, LeadSource,
  Is_New_Business__c,
  OwnerId, Owner.Name, Owner.Email,
  CreatedDate, LastModifiedDate, LastActivityDate
`.trim()

const EVENT_SELECT_FIELDS = `
  Id, Name, Category__c, Start_Date__c, End_Date__c,
  Start_Time__c, End_Time__c,
  Location__c, Location__r.Name,
  Revenue_Target__c, Sum_of_Closed_Won_Gross__c,
  Percentage_to_Target__c, Revenue_Progress__c,
  Margin_Percentage__c, Total_Margin_Value__c,
  Total_Booking_Cost__c, Total_Staff_Costs__c, Total_Payments_Received__c,
  Event_Tickets_Required__c, Event_Tickets_Booked__c, Event_Tickets_Remaining__c,
  Hospitality_Tickets_Required__c, Hospitality_Tickets_Booked__c, Hospitality_Tickets_Remaining__c,
  Hotel_Tickets_Required__c, Hotel_Tickets_Booked__c, Hotel_Tickets_Remaining__c,
  Dinner_Tickets_Required__c, Dinner_Tickets_Booked__c, Dinner_Tickets_Remaining__c,
  Drinks_Tickets_Required__c, Drinks_Tickets_Booked__c, Drinks_Tickets_Remaining__c,
  Party_Tickets_Required__c, Party_Tickets_Booked__c, Party_Tickets_Remaining__c,
  Inbound_Flight_Tickets_Required__c, Inbound_Flight_Tickets_Booked__c, Inbound_Flights_Tickets_Remaining__c,
  Outbound_Flight_Tickets_Required__c, Outbound_Flight_Tickets_Booked__c, Outbound_Flights_Tickets_Remaining__c,
  Inbound_Transfer_Tickets_Required__c, Inbound_Transfer_Tickets_Booked__c, Inbound_Transfer_Tickets_Remaining__c,
  Outbound_Transfer_Tickets_Required__c, Outbound_Transfer_Tickets_Booked__c, Outbound_Transfer_Tickets_Remaining__c,
  Total_Tickets_Required__c, Total_Tickets_Booked__c, Total_Tickets_Remaining__c,
  Percentage_Reservations_Completion__c,
  Total_Projects__c,
  A_B_On_Site_1__c, A_B_On_Site_2__c,
  Event_Image_1__c, Master_Package_Code__c
`.trim()

const CONTACT_SELECT_FIELDS = `
  Id, Name, FirstName, LastName, Email, Phone, MobilePhone,
  AccountId, Account.Name, Account.Type, Account.Industry,
  Title, LeadSource,
  OwnerId, Owner.Name,
  CreatedDate, LastActivityDate
`.trim()

// ──────────────────────────────────────────────
// LEADS
// ──────────────────────────────────────────────

export async function getLeads(filters?: LeadFilters): Promise<SalesforceLead[]> {
  let whereClause = 'IsConverted = false'

  if (filters?.status) {
    whereClause += ` AND Status = '${filters.status}'`
  }

  if (filters?.sourceGroup && LEAD_SOURCE_GROUPS[filters.sourceGroup]) {
    const sources = LEAD_SOURCE_GROUPS[filters.sourceGroup].map(s => `'${s}'`).join(', ')
    whereClause += ` AND LeadSource IN (${sources})`
  }

  if (filters?.ownerId) {
    whereClause += ` AND OwnerId = '${filters.ownerId}'`
  }

  if (filters?.search) {
    const s = filters.search.replace(/'/g, "\\'")
    whereClause += ` AND (Name LIKE '%${s}%' OR Company LIKE '%${s}%' OR Email LIKE '%${s}%')`
  }

  // Smart view filters
  if (filters?.view === 'hot') {
    whereClause += ` AND Status != 'Unqualified' AND Rating IN ('Hot', 'Warm')`
  } else if (filters?.view === 'needCalling') {
    whereClause += ` AND Status IN ('New', 'Working') AND FirstCallDateTime = null`
  } else if (filters?.view === 'newThisWeek') {
    whereClause += ` AND CreatedDate = THIS_WEEK`
  } else if (filters?.view === 'goingCold') {
    whereClause += ` AND Status != 'Unqualified' AND LastActivityDate < LAST_N_DAYS:14`
  } else if (filters?.view === 'eventInterested') {
    whereClause += ` AND Event_of_Interest__c != null`
  } else if (filters?.view === 'unqualified') {
    whereClause += ` AND Status = 'Unqualified'`
  }

  // Interest category filter
  if (filters?.interest) {
    whereClause += ` AND ${filters.interest} = true`
  }

  const soql = `
    SELECT ${LEAD_SELECT_FIELDS}
    FROM Lead
    WHERE ${whereClause}
    ORDER BY LastActivityDate DESC NULLS LAST
    LIMIT 500
  `.trim()

  const result = await query<SalesforceLead>(soql)
  return result.records
}

export async function updateLead(id: string, fields: Record<string, unknown>): Promise<void> {
  await updateRecord('Lead', id, fields)
}

export async function convertLead(id: string): Promise<{ contactId: string; accountId: string; opportunityId?: string }> {
  const { access_token, instance_url } = await authenticate()

  const response = await fetch(`${instance_url}/services/data/v59.0/actions/standard/convertLead`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: [{
        leadId: id,
        convertedStatus: 'Qualified',
        createOpportunity: true,
      }],
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Lead conversion failed: ${response.status} - ${errorBody}`)
  }

  const data = await response.json()
  const result = data[0]
  return {
    contactId: result.outputValues?.contactId || '',
    accountId: result.outputValues?.accountId || '',
    opportunityId: result.outputValues?.opportunityId,
  }
}

// ──────────────────────────────────────────────
// PIPELINE (Open Opportunities)
// ──────────────────────────────────────────────

export async function getOpenOpportunities(filters?: PipelineFilters): Promise<SalesforceOpportunityFull[]> {
  let whereClause = filters?.includeClosed ? '1=1' : 'IsClosed = false'

  if (filters?.ownerId) {
    whereClause += ` AND OwnerId = '${filters.ownerId}'`
  }
  if (filters?.eventId) {
    whereClause += ` AND Event__c = '${filters.eventId}'`
  }
  if (filters?.eventCategory) {
    whereClause += ` AND Event__r.Category__c = '${filters.eventCategory}'`
  }
  if (filters?.minAmount) {
    whereClause += ` AND Amount >= ${filters.minAmount}`
  }
  if (filters?.maxAmount) {
    whereClause += ` AND Amount <= ${filters.maxAmount}`
  }

  const soql = `
    SELECT ${PIPELINE_SELECT_FIELDS}
    FROM Opportunity
    WHERE ${whereClause}
    ORDER BY LastModifiedDate DESC
    LIMIT 500
  `.trim()

  try {
    const result = await query<SalesforceOpportunityFull>(soql)
    return result.records
  } catch (err) {
    // Fallback: retry with only core Opportunity fields that are guaranteed to exist
    console.warn('Pipeline query failed, retrying with core fields only:', err)
    const fallbackSoql = `
      SELECT Id, Name, StageName, Amount, CloseDate,
        Gross_Amount__c, Service_Charge__c, Processing_Fee__c,
        AccountId, Account.Name,
        OwnerId, Owner.Name, Owner.Email,
        LeadSource, NextStep,
        CreatedDate, LastModifiedDate, LastActivityDate
      FROM Opportunity
      WHERE ${whereClause}
      ORDER BY LastModifiedDate DESC
      LIMIT 500
    `.trim()
    const result = await query<SalesforceOpportunityFull>(fallbackSoql)
    return result.records
  }
}

export async function updateOpportunityStage(id: string, stage: string): Promise<void> {
  await updateRecord('Opportunity', id, { StageName: stage })
}

// ──────────────────────────────────────────────
// EVENTS (with inventory)
// ──────────────────────────────────────────────

export async function getEventsWithInventory(): Promise<SalesforceEventRecord[]> {
  const soql = `
    SELECT ${EVENT_SELECT_FIELDS}
    FROM Event__c
    ORDER BY Start_Date__c ASC NULLS LAST
    LIMIT 200
  `.trim()

  const result = await query<SalesforceEventRecord>(soql)
  return result.records
}

export async function getEventOpportunities(eventId: string): Promise<SalesforceOpportunityFull[]> {
  const soql = `
    SELECT ${PIPELINE_SELECT_FIELDS}
    FROM Opportunity
    WHERE Event__c = '${eventId}'
    ORDER BY StageName ASC
    LIMIT 200
  `.trim()

  const result = await query<SalesforceOpportunityFull>(soql)
  return result.records
}

// ──────────────────────────────────────────────
// CLIENTS (Contacts)
// ──────────────────────────────────────────────

export async function getContacts(filters?: ClientFilters): Promise<SalesforceContact[]> {
  let whereClause = 'Id != null'

  if (filters?.search) {
    const s = filters.search.replace(/'/g, "\\'")
    whereClause += ` AND (Name LIKE '%${s}%' OR Email LIKE '%${s}%')`
  }
  if (filters?.ownerId) {
    whereClause += ` AND OwnerId = '${filters.ownerId}'`
  }

  const soql = `
    SELECT ${CONTACT_SELECT_FIELDS}
    FROM Contact
    WHERE ${whereClause}
    ORDER BY LastActivityDate DESC NULLS LAST
    LIMIT 200
  `.trim()

  let result: { records: SalesforceContact[] }
  try {
    result = await query<SalesforceContact>(soql)
  } catch (err) {
    // Fallback: retry with only standard Contact fields
    console.warn('Contacts query failed, retrying with standard fields only:', err)
    const fallbackSoql = `
      SELECT Id, Name, FirstName, LastName, Email, Phone, MobilePhone,
        AccountId, Account.Name, Title,
        OwnerId, Owner.Name,
        CreatedDate, LastActivityDate
      FROM Contact
      WHERE ${whereClause}
      ORDER BY LastActivityDate DESC NULLS LAST
      LIMIT 200
    `.trim()
    result = await query<SalesforceContact>(fallbackSoql)
  }
  return result.records
}

export async function getContactDetail(contactId: string): Promise<SalesforceContact> {
  const soql = `
    SELECT ${CONTACT_SELECT_FIELDS}
    FROM Contact
    WHERE Id = '${contactId}'
    LIMIT 1
  `.trim()

  const result = await query<SalesforceContact>(soql)
  if (result.records.length === 0) throw new Error('Contact not found')
  return result.records[0]
}

export async function getContactOpportunities(contactId: string): Promise<SalesforceOpportunityFull[]> {
  const soql = `
    SELECT ${PIPELINE_SELECT_FIELDS}
    FROM Opportunity
    WHERE Opportunity_Contact__c = '${contactId}'
    ORDER BY CloseDate DESC
    LIMIT 100
  `.trim()

  const result = await query<SalesforceOpportunityFull>(soql)
  return result.records
}

export async function getContactNotes(contactId: string): Promise<ABNote[]> {
  // A_B_Note__c may relate to Contact via a lookup
  const soql = `
    SELECT Id, Name, Body__c, OwnerId, Owner.Alias, CreatedDate
    FROM A_B_Note__c
    WHERE Contact__c = '${contactId}'
    ORDER BY CreatedDate DESC
    LIMIT 50
  `.trim()

  const result = await query<ABNote>(soql)
  return result.records
}

// ──────────────────────────────────────────────
// ANALYTICS
// ──────────────────────────────────────────────

export interface ChannelAttribution {
  LeadSource: string
  totalDeals: number
  totalRevenue: number
  avgDealSize: number
}

export async function getChannelAttribution(): Promise<ChannelAttribution[]> {
  // Can't use GROUP BY with formula fields, so fetch records and aggregate in-code
  const soql = `
    SELECT Id, Amount, Gross_Amount__c, LeadSource
    FROM Opportunity
    WHERE StageName IN ('Agreement Signed', 'Amended', 'Amendment Signed')
      AND CloseDate >= THIS_YEAR
      AND LeadSource != null
    LIMIT 2000
  `.trim()

  const result = await query<{ Id: string; Amount: number | null; Gross_Amount__c: number | null; LeadSource: string }>(soql)

  const sourceMap = new Map<string, { totalDeals: number; totalRevenue: number }>()
  for (const r of result.records) {
    const source = r.LeadSource || 'Unknown'
    const existing = sourceMap.get(source) || { totalDeals: 0, totalRevenue: 0 }
    existing.totalDeals += 1
    existing.totalRevenue += r.Gross_Amount__c ?? r.Amount ?? 0
    sourceMap.set(source, existing)
  }

  return Array.from(sourceMap.entries())
    .map(([source, data]) => ({
      LeadSource: source,
      totalDeals: data.totalDeals,
      totalRevenue: data.totalRevenue,
      avgDealSize: data.totalDeals > 0 ? data.totalRevenue / data.totalDeals : 0,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
}

export interface RepPerformance {
  name: string
  email: string
  totalDeals: number
  totalRevenue: number
  avgDealSize: number
  totalGuests: number
}

export async function getRepPerformance(): Promise<RepPerformance[]> {
  const soql = `
    SELECT Id, Amount, Gross_Amount__c, Owner.Name, Owner.Email, Total_Number_of_Guests__c
    FROM Opportunity
    WHERE StageName IN ('Agreement Signed', 'Amended', 'Amendment Signed')
      AND CloseDate >= THIS_YEAR
    LIMIT 2000
  `.trim()

  const result = await query<{
    Id: string; Amount: number | null; Gross_Amount__c: number | null;
    Owner: { Name: string; Email?: string } | null;
    Total_Number_of_Guests__c: number | null
  }>(soql)

  const repMap = new Map<string, RepPerformance>()
  for (const r of result.records) {
    const name = r.Owner?.Name || 'Unknown'
    const email = r.Owner?.Email || ''
    const key = email || name
    const existing = repMap.get(key) || { name, email, totalDeals: 0, totalRevenue: 0, avgDealSize: 0, totalGuests: 0 }
    existing.totalDeals += 1
    existing.totalRevenue += r.Gross_Amount__c ?? r.Amount ?? 0
    existing.totalGuests += r.Total_Number_of_Guests__c ?? 0
    repMap.set(key, existing)
  }

  return Array.from(repMap.values())
    .map(r => ({ ...r, avgDealSize: r.totalDeals > 0 ? r.totalRevenue / r.totalDeals : 0 }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
}

export interface EventPerformance {
  eventName: string
  eventCategory: string | null
  totalDeals: number
  totalRevenue: number
  totalGross: number
}

export async function getEventPerformance(): Promise<EventPerformance[]> {
  const soql = `
    SELECT Id, Amount, Gross_Amount__c, Event__r.Name, Event__r.Category__c
    FROM Opportunity
    WHERE StageName IN ('Agreement Signed', 'Amended', 'Amendment Signed')
      AND CloseDate >= THIS_YEAR
      AND Event__c != null
    LIMIT 2000
  `.trim()

  const result = await query<{
    Id: string; Amount: number | null; Gross_Amount__c: number | null;
    Event__r: { Name: string; Category__c?: string } | null
  }>(soql)

  const eventMap = new Map<string, EventPerformance>()
  for (const r of result.records) {
    const name = r.Event__r?.Name || 'Unknown'
    const existing = eventMap.get(name) || { eventName: name, eventCategory: r.Event__r?.Category__c || null, totalDeals: 0, totalRevenue: 0, totalGross: 0 }
    existing.totalDeals += 1
    existing.totalRevenue += r.Amount ?? 0
    existing.totalGross += r.Gross_Amount__c ?? r.Amount ?? 0
    eventMap.set(name, existing)
  }

  return Array.from(eventMap.values()).sort((a, b) => b.totalGross - a.totalGross)
}

// ──────────────────────────────────────────────
// TARGETS & COMMISSION
// ──────────────────────────────────────────────

export async function getMonthlyTargets(year: string, month: string): Promise<SalesforceTarget[]> {
  const soql = `
    SELECT Id, Name, Target_Amount__c, OwnerId, Owner.Name, Type__c, Month__c, Year__c, Days_Absent__c
    FROM Target__c
    WHERE Year__c = '${year}' AND Month__c = '${month}'
    LIMIT 100
  `.trim()

  const result = await query<SalesforceTarget>(soql)
  return result.records
}

export async function getCommissionData(year: string): Promise<SalesforceCommission[]> {
  const soql = `
    SELECT Id, Name, Sales_Person__c, Sales_Person__r.Name,
      Total_Monthly_commission__c, Commission_Rate_Applicable__c,
      Gross_Amount_Moved_to_Agreement_Signed__c,
      KPI_Targets__c, KPI_Targets_Met__c,
      Clawback__c, Amount_Paid_to_Salesperson__c,
      New_Bus_Ops__c, AVG_Call_Time__c,
      Avg_Rolling_Commission__c,
      Month__c, Month_Name__c, Year__c
    FROM Commissions__c
    WHERE Year__c = '${year}'
    ORDER BY Month__c DESC
    LIMIT 200
  `.trim()

  const result = await query<SalesforceCommission>(soql)
  return result.records
}

// ──────────────────────────────────────────────
// GENERIC UPDATE (write-back)
// ──────────────────────────────────────────────

export async function updateRecord(objectType: string, id: string, fields: Record<string, unknown>): Promise<void> {
  const { access_token, instance_url } = await authenticate()

  const response = await fetch(`${instance_url}/services/data/v59.0/sobjects/${objectType}/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(fields),
  })

  if (!response.ok && response.status !== 204) {
    const errorBody = await response.text()
    throw new Error(`Salesforce update failed: ${response.status} - ${errorBody}`)
  }
}

// ──────────────────────────────────────────────
// SALES DASHBOARD (existing)
// ──────────────────────────────────────────────

export async function getDashboardData(period: SalesPeriod = 'month') {
  // Fetch all four periods in parallel
  const [todayDeals, weekDeals, monthDeals, yearDeals] = await Promise.all([
    fetchDealsForPeriod('today'),
    fetchDealsForPeriod('week'),
    fetchDealsForPeriod('month'),
    fetchDealsForPeriod('year'),
  ])

  // Map period to its fetched deals
  const dealsByPeriod: Record<SalesPeriod, SalesforceOpportunity[]> = {
    today: todayDeals,
    week: weekDeals,
    month: monthDeals,
    year: yearDeals,
  }

  const selectedDeals = dealsByPeriod[period]

  return {
    period,
    totals: computeTotals(selectedDeals),
    deals: selectedDeals.slice(0, 25), // Recent deals for the selected period
    leaderboard: computeLeaderboard(selectedDeals),
    all_totals: {
      today: computeTotals(todayDeals),
      week: computeTotals(weekDeals),
      month: computeTotals(monthDeals),
      year: computeTotals(yearDeals),
    },
  }
}
