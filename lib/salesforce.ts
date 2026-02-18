// Salesforce REST API integration using OAuth 2.0 Client Credentials flow
// No external packages needed — uses standard fetch

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

    console.error('Salesforce query failed:', response.status, errorBody)
    throw new Error(`Salesforce query failed: ${response.status}`)
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
