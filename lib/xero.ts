// Xero API client with OAuth token management and all finance API methods
import { Redis } from '@upstash/redis'
import type {
  XeroOrgTokens,
  XeroInvoice,
  XeroContact,
  XeroBankAccount,
  XeroHistoryRecord,
  ChaseStageKey,
  ChaseStageData,
  ChaseActivity,
  ChaseStageConfig,
  EnrichedInvoice,
} from './types'

// ── Constants ──

const XERO_AUTH_URL = 'https://login.xero.com/identity/connect/authorize'
const XERO_TOKEN_URL = 'https://identity.xero.com/connect/token'
const XERO_API_BASE = 'https://api.xero.com/api.xro/2.0'
const XERO_CONNECTIONS_URL = 'https://api.xero.com/connections'

const XERO_SCOPES = 'openid profile email accounting.transactions accounting.contacts accounting.settings offline_access'

// Token refresh buffer: refresh 5 minutes before expiry
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000

// Redis keys
const REDIS_KEYS = {
  orgTokens: 'xero:org_tokens',
  chaseStages: 'xero:chase_stages',
  chaseActivity: (invoiceId: string) => `xero:chase_activity:${invoiceId}`,
  contactCache: (contactId: string) => `xero:contacts_cache:${contactId}`,
  bankAccounts: 'xero:bank_accounts',
  oauthState: (state: string) => `xero:oauth_state:${state}`,
}

// Chase stage definitions matching Scarlett's Salesforce dropdown
export const CHASE_STAGES: ChaseStageConfig[] = [
  { key: '1-3_days_xero_reminder', label: '1-3 days Xero Reminder', color: 'bg-green-100', textColor: 'text-green-700', description: 'Automated Xero reminder sent' },
  { key: '3-5_days_finance_email', label: '3-5 days Finance Email', color: 'bg-blue-100', textColor: 'text-blue-700', description: 'Finance team sends manual email' },
  { key: '8_days_process_email', label: '8 days Process + Email', color: 'bg-orange-100', textColor: 'text-orange-700', description: 'Attempt to take payment + email' },
  { key: '10_days_process_email', label: '10 days Process + Email', color: 'bg-purple-100', textColor: 'text-purple-700', description: 'Second attempt to process + email' },
  { key: 'daily_chaser', label: 'Daily Chaser', color: 'bg-amber-100', textColor: 'text-amber-700', description: 'Daily follow-up' },
  { key: 'final_warning', label: 'Final Warning', color: 'bg-red-100', textColor: 'text-red-600', description: 'Last warning before cancellation' },
  { key: 'cancellation_terms', label: 'Cancellation Terms', color: 'bg-red-200', textColor: 'text-red-800', description: 'Cancellation terms issued' },
  { key: 'bolt_on', label: 'BOLT ON', color: 'bg-emerald-100', textColor: 'text-emerald-800', description: 'Bolt-on / resolved' },
]

// ── Redis Client ──

let redisClient: Redis | null = null
function getRedis(): Redis {
  if (!redisClient) {
    redisClient = Redis.fromEnv()
  }
  return redisClient
}

// ── In-Memory Token Cache ──

let cachedTokens: XeroOrgTokens | null = null

// ── OAuth Helpers ──

export function getXeroAuthUrl(adminEmail: string): string {
  const state = crypto.randomUUID()
  const redis = getRedis()
  // Store state for CSRF validation (fire-and-forget, 10 min expiry)
  redis.set(REDIS_KEYS.oauthState(state), { email: adminEmail, created: Date.now() }, { ex: 600 })

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.XERO_CLIENT_ID!,
    redirect_uri: process.env.XERO_REDIRECT_URI!,
    scope: XERO_SCOPES,
    state,
  })

  return `${XERO_AUTH_URL}?${params.toString()}`
}

export async function validateOAuthState(state: string): Promise<{ email: string } | null> {
  const redis = getRedis()
  const data = await redis.get(REDIS_KEYS.oauthState(state)) as { email: string } | null
  if (data) {
    await redis.del(REDIS_KEYS.oauthState(state))
  }
  return data
}

