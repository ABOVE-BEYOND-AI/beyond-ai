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
export async function query<T>(soql: string): Promise<SalesforceQueryResponse<T>> {
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
// SOQL Sanitization Utilities
// ──────────────────────────────────────────────

/** Salesforce ID pattern: 15 or 18 alphanumeric characters */
const SFID_PATTERN = /^[a-zA-Z0-9]{15,18}$/

/** Allowed interest field names for SOQL field injection prevention */
const ALLOWED_INTEREST_FIELDS = [
  'Formula_1__c',
  'Football__c',
  'Rugby__c',
  'Tennis__c',
  'Live_Music__c',
  'Culinary__c',
  'Luxury_Lifestyle_Celebrity__c',
  'Unique_Experiences__c',
  'Other__c',
]

/**
 * Escape single quotes in a string value for safe SOQL interpolation.
 * Replaces ' with \' to prevent SOQL injection.
 */
export function sanitizeSoqlValue(value: string): string {
  return value.replace(/'/g, "\\'")
}

/**
 * Validate a field name against an allowlist to prevent SOQL field injection.
 * Throws an error if the field name is not in the allowed list.
 */
export function validateSoqlFieldName(field: string, allowed: string[]): string {
  if (!allowed.includes(field)) {
    throw new Error(`Invalid SOQL field name: "${field}". Allowed fields: ${allowed.join(', ')}`)
  }
  return field
}

/**
 * Validate that a value matches the Salesforce ID pattern (15 or 18 alphanumeric chars).
 * Throws an error if the value is not a valid Salesforce ID.
 */
function validateSalesforceId(value: string, fieldName: string): string {
  if (!SFID_PATTERN.test(value)) {
    throw new Error(`Invalid Salesforce ID for ${fieldName}: "${value}"`)
  }
  return value
}

/**
 * Validate and coerce a value to a safe number for SOQL.
 * Throws an error if the value is not a valid number.
 */
function validateNumber(value: number | string, fieldName: string): number {
  const num = Number(value)
  if (isNaN(num) || !isFinite(num)) {
    throw new Error(`Invalid numeric value for ${fieldName}: "${value}"`)
  }
  return num
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
  return CLOSED_STAGES.map(s => `'${sanitizeSoqlValue(s)}'`).join(', ')
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
  ABNoteExpanded,
  SalesforceTarget,
  SalesforceCommission,
  LeadFilters,
  PipelineFilters,
  ClientFilters,
  NoteFilters,
  BreadwinnerInvoice,
  FinanceFilters,
} from './salesforce-types'

import type {
  SalesforceLead,
  SalesforceOpportunityFull,
  SalesforceEvent as SalesforceEventRecord,
  SalesforceContact,
  ABNote,
  ABNoteExpanded,
  SalesforceTarget,
  SalesforceCommission,
  LeadFilters,
  PipelineFilters,
  ClientFilters,
  NoteFilters,
  BreadwinnerInvoice,
  FinanceFilters,
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
  Gross_Amount__c, Service_Charge__c, Processing_Fee__c, Tax_Amount__c,
  AccountId, Account.Name,
  Opportunity_Contact__c, Opportunity_Contact__r.Name,
  Event__c, Event__r.Name, Event__r.Category__c, Event__r.Start_Date__c,
  Package_Sold__c, Package_Sold__r.Name,
  Total_Number_of_Guests__c,
  Percentage_Paid__c, Payment_Progress__c,
  Total_Amount_Paid__c, Total_Balance__c, Total_Payments_Due__c,
  Commission_Amount__c,
  NextStep, Special_Requirements__c,
  Is_New_Business__c, LeadSource,
  Sign_Request_Complete__c, Loss_Reason__c,
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
  Event_Image_1__c, Event_Image_2__c, Event_Image_3__c, Event_Image_4__c, Event_Image_5__c,
  Description__c, Event_Notes__c,
  Master_Package_Code__c,
  OwnerId, Owner.Name
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
    whereClause += ` AND Status = '${sanitizeSoqlValue(filters.status)}'`
  }

  if (filters?.sourceGroup && LEAD_SOURCE_GROUPS[filters.sourceGroup]) {
    const sources = LEAD_SOURCE_GROUPS[filters.sourceGroup].map(s => `'${sanitizeSoqlValue(s)}'`).join(', ')
    whereClause += ` AND LeadSource IN (${sources})`
  }

  if (filters?.ownerId) {
    validateSalesforceId(filters.ownerId, 'ownerId')
    whereClause += ` AND OwnerId = '${filters.ownerId}'`
  }

  if (filters?.search) {
    const s = sanitizeSoqlValue(filters.search)
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
    const validField = validateSoqlFieldName(filters.interest, ALLOWED_INTEREST_FIELDS)
    whereClause += ` AND ${validField} = true`
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
  const conditions: string[] = []

  if (!filters?.includeClosed) {
    conditions.push('IsClosed = false')
  }
  if (filters?.ownerId) {
    validateSalesforceId(filters.ownerId, 'ownerId')
    conditions.push(`OwnerId = '${filters.ownerId}'`)
  }
  if (filters?.eventId) {
    validateSalesforceId(filters.eventId, 'eventId')
    conditions.push(`Event__c = '${filters.eventId}'`)
  }
  if (filters?.eventCategory) {
    conditions.push(`Event__r.Category__c = '${sanitizeSoqlValue(filters.eventCategory)}'`)
  }
  if (filters?.minAmount) {
    conditions.push(`Amount >= ${validateNumber(filters.minAmount, 'minAmount')}`)
  }
  if (filters?.maxAmount) {
    conditions.push(`Amount <= ${validateNumber(filters.maxAmount, 'maxAmount')}`)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const soql = `
    SELECT ${PIPELINE_SELECT_FIELDS}
    FROM Opportunity
    ${whereClause}
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
      ${whereClause}
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
  validateSalesforceId(eventId, 'eventId')
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
    const s = sanitizeSoqlValue(filters.search)
    whereClause += ` AND (Name LIKE '%${s}%' OR Email LIKE '%${s}%' OR Account.Name LIKE '%${s}%')`
  }
  if (filters?.ownerId) {
    validateSalesforceId(filters.ownerId, 'ownerId')
    whereClause += ` AND OwnerId = '${filters.ownerId}'`
  }
  if (filters?.minSpend) {
    whereClause += ` AND Total_Spend_to_Date__c >= ${validateNumber(filters.minSpend, 'minSpend')}`
  }
  if (filters?.maxSpend) {
    whereClause += ` AND Total_Spend_to_Date__c <= ${validateNumber(filters.maxSpend, 'maxSpend')}`
  }
  if (filters?.view === 'personal') {
    whereClause += ` AND Account.IsPersonAccount = true`
  } else if (filters?.view === 'business') {
    whereClause += ` AND Account.IsPersonAccount = false`
  }
  if (filters?.interests) {
    const interestTerms = filters.interests.split(',').map(i => i.trim()).filter(Boolean)
    for (const term of interestTerms) {
      const it = sanitizeSoqlValue(term)
      whereClause += ` AND Interests__c LIKE '%${it}%'`
    }
  }

  // Determine ORDER BY based on sortBy
  let orderBy = 'LastActivityDate DESC NULLS LAST'
  if (filters?.sortBy === 'spend') orderBy = 'Total_Spend_to_Date__c DESC NULLS LAST'
  else if (filters?.sortBy === 'name') orderBy = 'Name ASC'
  else if (filters?.sortBy === 'created') orderBy = 'CreatedDate DESC'

  // If noteKeyword filter, find matching contact IDs from notes first
  if (filters?.noteKeyword) {
    try {
      const nk = sanitizeSoqlValue(filters.noteKeyword)
      const noteResult = await query<{ Contact__c: string }>(`
        SELECT Contact__c FROM A_B_Note__c
        WHERE Body__c LIKE '%${nk}%' AND Contact__c != null
        LIMIT 500
      `.trim())
      const noteContactIds = [...new Set(noteResult.records.map(n => n.Contact__c))]
      if (noteContactIds.length === 0) return []
      // noteContactIds come from Salesforce query results, so they are already valid IDs
      whereClause += ` AND Id IN ('${noteContactIds.join("','")}')`
    } catch {
      // Notes query failed, continue without note filter
    }
  }

  const soql = `
    SELECT ${CONTACT_SELECT_FIELDS}
    FROM Contact
    WHERE ${whereClause}
    ORDER BY ${orderBy}
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
      ORDER BY ${orderBy}
      LIMIT 200
    `.trim()
    result = await query<SalesforceContact>(fallbackSoql)
  }
  return result.records
}

export async function getContactDetail(contactId: string): Promise<SalesforceContact> {
  validateSalesforceId(contactId, 'contactId')
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
  validateSalesforceId(contactId, 'contactId')
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
  validateSalesforceId(contactId, 'contactId')
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
  ownerId: string
  totalDeals: number
  totalRevenue: number
  avgDealSize: number
  totalGuests: number
}

export async function getRepPerformance(): Promise<RepPerformance[]> {
  const soql = `
    SELECT Id, Amount, Gross_Amount__c, OwnerId, Owner.Name, Owner.Email, Total_Number_of_Guests__c
    FROM Opportunity
    WHERE StageName IN ('Agreement Signed', 'Amended', 'Amendment Signed')
      AND CloseDate >= THIS_YEAR
    LIMIT 2000
  `.trim()

  const result = await query<{
    Id: string; Amount: number | null; Gross_Amount__c: number | null;
    OwnerId: string;
    Owner: { Name: string; Email?: string } | null;
    Total_Number_of_Guests__c: number | null
  }>(soql)

  const repMap = new Map<string, RepPerformance>()
  for (const r of result.records) {
    const name = r.Owner?.Name || 'Unknown'
    const email = r.Owner?.Email || ''
    const ownerId = r.OwnerId || ''
    const key = email || name
    const existing = repMap.get(key) || { name, email, ownerId, totalDeals: 0, totalRevenue: 0, avgDealSize: 0, totalGuests: 0 }
    existing.totalDeals += 1
    existing.totalRevenue += r.Gross_Amount__c ?? r.Amount ?? 0
    existing.totalGuests += r.Total_Number_of_Guests__c ?? 0
    if (!existing.ownerId && ownerId) existing.ownerId = ownerId
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
    WHERE Year__c = '${sanitizeSoqlValue(year)}' AND Month__c = '${sanitizeSoqlValue(month)}'
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
    WHERE Year__c = '${sanitizeSoqlValue(year)}'
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

/**
 * Create a new record in Salesforce and return the new record ID
 */
export async function createRecord(objectType: string, fields: Record<string, unknown>): Promise<string> {
  const { access_token, instance_url } = await authenticate()

  const response = await fetch(`${instance_url}/services/data/v59.0/sobjects/${objectType}/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(fields),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Salesforce create failed: ${response.status} - ${errorBody}`)
  }

  const data = await response.json()
  return data.id as string
}

/**
 * Delete a record from Salesforce
 */
export async function deleteRecord(objectType: string, id: string): Promise<void> {
  const { access_token, instance_url } = await authenticate()

  const response = await fetch(`${instance_url}/services/data/v59.0/sobjects/${objectType}/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${access_token}`,
    },
  })

  if (!response.ok && response.status !== 204) {
    const errorBody = await response.text()
    throw new Error(`Salesforce delete failed: ${response.status} - ${errorBody}`)
  }
}

/**
 * Create multiple records in a single Salesforce Composite API call (up to 200)
 */
export async function createRecordsBatch(
  objectType: string,
  recordsList: Record<string, unknown>[]
): Promise<{ id: string; success: boolean; errors: string[] }[]> {
  const { access_token, instance_url } = await authenticate()

  // Salesforce composite limit: 200 records per call
  const batches: Record<string, unknown>[][] = []
  for (let i = 0; i < recordsList.length; i += 200) {
    batches.push(recordsList.slice(i, i + 200))
  }

  const allResults: { id: string; success: boolean; errors: string[] }[] = []

  for (const batch of batches) {
    const response = await fetch(
      `${instance_url}/services/data/v59.0/composite/sobjects`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          allOrNone: false,
          records: batch.map(fields => ({
            attributes: { type: objectType },
            ...fields,
          })),
        }),
      }
    )

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`Salesforce batch create failed: ${response.status} - ${errorBody}`)
    }

    const data = await response.json()
    allResults.push(
      ...data.map((r: { id: string; success: boolean; errors: { message: string }[] }) => ({
        id: r.id || '',
        success: r.success,
        errors: r.errors?.map((e: { message: string }) => e.message) || [],
      }))
    )
  }

  return allResults
}

/**
 * Describe a Salesforce object to discover its fields
 * Useful for Breadwinner and other managed package objects
 */
export async function describeObject(objectType: string): Promise<{
  name: string
  label: string
  fields: { name: string; label: string; type: string; length: number; nillable: boolean }[]
}> {
  const { access_token, instance_url } = await authenticate()

  const response = await fetch(
    `${instance_url}/services/data/v59.0/sobjects/${objectType}/describe`,
    {
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Salesforce describe failed: ${response.status} - ${errorBody}`)
  }

  const data = await response.json()
  return {
    name: data.name,
    label: data.label,
    fields: data.fields.map((f: { name: string; label: string; type: string; length: number; nillable: boolean }) => ({
      name: f.name,
      label: f.label,
      type: f.type,
      length: f.length,
      nillable: f.nillable,
    })),
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

// ──────────────────────────────────────────────
// NOTES (A_B_Note__c)
// ──────────────────────────────────────────────

const NOTE_SELECT_FIELDS = `
  Id, Name, Body__c,
  Contact__c, Contact__r.Name, Contact__r.Id,
  OwnerId, Owner.Alias, Owner.Name,
  CreatedDate, LastModifiedDate
`.trim()

/**
 * Search notes by keyword in Body__c
 */
export async function searchNotes(keyword: string, filters?: NoteFilters): Promise<ABNoteExpanded[]> {
  const conditions: string[] = []
  const escapedKeyword = sanitizeSoqlValue(keyword)
  conditions.push(`Body__c LIKE '%${escapedKeyword}%'`)

  if (filters?.contactId) {
    validateSalesforceId(filters.contactId, 'contactId')
    conditions.push(`Contact__c = '${filters.contactId}'`)
  }
  if (filters?.ownerId) {
    validateSalesforceId(filters.ownerId, 'ownerId')
    conditions.push(`OwnerId = '${filters.ownerId}'`)
  }

  const limit = validateNumber(filters?.limit || 200, 'limit')
  const soql = `
    SELECT ${NOTE_SELECT_FIELDS}
    FROM A_B_Note__c
    WHERE ${conditions.join(' AND ')}
    ORDER BY CreatedDate DESC
    LIMIT ${limit}
  `.trim()

  const result = await query<ABNoteExpanded>(soql)
  return result.records
}

/**
 * Get all notes with optional filters
 */
export async function getAllNotes(filters?: NoteFilters): Promise<ABNoteExpanded[]> {
  const conditions: string[] = ['Id != null']

  if (filters?.contactId) {
    validateSalesforceId(filters.contactId, 'contactId')
    conditions.push(`Contact__c = '${filters.contactId}'`)
  }
  if (filters?.ownerId) {
    validateSalesforceId(filters.ownerId, 'ownerId')
    conditions.push(`OwnerId = '${filters.ownerId}'`)
  }
  if (filters?.search) {
    const s = sanitizeSoqlValue(filters.search)
    conditions.push(`Body__c LIKE '%${s}%'`)
  }

  const limit = validateNumber(filters?.limit || 200, 'limit')
  const offset = validateNumber(filters?.offset || 0, 'offset')
  const soql = `
    SELECT ${NOTE_SELECT_FIELDS}
    FROM A_B_Note__c
    WHERE ${conditions.join(' AND ')}
    ORDER BY CreatedDate DESC
    LIMIT ${limit}
    ${offset > 0 ? `OFFSET ${offset}` : ''}
  `.trim()

  const result = await query<ABNoteExpanded>(soql)
  return result.records
}

/**
 * Get a single note by ID
 */
export async function getNoteById(noteId: string): Promise<ABNoteExpanded> {
  validateSalesforceId(noteId, 'noteId')
  const soql = `
    SELECT ${NOTE_SELECT_FIELDS}
    FROM A_B_Note__c
    WHERE Id = '${noteId}'
    LIMIT 1
  `.trim()

  const result = await query<ABNoteExpanded>(soql)
  if (result.records.length === 0) throw new Error('Note not found')
  return result.records[0]
}

/**
 * Create a new note
 */
export async function createNote(contactId: string | null, body: string): Promise<string> {
  const fields: Record<string, unknown> = { Body__c: body }
  if (contactId) fields.Contact__c = contactId
  return createRecord('A_B_Note__c', fields)
}

/**
 * Update an existing note body
 */
export async function updateNote(noteId: string, body: string): Promise<void> {
  await updateRecord('A_B_Note__c', noteId, { Body__c: body })
}

/**
 * Delete a note
 */
export async function deleteNote(noteId: string): Promise<void> {
  await deleteRecord('A_B_Note__c', noteId)
}

/**
 * Get contacts for note creation (lightweight query for picker)
 */
export async function getContactsForPicker(search?: string): Promise<{ Id: string; Name: string; Email: string | null; Account: { Name: string } | null }[]> {
  let whereClause = 'Id != null'
  if (search) {
    const s = sanitizeSoqlValue(search)
    whereClause += ` AND (Name LIKE '%${s}%' OR Email LIKE '%${s}%')`
  }

  const soql = `
    SELECT Id, Name, Email, Account.Name
    FROM Contact
    WHERE ${whereClause}
    ORDER BY Name ASC
    LIMIT 20
  `.trim()

  const result = await query<{ Id: string; Name: string; Email: string | null; Account: { Name: string } | null }>(soql)
  return result.records
}

// ──────────────────────────────────────────────
// FINANCE (Breadwinner / Payment data)
// ──────────────────────────────────────────────

/**
 * Get accounts with Breadwinner financial rollup data
 */
export async function getAccountFinancials(): Promise<{
  Id: string; Name: string
  Bread_Winner__Total_Amount_Invoiced__c: number | null
  Bread_Winner__Total_Amount_Paid__c: number | null
  Bread_Winner__Total_Amount_Due__c: number | null
  Bread_Winner__Total_Amount_Overdue__c: number | null
  Bread_Winner__Total_Unallocated_Credit__c: number | null
  Bread_Winner__Total_Draft_Amount__c: number | null
}[]> {
  const soql = `
    SELECT Id, Name,
      Bread_Winner__Total_Amount_Invoiced__c,
      Bread_Winner__Total_Amount_Paid__c,
      Bread_Winner__Total_Amount_Due__c,
      Bread_Winner__Total_Amount_Overdue__c,
      Bread_Winner__Total_Unallocated_Credit__c,
      Bread_Winner__Total_Draft_Amount__c
    FROM Account
    WHERE Bread_Winner__Total_Amount_Invoiced__c > 0
    ORDER BY Bread_Winner__Total_Amount_Overdue__c DESC NULLS LAST
    LIMIT 500
  `.trim()

  const result = await query<{
    Id: string; Name: string
    Bread_Winner__Total_Amount_Invoiced__c: number | null
    Bread_Winner__Total_Amount_Paid__c: number | null
    Bread_Winner__Total_Amount_Due__c: number | null
    Bread_Winner__Total_Amount_Overdue__c: number | null
    Bread_Winner__Total_Unallocated_Credit__c: number | null
    Bread_Winner__Total_Draft_Amount__c: number | null
  }>(soql)
  return result.records
}

/**
 * Get payment plan progress across won deals
 */
export async function getPaymentPlanProgress(): Promise<SalesforceOpportunityFull[]> {
  const soql = `
    SELECT ${PIPELINE_SELECT_FIELDS}
    FROM Opportunity
    WHERE StageName IN ('Agreement Signed', 'Amended', 'Amendment Signed')
      AND Total_Balance__c > 0
    ORDER BY Total_Balance__c DESC
    LIMIT 500
  `.trim()

  const result = await query<SalesforceOpportunityFull>(soql)
  return result.records
}

/**
 * Get accounts with unallocated credit
 */
export async function getCreditAccounts(): Promise<{
  Id: string; Name: string
  Bread_Winner__Total_Unallocated_Credit__c: number | null
  Bread_Winner__Total_Amount_Invoiced__c: number | null
  Bread_Winner__Total_Amount_Paid__c: number | null
}[]> {
  const soql = `
    SELECT Id, Name,
      Bread_Winner__Total_Unallocated_Credit__c,
      Bread_Winner__Total_Amount_Invoiced__c,
      Bread_Winner__Total_Amount_Paid__c
    FROM Account
    WHERE Bread_Winner__Total_Unallocated_Credit__c > 0
    ORDER BY Bread_Winner__Total_Unallocated_Credit__c DESC
    LIMIT 200
  `.trim()

  const result = await query<{
    Id: string; Name: string
    Bread_Winner__Total_Unallocated_Credit__c: number | null
    Bread_Winner__Total_Amount_Invoiced__c: number | null
    Bread_Winner__Total_Amount_Paid__c: number | null
  }>(soql)
  return result.records
}

// ──────────────────────────────────────────────
// DIALER (callable leads/contacts)
// ──────────────────────────────────────────────

export interface DialerFilters {
  type?: 'leads' | 'contacts' | 'all'
  eventInterest?: string
  status?: string
  tags?: string
  ownerId?: string
  minSpend?: number
  maxSpend?: number
  noteKeyword?: string
  lastActivityBefore?: string
}

/**
 * Get leads with phone numbers for the dialer
 */
export async function getCallableLeads(filters?: DialerFilters): Promise<SalesforceLead[]> {
  const conditions: string[] = [
    'IsConverted = false',
    '(Phone != null OR MobilePhone != null)',
  ]

  if (filters?.status) conditions.push(`Status = '${sanitizeSoqlValue(filters.status)}'`)
  if (filters?.eventInterest) {
    const s = sanitizeSoqlValue(filters.eventInterest)
    conditions.push(`Event_of_Interest__c LIKE '%${s}%'`)
  }
  if (filters?.ownerId) {
    validateSalesforceId(filters.ownerId, 'ownerId')
    conditions.push(`OwnerId = '${filters.ownerId}'`)
  }
  if (filters?.lastActivityBefore) conditions.push(`LastActivityDate < ${sanitizeSoqlValue(filters.lastActivityBefore)}`)

  const soql = `
    SELECT ${LEAD_SELECT_FIELDS}
    FROM Lead
    WHERE ${conditions.join(' AND ')}
    ORDER BY LastActivityDate ASC NULLS FIRST
    LIMIT 200
  `.trim()

  const result = await query<SalesforceLead>(soql)
  return result.records
}

/**
 * Get contacts with phone numbers for the dialer
 */
export async function getCallableContacts(filters?: DialerFilters): Promise<SalesforceContact[]> {
  const conditions: string[] = [
    '(Phone != null OR MobilePhone != null)',
  ]

  if (filters?.ownerId) {
    validateSalesforceId(filters.ownerId, 'ownerId')
    conditions.push(`OwnerId = '${filters.ownerId}'`)
  }
  if (filters?.minSpend) conditions.push(`Total_Spend_to_Date__c >= ${validateNumber(filters.minSpend, 'minSpend')}`)
  if (filters?.maxSpend) conditions.push(`Total_Spend_to_Date__c <= ${validateNumber(filters.maxSpend, 'maxSpend')}`)

  const soql = `
    SELECT ${CONTACT_SELECT_FIELDS}
    FROM Contact
    WHERE ${conditions.join(' AND ')}
    ORDER BY LastActivityDate ASC NULLS FIRST
    LIMIT 200
  `.trim()

  const result = await query<SalesforceContact>(soql)
  return result.records
}

// ──────────────────────────────────────────────
// EVENT RECAP
// ──────────────────────────────────────────────

/**
 * Get deals closed today
 */
export async function getDealsClosedToday(): Promise<SalesforceOpportunityFull[]> {
  const soql = `
    SELECT ${PIPELINE_SELECT_FIELDS}
    FROM Opportunity
    WHERE CloseDate = TODAY
      AND StageName IN ('Agreement Signed', 'Amended', 'Amendment Signed')
    ORDER BY Gross_Amount__c DESC NULLS LAST
    LIMIT 50
  `.trim()
  const result = await query<SalesforceOpportunityFull>(soql)
  return result.records
}

/**
 * Get leads generated today
 */
export async function getLeadsCreatedToday(): Promise<number> {
  const soql = `SELECT COUNT() total FROM Lead WHERE CreatedDate = TODAY`
  const result = await query<{ total: number }>(soql)
  return result.totalSize
}

/**
 * Get upcoming events in the next N days
 */
export async function getUpcomingEvents(days: number = 7): Promise<SalesforceEventRecord[]> {
  const safeDays = validateNumber(days, 'days')
  const soql = `
    SELECT ${EVENT_SELECT_FIELDS}
    FROM Event__c
    WHERE Start_Date__c >= TODAY
      AND Start_Date__c <= NEXT_N_DAYS:${safeDays}
    ORDER BY Start_Date__c ASC
    LIMIT 20
  `.trim()
  const result = await query<SalesforceEventRecord>(soql)
  return result.records
}