export async function exchangeCodeForTokens(code: string): Promise<XeroOrgTokens> {
  const credentials = Buffer.from(`${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`).toString('base64')

  const tokenRes = await fetch(XERO_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.XERO_REDIRECT_URI!,
    }),
  })

  if (!tokenRes.ok) {
    const err = await tokenRes.text()
    console.error('Xero token exchange failed:', err)
    throw new Error(`Xero token exchange failed: ${tokenRes.status}`)
  }

  const data = await tokenRes.json()

  // Get tenant ID from connections endpoint
  const connectionsRes = await fetch(XERO_CONNECTIONS_URL, {
    headers: { 'Authorization': `Bearer ${data.access_token}` },
  })

  if (!connectionsRes.ok) {
    throw new Error('Failed to get Xero tenant connections')
  }

  const connections = await connectionsRes.json()
  if (!connections.length) {
    throw new Error('No Xero organisations connected')
  }

  const tenantId = connections[0].tenantId

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in * 1000),
    tenant_id: tenantId,
    connected_by: '', // filled by caller
    connected_at: new Date().toISOString(),
  }
}

export async function saveOrgTokens(tokens: XeroOrgTokens): Promise<void> {
  const redis = getRedis()
  await redis.set(REDIS_KEYS.orgTokens, tokens)
  cachedTokens = tokens
}

export async function getOrgTokens(): Promise<XeroOrgTokens | null> {
  const redis = getRedis()
  return await redis.get(REDIS_KEYS.orgTokens) as XeroOrgTokens | null
}

export async function disconnectXero(): Promise<void> {
  const redis = getRedis()
  await redis.del(REDIS_KEYS.orgTokens)
  cachedTokens = null
}

// ── Token Management ──

async function refreshTokens(): Promise<XeroOrgTokens> {
  const redis = getRedis()
  const stored = await redis.get(REDIS_KEYS.orgTokens) as XeroOrgTokens | null

  if (!stored?.refresh_token) {
    throw new Error('No Xero refresh token available. Please reconnect Xero.')
  }

  const credentials = Buffer.from(`${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`).toString('base64')

  const res = await fetch(XERO_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: stored.refresh_token,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('Xero token refresh failed:', err)
    throw new Error('Xero token refresh failed. Please reconnect Xero.')
  }

  const data = await res.json()

  const updated: XeroOrgTokens = {
    ...stored,
    access_token: data.access_token,
    refresh_token: data.refresh_token, // Xero rotates refresh tokens
    expires_at: Date.now() + (data.expires_in * 1000),
  }

  await redis.set(REDIS_KEYS.orgTokens, updated)
  cachedTokens = updated
  return updated
}

async function getValidToken(): Promise<{ accessToken: string; tenantId: string }> {
  // Check in-memory cache first
  if (cachedTokens && Date.now() < cachedTokens.expires_at - TOKEN_REFRESH_BUFFER_MS) {
    return { accessToken: cachedTokens.access_token, tenantId: cachedTokens.tenant_id }
  }

  // Check Redis
  const stored = await getOrgTokens()
  if (!stored) {
    throw new Error('Xero is not connected. Please connect from Settings.')
  }

  // If token is still valid, use it
  if (Date.now() < stored.expires_at - TOKEN_REFRESH_BUFFER_MS) {
    cachedTokens = stored
    return { accessToken: stored.access_token, tenantId: stored.tenant_id }
  }

  // Refresh needed
  const refreshed = await refreshTokens()
  return { accessToken: refreshed.access_token, tenantId: refreshed.tenant_id }
}

// ── Generic API Caller ──

async function xeroFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; retried?: boolean } = {}
): Promise<T> {
  const { accessToken, tenantId } = await getValidToken()
  const method = options.method || 'GET'

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
    'Xero-Tenant-Id': tenantId,
    'Accept': 'application/json',
  }

  if (options.body) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(`${XERO_API_BASE}${path}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  // Handle token expiry — retry once after refresh
  if (res.status === 401 && !options.retried) {
    cachedTokens = null
    await refreshTokens()
    return xeroFetch<T>(path, { ...options, retried: true })
  }

  if (res.status === 429) {
    throw new Error('Xero rate limit exceeded. Please wait a moment and try again.')
  }

  if (!res.ok) {
    const errText = await res.text()
    console.error(`Xero API error ${res.status} on ${method} ${path}:`, errText)
    throw new Error(`Xero API error: ${res.status}`)
  }

  return res.json()
}

// ── Invoice Methods ──

export async function getOverdueInvoices(page = 1): Promise<XeroInvoice[]> {
  const where = encodeURIComponent('Status=="AUTHORISED"&&AmountDue>0&&Type=="ACCREC"&&DueDate<DateTime.UtcNow()')
  const data = await xeroFetch<{ Invoices: XeroInvoice[] }>(
    `/Invoices?where=${where}&order=DueDate&page=${page}`
  )
  return data.Invoices || []
}

export async function getAllOverdueInvoices(): Promise<XeroInvoice[]> {
  const allInvoices: XeroInvoice[] = []
  let page = 1

  while (true) {
    const invoices = await getOverdueInvoices(page)
    allInvoices.push(...invoices)
    if (invoices.length < 100) break // Last page
    page++
  }

  return allInvoices
}

export async function getInvoice(invoiceId: string): Promise<XeroInvoice> {
  const data = await xeroFetch<{ Invoices: XeroInvoice[] }>(`/Invoices/${invoiceId}`)
  if (!data.Invoices?.length) throw new Error('Invoice not found')
  return data.Invoices[0]
}

export async function getInvoicesByStatus(status: string, page = 1): Promise<XeroInvoice[]> {
  const where = encodeURIComponent(`Status=="${status}"&&Type=="ACCREC"`)
  const data = await xeroFetch<{ Invoices: XeroInvoice[] }>(
    `/Invoices?where=${where}&order=DueDate%20DESC&page=${page}`
  )
  return data.Invoices || []
}

// ── Contact Methods ──

export async function getContact(contactId: string): Promise<XeroContact> {
  const redis = getRedis()

  // Check cache first
  const cached = await redis.get(REDIS_KEYS.contactCache(contactId)) as XeroContact | null
  if (cached) return cached

  const data = await xeroFetch<{ Contacts: XeroContact[] }>(`/Contacts/${contactId}`)
  if (!data.Contacts?.length) throw new Error('Contact not found')

  const contact = data.Contacts[0]

  // Cache for 1 hour
  await redis.set(REDIS_KEYS.contactCache(contactId), contact, { ex: 3600 })

  return contact
}

export async function getContactsWithOverdue(): Promise<XeroContact[]> {
  const where = encodeURIComponent('IsCustomer==true')
  const data = await xeroFetch<{ Contacts: XeroContact[] }>(
    `/Contacts?where=${where}&includeArchived=false`
  )
  return (data.Contacts || []).filter(
    c => c.Balances?.AccountsReceivable?.Overdue && c.Balances.AccountsReceivable.Overdue > 0
  )
}

// Batch fetch contact emails for a list of contact IDs
export async function batchGetContactEmails(
  contactIds: string[]
): Promise<Map<string, { email: string; phone?: string }>> {
  const result = new Map<string, { email: string; phone?: string }>()
  const redis = getRedis()

  // Check cache for all contacts first
  const uncachedIds: string[] = []
  for (const id of contactIds) {
    const cached = await redis.get(REDIS_KEYS.contactCache(id)) as XeroContact | null
    if (cached) {
      result.set(id, {
        email: cached.EmailAddress || cached.ContactPersons?.[0]?.EmailAddress || '',
        phone: cached.Phones?.find(p => p.PhoneType === 'DEFAULT')?.PhoneNumber,
      })
    } else {
      uncachedIds.push(id)
    }
  }

  // Fetch uncached contacts (max 5 concurrent to respect rate limits)
  const chunks: string[][] = []
  for (let i = 0; i < uncachedIds.length; i += 5) {
    chunks.push(uncachedIds.slice(i, i + 5))
  }

  for (const chunk of chunks) {
    const results = await Promise.allSettled(
      chunk.map(async (id) => {
        const contact = await getContact(id)
        return { id, contact }
      })
    )

    for (const res of results) {
      if (res.status === 'fulfilled') {
        const { id, contact } = res.value
        result.set(id, {
          email: contact.EmailAddress || contact.ContactPersons?.[0]?.EmailAddress || '',
          phone: contact.Phones?.find(p => p.PhoneType === 'DEFAULT')?.PhoneNumber,
        })
      }
    }
  }

  return result
}

// ── Payment Methods ──

export async function recordPayment(
  invoiceId: string,
  amount: number,
  bankAccountId: string,
  date: string
): Promise<void> {
  await xeroFetch('/Payments', {
    method: 'POST',
    body: {
      Invoice: { InvoiceID: invoiceId },
      Account: { AccountID: bankAccountId },
      Amount: amount,
      Date: date,
    },
  })
}

export async function getBankAccounts(): Promise<XeroBankAccount[]> {
  const redis = getRedis()

  // Check cache (24hr TTL)
  const cached = await redis.get(REDIS_KEYS.bankAccounts) as XeroBankAccount[] | null
  if (cached) return cached

  const where = encodeURIComponent('Type=="BANK"&&Status=="ACTIVE"')
  const data = await xeroFetch<{ Accounts: XeroBankAccount[] }>(`/Accounts?where=${where}`)
  const accounts = data.Accounts || []

  await redis.set(REDIS_KEYS.bankAccounts, accounts, { ex: 86400 })

  return accounts
}

// ── History / Notes Methods ──

export async function getInvoiceHistory(invoiceId: string): Promise<XeroHistoryRecord[]> {
  const data = await xeroFetch<{ HistoryRecords: XeroHistoryRecord[] }>(
    `/Invoices/${invoiceId}/History`
  )
  return data.HistoryRecords || []
}

export async function addInvoiceNote(invoiceId: string, note: string): Promise<void> {
  await xeroFetch(`/Invoices/${invoiceId}/History`, {
    method: 'PUT',
    body: {
      HistoryRecords: [{ Details: note }],
    },
  })
}

export async function sendInvoiceEmail(invoiceId: string): Promise<void> {
  await xeroFetch(`/Invoices/${invoiceId}/Email`, {
    method: 'POST',
    body: {},
  })
}

// ── Chase Stage Methods (Redis) ──

export async function getAllChaseStages(): Promise<Record<string, ChaseStageData>> {
  const redis = getRedis()
  const raw = await redis.hgetall(REDIS_KEYS.chaseStages) as Record<string, string | ChaseStageData> | null
  if (!raw) return {}

  const result: Record<string, ChaseStageData> = {}
  for (const [invoiceId, val] of Object.entries(raw)) {
    if (typeof val === 'string') {
      try { result[invoiceId] = JSON.parse(val) } catch { /* skip */ }
    } else {
      result[invoiceId] = val as ChaseStageData
    }
  }
  return result
}

export async function getChaseStage(invoiceId: string): Promise<ChaseStageData | null> {
  const redis = getRedis()
  const raw = await redis.hget(REDIS_KEYS.chaseStages, invoiceId) as string | ChaseStageData | null
  if (!raw) return null
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) } catch { return null }
  }
  return raw as ChaseStageData
}

export async function setChaseStage(
  invoiceId: string,
  stage: ChaseStageKey,
  userEmail: string
): Promise<void> {
  const redis = getRedis()
  const data: ChaseStageData = {
    stage,
    updatedAt: new Date().toISOString(),
    updatedBy: userEmail,
  }

  await redis.hset(REDIS_KEYS.chaseStages, { [invoiceId]: JSON.stringify(data) })

  // Log activity
  const stageConfig = CHASE_STAGES.find(s => s.key === stage)
  await addChaseActivity(invoiceId, {
    action: 'stage_change',
    detail: `Stage changed to "${stageConfig?.label || stage}"`,
    user: userEmail,
  })

  // Also add note to Xero History for audit trail
  try {
    await addInvoiceNote(invoiceId, `Chase stage: ${stageConfig?.label || stage}`)
  } catch (err) {
    console.error('Failed to add Xero history note for stage change:', err)
  }
}

// ── Chase Activity Log (Redis) ──

export async function addChaseActivity(
  invoiceId: string,
  activity: Omit<ChaseActivity, 'id' | 'invoiceId' | 'timestamp'>
): Promise<void> {
  const redis = getRedis()
  const entry: ChaseActivity = {
    id: crypto.randomUUID(),
    invoiceId,
    timestamp: new Date().toISOString(),
    ...activity,
  }

  // Push to front of list (most recent first), trim to 100 entries
  await redis.lpush(REDIS_KEYS.chaseActivity(invoiceId), JSON.stringify(entry))
  await redis.ltrim(REDIS_KEYS.chaseActivity(invoiceId), 0, 99)
}

export async function getChaseActivities(invoiceId: string, limit = 50): Promise<ChaseActivity[]> {
  const redis = getRedis()
  const raw = await redis.lrange(REDIS_KEYS.chaseActivity(invoiceId), 0, limit - 1)
  return raw.map(item => {
    if (typeof item === 'string') {
      try { return JSON.parse(item) } catch { return null }
    }
    return item
  }).filter(Boolean) as ChaseActivity[]
}

// ── Enriched Invoices (combines Xero + Redis chase data) ──

export async function getEnrichedOverdueInvoices(): Promise<EnrichedInvoice[]> {
  // Fetch invoices and chase stages in parallel
  const [invoices, chaseStages] = await Promise.all([
    getAllOverdueInvoices(),
    getAllChaseStages(),
  ])

  // Collect unique contact IDs
  const contactIds = [...new Set(invoices.map(inv => inv.Contact.ContactID))]

  // Batch fetch contact emails
  const contactEmails = await batchGetContactEmails(contactIds)

  // Enrich each invoice
  const now = new Date()
  const enriched: EnrichedInvoice[] = invoices.map(inv => {
    const dueDate = new Date(inv.DueDate)
    const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    const contactInfo = contactEmails.get(inv.Contact.ContactID)

    return {
      ...inv,
      contactEmail: contactInfo?.email || '',
      contactPhone: contactInfo?.phone,
      daysOverdue,
      chaseStage: chaseStages[inv.InvoiceID] || undefined,
    }
  })

  // Sort by days overdue (most overdue first)
  enriched.sort((a, b) => b.daysOverdue - a.daysOverdue)

  return enriched
}

// ── Overview / Summary ──

export async function getOverdueSummary(): Promise<{
  totalOverdue: number
  totalOutstanding: number
  invoiceCount: number
  stageBreakdown: Record<string, { count: number; total: number }>
  agingBuckets: { label: string; count: number; total: number }[]
}> {
  const [invoices, chaseStages] = await Promise.all([
    getAllOverdueInvoices(),
    getAllChaseStages(),
  ])

  const now = new Date()
  let totalOverdue = 0
  let totalOutstanding = 0
  const stageBreakdown: Record<string, { count: number; total: number }> = {}
  const aging = { '1-7': { count: 0, total: 0 }, '8-14': { count: 0, total: 0 }, '15-30': { count: 0, total: 0 }, '30+': { count: 0, total: 0 } }

  for (const inv of invoices) {
    totalOverdue += inv.AmountDue
    totalOutstanding += inv.Total - inv.AmountPaid

    const daysOverdue = Math.floor((now.getTime() - new Date(inv.DueDate).getTime()) / (1000 * 60 * 60 * 24))
    if (daysOverdue <= 7) { aging['1-7'].count++; aging['1-7'].total += inv.AmountDue }
    else if (daysOverdue <= 14) { aging['8-14'].count++; aging['8-14'].total += inv.AmountDue }
    else if (daysOverdue <= 30) { aging['15-30'].count++; aging['15-30'].total += inv.AmountDue }
    else { aging['30+'].count++; aging['30+'].total += inv.AmountDue }

    const stage = chaseStages[inv.InvoiceID]?.stage || 'unassigned'
    if (!stageBreakdown[stage]) stageBreakdown[stage] = { count: 0, total: 0 }
    stageBreakdown[stage].count++
    stageBreakdown[stage].total += inv.AmountDue
  }

  return {
    totalOverdue,
    totalOutstanding,
    invoiceCount: invoices.length,
    stageBreakdown,
    agingBuckets: [
      { label: '1-7 days', ...aging['1-7'] },
      { label: '8-14 days', ...aging['8-14'] },
      { label: '15-30 days', ...aging['15-30'] },
      { label: '30+ days', ...aging['30+'] },
    ],
  }
}

// ── Connection Check ──

export async function isXeroConnected(): Promise<boolean> {
  const tokens = await getOrgTokens()
  return !!tokens?.refresh_token
}
